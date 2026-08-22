import { IBMiComponent, SecureComponentState } from "@halcyontech/vscode-ibmi-types/api/components/component";
import IBMi from "@halcyontech/vscode-ibmi-types/api/IBMi";
import { posix } from "path";
import { getInstance } from "../../ibmi";

/**
 * Table function wrapping the DSPPGMREF (Display Program References) CL command,
 * installed in the connection's temporary library.
 *
 * Author of the original SQL: Bob Cozzi.
 */
export class PgmRefsComponent implements IBMiComponent {
  static ID = "PGMREFS";
  private static readonly VERSION = 1;
  private static readonly SIGNATURE = "8E725F96FCFCC23933ECC899DF238E24DCD0DD9A9CDD6144890FE1204F79D83C";
  private static readonly TYPE = "FUNCTION";
  static readonly FUNCTION_NAME = `PGMREFS${PgmRefsComponent.VERSION.toString().padStart(4, "0")}`;

  static async get(): Promise<PgmRefsComponent | undefined> {
    return await getInstance()?.getConnection()?.getComponent<PgmRefsComponent>(PgmRefsComponent.ID);
  }

  private getLibrary(connection: IBMi) {
    return connection?.getConfig()?.tempLibrary.toUpperCase() || `ILEDITOR`;
  }

  getIdentification() {
    return {
      name: PgmRefsComponent.ID,
      version: PgmRefsComponent.VERSION,
      signature: PgmRefsComponent.SIGNATURE,
    };
  }

  async getRemoteState(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    const remoteSignature = await connection.getContent().getSQLRoutineSignature(
      this.getLibrary(connection),
      PgmRefsComponent.FUNCTION_NAME,
      PgmRefsComponent.TYPE,
    );
    return {
      status: remoteSignature ? "Installed" : "NotInstalled",
      remoteSignature: remoteSignature,
    };
  }

