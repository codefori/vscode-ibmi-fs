import { IBMiComponent, SecureComponentState } from "@halcyontech/vscode-ibmi-types/api/components/component";
import IBMi from "@halcyontech/vscode-ibmi-types/api/IBMi";
import { posix } from "path";
import { getInstance } from "../../ibmi";
import { QwcrclsiComponent } from "./qwcrclsi";

/**
 * Table function that returns the attributes of a single IBM i Class (*CLS) object,
 * combining OBJECT_STATISTICS (for usage/text) with the {@link QwcrclsiComponent
 * QWCRCLSI component} (for run priority, time slice and resource limits).
 */
export class ClassInfoComponent implements IBMiComponent {
  static ID = "ClassInfo";
  private static readonly VERSION = 1;
  private static readonly SIGNATURE = "C301202E24FDEEDB76E243A0250A5BD9ED02D6E0069A4039F02E12E3335EE2BE";
  private static readonly TYPE = "FUNCTION";
  static readonly FUNCTION_NAME = `CLASS_INFO${ClassInfoComponent.VERSION.toString().padStart(4, "0")}`;

  static async get(): Promise<ClassInfoComponent | undefined> {
    return await getInstance()?.getConnection()?.getComponent<ClassInfoComponent>(ClassInfoComponent.ID);
  }

  private getLibrary(connection: IBMi) {
    return connection?.getConfig()?.tempLibrary.toUpperCase() || `ILEDITOR`;
  }

  getIdentification() {
    return {
      name: ClassInfoComponent.ID,
      version: ClassInfoComponent.VERSION,
      signature: ClassInfoComponent.SIGNATURE,
    };
  }

  async getRemoteState(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    const remoteSignature = await connection.getContent().getSQLRoutineSignature(
      this.getLibrary(connection),
      ClassInfoComponent.FUNCTION_NAME,
      ClassInfoComponent.TYPE,
    );
    return {
      status: remoteSignature ? "Installed" : "NotInstalled",
      remoteSignature: remoteSignature,
    };
  }

  async update(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    // This function calls the QWCRCLSI procedure by name, so it must already exist.
    const qwcrclsi = await connection.getComponent<QwcrclsiComponent>(QwcrclsiComponent.ID);
    if (!qwcrclsi) {
      throw Error(`QwcrclsiComponent could not be installed`);
    }

    return connection.withTempDirectory(async tempDir => {
      const tempSourcePath = posix.join(tempDir, `classinfo.sql`);
      const library = this.getLibrary(connection);
      const oldLib = (await connection.runSQL('VALUES CURRENT PATH'))[0]['00001'] as string;
      await connection.getContent().writeStreamfileRaw(tempSourcePath, this.getSource(library, ClassInfoComponent.FUNCTION_NAME, QwcrclsiComponent.PROCEDURE_NAME, ClassInfoComponent.VERSION, oldLib));
      const result = await connection.runCommand({
        command: `QSYS/RUNSQLSTM SRCSTMF('${tempSourcePath}') COMMIT(*NONE) NAMING(*SYS) DFTRDBCOL(${library})`,
        cwd: `/`,
        noLibList: true,
        getSpooledFiles: true
      });

      if (result.code !== 0) {
        throw Error(result.stderr || result.stdout);
      }

      return this.getRemoteState(connection, installDirectory);
    });
  }

