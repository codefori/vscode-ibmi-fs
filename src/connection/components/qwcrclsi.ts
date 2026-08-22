import { IBMiComponent, SecureComponentState } from "@halcyontech/vscode-ibmi-types/api/components/component";
import IBMi from "@halcyontech/vscode-ibmi-types/api/IBMi";
import { posix } from "path";
import { getInstance } from "../../ibmi";

/**
 * Wraps the QWCRCLSI (Retrieve Class Information) API in an SQL stored
 * procedure, installed in the connection's temporary library.
 *
 * https://www.ibm.com/docs/api/v1/content/ssw_ibm_i_75/apis/qwcrclsi.htm
 */
export class QwcrclsiComponent implements IBMiComponent {
  static ID = "QWCRCLSI";
  private static readonly VERSION = 1;
  private static readonly SIGNATURE = "QSYS/QWCRCLSI";
  private static readonly TYPE = "PROCEDURE";
  static readonly PROCEDURE_NAME = `QWCRCLSI${QwcrclsiComponent.VERSION.toString().padStart(4, "0")}`;

  static async get(): Promise<QwcrclsiComponent | undefined> {
    return await getInstance()?.getConnection()?.getComponent<QwcrclsiComponent>(QwcrclsiComponent.ID);
  }

  private getLibrary(connection: IBMi) {
    return connection?.getConfig()?.tempLibrary.toUpperCase() || `ILEDITOR`;
  }

  getIdentification() {
    return {
      name: QwcrclsiComponent.ID,
      version: QwcrclsiComponent.VERSION,
      signature: QwcrclsiComponent.SIGNATURE,
    };
  }

  async getRemoteState(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    const remoteSignature = await connection.getContent().getSQLRoutineSignature(
      this.getLibrary(connection),
      QwcrclsiComponent.PROCEDURE_NAME,
      QwcrclsiComponent.TYPE,
    );
    return {
      status: remoteSignature ? "Installed" : "NotInstalled",
      remoteSignature: remoteSignature,
    };
  }

  async update(connection: IBMi, installDirectory: string): Promise<SecureComponentState> {
    return connection.withTempDirectory(async tempDir => {
      const tempSourcePath = posix.join(tempDir, `qwcrclsi.sql`);
      const library = this.getLibrary(connection);
      await connection.getContent().writeStreamfileRaw(tempSourcePath, this.getSource(library, QwcrclsiComponent.PROCEDURE_NAME, QwcrclsiComponent.VERSION));
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
    return /*sql*/`
    create or replace procedure ${library}.${name} (
        out BUF    char(112),
        in  BUFLEN integer,
        in  FORMAT char(8),
        in  QOBJ   char(20),
        in  EC     char(8) for bit data
      )
      language CL
      parameter style general
      program type main
      external name 'QSYS/QWCRCLSI';

    comment on procedure ${library}/${name} is '${version} - QWCRCLSI (Retrieve Class Information) Wrapper';
    `;
  }
}