  async update(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    return connection.withTempDirectory(async tempDir => {
      const tempSourcePath = posix.join(tempDir, `pgmrefs.sql`);
      const library = this.getLibrary(connection);
      await connection.getContent().writeStreamfileRaw(tempSourcePath, this.getSource(library, PgmRefsComponent.FUNCTION_NAME, PgmRefsComponent.VERSION));
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

  private getSource(library: string, name: string, version: number) {
    const specificName = `ST_${name}`;
    return /*sql*/`
    --
    -- Subject: Run DSPPGMREF
    -- Author: Bob Cozzi
    --
    CREATE OR REPLACE FUNCTION ${library}.${name} (
                LIBRARY_NAME VARCHAR(10) DEFAULT '*LIBL',
                OBJECT_NAME VARCHAR(10), -- Required parameter
                OBJTYPE VARCHAR(60) DEFAULT '*ALL'
            )
        RETURNS TABLE (
            OBJNAME VARCHAR(10),
            OBJLIB VARCHAR(10),
            OBJTYPE VARCHAR(10),
            OBJTEXT VARCHAR(50),
            OBJREFCOUNT INT, -- Objects Referenced Count
            REFOBJNAME VARCHAR(11), -- Referenced Object name
            REFOBJLIB VARCHAR(11), -- Referenced Object Library
            REFOBJTYPE VARCHAR(10), -- Referenced Object Type
            REFSRCNAME VARCHAR(11), -- Ref Name as it appears in Src Pgm
            REFRCDFMT VARCHAR(10), -- Ref'd File's Record Format
            RCDFMT_COUNT INT, -- Record Fmts used by this Ref'd File
            FILE_USAGE VARCHAR(50), -- File Usage Input/Output/etc...
            LVLCHKID CHAR(13), -- Ref'd Files' RcdFmt LVLCHK ID
            FIELDS INT, -- Field Count in Ref'd File
            SYSNAME VARCHAR(8), -- System name of Ref'd object
            RETRIEVED_TIME TIMESTAMP(0) -- Time DSPPGMREF was run
        )
        LANGUAGE SQL
        MODIFIES SQL DATA
        NOT FENCED
        NOT DETERMINISTIC
        SPECIFIC ${specificName}
        -- Date Format ISO is required for dates prior to 1940.
        SET OPTION DATFMT = *ISO,
                   COMMIT = *NONE
        BEGIN
            DECLARE ERROR_CODE BIGINT DEFAULT 0;
            DECLARE PGMREFCMD VARCHAR(256);
            DECLARE REPL VARCHAR(10);
            DECLARE OBJ_NAME VARCHAR(11) NOT NULL DEFAULT '';
            DECLARE GEN INT NOT NULL DEFAULT 0;
            DECLARE DTS_FMT VARCHAR(26) NOT NULL DEFAULT 'YYYYMMDDHH24MISSFF12';
            BEGIN
                DECLARE CONTINUE HANDLER FOR SQLEXCEPTION SET ERROR_CODE = 2;

                -- Check OBJECT_NAME contains '%'
                --  If it does, use *ALL for object name,
                --  and add WHERE clause to the returned SELECT
                --    WHPNAM LIKE :objName
                IF (OBJECT_NAME IS NOT NULL
                        AND LENGTH(OBJECT_NAME) > 1) THEN
                    SET GEN = POSITION('%', OBJECT_NAME);
                    IF (GEN IS NOT NULL
                        AND GEN > 0
                        AND GEN <> LENGTH(OBJECT_NAME)) THEN
                        SET OBJ_NAME = '*ALL';
                    ELSEIF (GEN IS NOT NULL
                            AND GEN = LENGTH(OBJECT_NAME)) THEN
                        SET GEN = 0;
                        SET OBJ_NAME = RTRIM(OBJECT_NAME, '% ') CONCAT '*';
                    ELSE
                        SET GEN = 0;
                        SET OBJ_NAME = OBJECT_NAME;
                    END IF;
                END IF;
                IF (OBJ_NAME = '') THEN
                    SET OBJ_NAME = '*ALL';
                END IF;
                SET PGMREFCMD = 'QSYS/DSPPGMREF PGM(' CONCAT TRIM(LIBRARY_NAME) CONCAT '/' CONCAT OBJ_NAME CONCAT ') ' CONCAT 'OBJTYPE('
                            CONCAT OBJTYPE CONCAT ') ' CONCAT 'OUTPUT(*OUTFILE) ' CONCAT 'OUTFILE(QTEMP/ST_PGMREF2) ' CONCAT
                            'OUTMBR(*FIRST *REPLACE)';
                -- Using QCMDEXC requires this UDTF to be "MODIFIES SQL DATA"
                CALL QSYS2.QCMDEXC(PGMREFCMD);
            END;
            IF ERROR_CODE > 1 THEN
                SIGNAL SQLSTATE '42704'
                    SET MESSAGE_TEXT = 'FAILURE on DSPPGMREF cmd inside PGMREF UDTF';
            END IF;
            RETURN SELECT WHPNAM,
                          WHLIB,
                          CAST(
                              CASE
                                  WHEN WHSPKG = 'P' THEN '*PGM'
                                  WHEN WHSPKG = 'S' THEN '*SQLPKG'
                                  WHEN WHSPKG = 'V' THEN '*SRVPGM'
                                  WHEN WHSPKG = 'M' THEN '*MODULE'
                                  WHEN WHSPKG = 'Q' THEN '*QRYDFN'
                                  ELSE WHSPKG
                              END AS VARCHAR(10)),
                          WHTEXT,
                          CAST(WHFNUM AS INT), -- RefObj Count
                          CASE
                              WHEN WHFNAM = '1' THEN '*EXPR'
                              ELSE WHFNAM
                          END,
                          CASE
                              WHEN WHLNAM = '1' THEN '*EXPR'
                              ELSE WHLNAM
                          END,
                          WHOTYP,
                          CASE
                              WHEN WHSNAM = '1' THEN '*EXPR'
                              ELSE WHSNAM
                          END,
                          WHRFNM,
                          CAST(WHRFNB AS INT), -- RcdFmt Count
                          CAST(
                              --  1=I,2=O,3=I/O,4=U,5=I/U,6=O/U,7=I/O/U,8=N/S,0=N/A
                              --  (Apparently DELETE isn't supported; returned as UPDATE)
                              CASE
                                  WHEN WHFUSG = 0 THEN ' '
                                  WHEN WHFUSG = 1 THEN 'INPUT'
                                  WHEN WHFUSG = 2 THEN 'OUTPUT'
                                  WHEN WHFUSG = 3 THEN 'INPUT     OUTPUT'
                                  WHEN WHFUSG = 4 THEN 'UPDATE'
                                  WHEN WHFUSG = 5 THEN 'INPUT     UPDATE'
                                  WHEN WHFUSG = 6 THEN 'OUTPUT    UPDATE'
                                  WHEN WHFUSG = 7 THEN 'INPUT     OUTPUT    UPDATE'
                                  WHEN WHFUSG = 8 THEN 'N/S'
                                  ELSE 'UNKNOWN'
                              END AS VARCHAR(30)),
                          WHRFSN,
                          WHRFFN,
                          WHSYSN,
                          TIMESTAMP_FORMAT(SUBSTR(WHDTTM, 2, 12), 'YYMMDDHH24MISS', 0)
                    FROM QTEMP.ST_PGMREF2
                        -- Note: trim is used here so that the wildcard pattern
                        --       of '%XYZ' (which is 4 characters) matches a
                        --       WHPNAM value of 'EDTXYZ    '  using LIKE which is
                        --       not good at length mismatchs.
                    WHERE TRIM(WHPNAM) LIKE
                            CASE
                                WHEN GEN = 0 THEN TRIM(WHPNAM)
                                ELSE UPPER(OBJECT_NAME)
                            END
                    ORDER BY WHLIB,
                             WHPNAM,
                             WHLNAM,
                             WHFNAM;
        END;

    comment on function ${library}/${name} is '${version} - DSPPGMREF Wrapper';
    `;
  }
}