  private getSource(library: string, name: string, procedureName: string, version: number, oldLib: string) {
    return /*sql*/`
    --
    -- Subject: Return the attributes of a single IBM i class object
    -- Author: Scott Forstie
    -- Date  : February, 2025
    --
    -- Co-author: Christian Jorgensen
    -- Date  : February, 2025
    --
    -- This service uses a stored procedure to call API QWCRCLSI,
    -- not using printed output from the Display Class (DSPCLS) CL command.
    --
    -- Features Used: This Gist uses object_statistics, SQL PL
    --
    -- Resources:
    -- https://www.ibm.com/docs/api/v1/content/ssw_ibm_i_75/apis/qwcrclsi.htm
    --
    SET PATH = ${library};

    create or replace function ${library}.${name} (
        IN_CLASS_LIBRARY VARCHAR(10),
        IN_CLASS_NAME VARCHAR(10)
      )
      RETURNS TABLE (
        CLASS_LIBRARY VARCHAR(10) FOR SBCS DATA,
        CLASS_NAME VARCHAR(10) FOR SBCS DATA,
        TEXT_DESCRIPTION VARCHAR(50) FOR SBCS DATA,
        LAST_USED DATE,
        USE_COUNT INTEGER,
        RUN_PRIORITY INTEGER,
        ELIGIBLE_PURGE VARCHAR(4) FOR SBCS DATA,
        TIME_SLICE INTEGER,
        DEFAULT_WAIT VARCHAR(11) FOR SBCS DATA,
        MAXIMUM_CPU_TIME VARCHAR(11) FOR SBCS DATA,
        MAXIMUM_TEMPORARY_STORAGE_ALLOWED VARCHAR(11) FOR SBCS DATA,
        MAXIMUM_ACTIVE_THREADS VARCHAR(11) FOR SBCS DATA
      )
      NOT DETERMINISTIC
      EXTERNAL ACTION
      MODIFIES SQL DATA
      NOT FENCED
      SET OPTION COMMIT = *NONE,
                 USRPRF = *USER,
                 DYNUSRPRF = *USER
      BEGIN
        DECLARE LOCAL_SQLCODE INTEGER;
        DECLARE LOCAL_SQLSTATE CHAR(5);
        DECLARE V_MESSAGE_TEXT VARCHAR(70);
        DECLARE V_DSPCLS VARCHAR(1000);
        --
        -- QWCRCLSI detail
        --
        DECLARE V_CLASS CHAR(10);
        DECLARE V_CLASS_LIBRARY CHAR(10);
        DECLARE V_CLASS_RUN_PRIORITY INTEGER;
        DECLARE V_CLASS_TIME_SLICE INTEGER;
        DECLARE V_CLASS_ELIGIBLE_PURGE VARCHAR(4) FOR SBCS DATA;
        DECLARE V_CLASS_DFT_WAIT VARCHAR(11);
        DECLARE V_CLASS_MAX_CPU VARCHAR(11) FOR SBCS DATA;
        DECLARE V_CLASS_MAX_TMP_STG VARCHAR(11) FOR SBCS DATA;
        DECLARE V_CLASS_MAX_THREADS VARCHAR(11) FOR SBCS DATA;
        --
        -- OBJECT_STATISTICS detail
        --
        DECLARE FIND_CLASSES_QUERY_TEXT VARCHAR(5000);
        DECLARE V_CLS_TEXT VARCHAR(50);
        DECLARE V_JOB_NAME VARCHAR(28);
        DECLARE V_CLS_LAST_USE DATE;
        DECLARE V_CLS_USE_COUNT INTEGER;
        DECLARE BUFFER CHAR(112) FOR BIT DATA NOT NULL DEFAULT '';
        DECLARE C_FIND_CLASSES CURSOR FOR FIND_CLASSES_QUERY;
        DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
        BEGIN
            GET DIAGNOSTICS CONDITION 1 LOCAL_SQLCODE = DB2_RETURNED_SQLCODE,
                    LOCAL_SQLSTATE = RETURNED_SQLSTATE;
            SET V_MESSAGE_TEXT = 'systools.class_info() failed with: ' CONCAT LOCAL_SQLCODE CONCAT '  AND ' CONCAT LOCAL_SQLSTATE;
            SIGNAL SQLSTATE 'QPC01'
                SET MESSAGE_TEXT = V_MESSAGE_TEXT;
        END;
        SET FIND_CLASSES_QUERY_TEXT =
                'select OBJS.OBJLIB, objs.OBJNAME, objs.OBJTEXT, objs.LAST_USED_TIMESTAMP, objs.DAYS_USED_COUNT
                 FROM TABLE (qsys2.OBJECT_STATISTICS(''' CONCAT TRIM(IN_CLASS_LIBRARY) CONCAT ''',''CLS    '', ''' CONCAT
                    TRIM(IN_CLASS_NAME) CONCAT ''')) AS objs';
        PREPARE FIND_CLASSES_QUERY FROM FIND_CLASSES_QUERY_TEXT;
        OPEN C_FIND_CLASSES;
        L1: LOOP
            FETCH FROM C_FIND_CLASSES
                INTO V_CLASS_LIBRARY,
                     V_CLASS,
                     V_CLS_TEXT,
                     V_CLS_LAST_USE,
                     V_CLS_USE_COUNT;
            GET DIAGNOSTICS CONDITION 1 LOCAL_SQLCODE = DB2_RETURNED_SQLCODE,
                    LOCAL_SQLSTATE = RETURNED_SQLSTATE;
            IF (LOCAL_SQLSTATE = '02000') THEN
                CLOSE C_FIND_CLASSES;
                RETURN;
            END IF;
            CALL ${procedureName}(
                BUFFER,
                112,
                'CLSI0100',
                V_CLASS CONCAT V_CLASS_LIBRARY,
                x'00000000'
            );
            SET V_CLASS_RUN_PRIORITY = INTERPRET(SUBSTR(BUFFER, 29, 4) AS INTEGER);
            SET V_CLASS_TIME_SLICE = INTERPRET(SUBSTR(BUFFER, 33, 4) AS INTEGER);
            SET V_CLASS_ELIGIBLE_PURGE =
                    CASE
                        WHEN INTERPRET(SUBSTR(BUFFER, 37, 4) AS INTEGER) = 1 THEN '*YES'
                        ELSE '*NO'
                    END;
            SET V_CLASS_DFT_WAIT = INTERPRET(SUBSTR(BUFFER, 41, 4) AS INTEGER);
            IF (TRIM(V_CLASS_DFT_WAIT) = '-1') THEN
                SET V_CLASS_DFT_WAIT = '*NOMAX';
            END IF;
            SET V_CLASS_MAX_CPU = INTERPRET(SUBSTR(BUFFER, 45, 4) AS INTEGER);
            IF (TRIM(V_CLASS_MAX_CPU) = '-1') THEN
                SET V_CLASS_MAX_CPU = '*NOMAX';
            END IF;
            SET V_CLASS_MAX_TMP_STG = INTERPRET(SUBSTR(BUFFER, 109, 4) AS INTEGER);
            IF (TRIM(V_CLASS_MAX_TMP_STG) = '-1') THEN
                SET V_CLASS_MAX_TMP_STG = '*NOMAX';
            END IF;
            SET V_CLASS_MAX_THREADS = INTERPRET(SUBSTR(BUFFER, 53, 4) AS INTEGER);
            IF (TRIM(V_CLASS_MAX_THREADS) = '-1') THEN
                SET V_CLASS_MAX_THREADS = '*NOMAX';
            END IF;
            PIPE (
                V_CLASS_LIBRARY,
                V_CLASS,
                V_CLS_TEXT,
                V_CLS_LAST_USE,
                V_CLS_USE_COUNT,
                V_CLASS_RUN_PRIORITY,
                V_CLASS_ELIGIBLE_PURGE,
                V_CLASS_TIME_SLICE,
                V_CLASS_DFT_WAIT,
                V_CLASS_MAX_CPU,
                V_CLASS_MAX_TMP_STG,
                V_CLASS_MAX_THREADS
            );
        END LOOP; /* L1 */
        CLOSE C_FIND_CLASSES;
    END;

    comment on function ${library}/${name} is '${version} - CLASS_INFO (per-class QWCRCLSI wrapper)';

    SET PATH = ${oldLib};
    `;
  }
}
