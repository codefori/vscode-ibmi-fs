import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, generateFastTable, FastTableColumn } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_CLR = "clr";
const ACTION_DLT = "dltold";

/**
 * Namespace containing actions for Output Queue objects
 */
export namespace OutputQueueActions {
  /**
   * Register Output Queue commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.ClrOutq", clrOutq),
      vscode.commands.registerCommand("vscode-ibmi-fs.GenPdf", genPdf),
      vscode.commands.registerCommand("vscode-ibmi-fs.DelSpool", delSpool),
      vscode.commands.registerCommand("vscode-ibmi-fs.DelOldSpool", delOldSpl),
    );
  };

  /**
   * Clear all spooled files from an Output Queue
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const clrOutq = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    if (await vscode.window.showWarningMessage(`Are you sure you want to clear Output Queue ${library}/${name}?`, { modal: true }, "Clear OUTQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const hldjobq: CommandResult = await connection.runCommand({
          command: `CLROUTQ ${library}/${name}`,
          environment: `ile`
        });

        if (hldjobq.code === 0) {
          vscode.window.showInformationMessage(`Output Queue ${library}/${name} held.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to clear Output Queue ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
      return false;
    }
  };

  /**
   * Delete old spooled files from an Output Queue
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const delOldSpl = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const days = await vscode.window.showInputBox({
      placeHolder: "xxx days",
      title: `Days after which to delete spools`,
      validateInput: days => {
        if (isNaN(Number(days)) || Number(days) < 1) {
          return `The number of days should be bigger than 0`;
        }
      }
    });

    if (await vscode.window.showWarningMessage(`Are you sure you want to delete spools that are older than ${days} days from Output Queue ${library}/${name}?`, { modal: true }, "Delete old spools")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        try {
          await connection.runSQL(`CALL SYSTOOLS.DELETE_OLD_SPOOLED_FILES(DELETE_OLDER_THAN => CURRENT DATE - ${days} DAYS,
                                        P_OUTPUT_QUEUE_NAME => '${name}',
                                        P_OUTPUT_QUEUE_LIBRARY_NAME => '${library}',
                                        PREVIEW => 'NO')`);
          vscode.window.showInformationMessage(`Old spools from ${library}/${name} deleted.`);
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(`An error occurred while deleting old spool in OUTQ ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
      return false;
    }
  };

  /**
   * Delete a specific spooled file
   * @param item - The spool entry to delete
   * @returns True if successful, false otherwise
   */
  export const delSpool = async (item: Entry): Promise<boolean> => {
    if (await vscode.window.showWarningMessage(`Are you sure you want to delete spool ${item.spoolname} number ${item.nbr} of job ${item.job}?`, { modal: true }, "Delete spool")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const hldjobq: CommandResult = await connection.runCommand({
          command: `DLTSPLF FILE(${item.spoolname}) JOB(${item.job}) SPLNBR(${item.nbr})`,
          environment: `ile`
        });

        if (hldjobq.code === 0) {
          vscode.window.showInformationMessage(`Spool deleted.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to delete selected spool.`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
      return false;
    }
  };

  /**
   * Generate and download a PDF from a spooled file
   * @param item - The spool entry to convert to PDF
   * @returns True if successful, false otherwise
   */
  export const genPdf = async (item: Entry): Promise<boolean> => {
    let name = 'generatedPDF'

    const saveLocation = await vscode.window.showSaveDialog({
      title: "Download PDF File",
      defaultUri: vscode.Uri.file(`${name}.pdf`),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      filters: { 'PDF': ["pdf"] }
    });

    if (saveLocation) {
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Generating PDF...`
      }, async progress => {
        const result = {
          successful: true,
          error: ''
        };

        const ibmi = getInstance();
        const connection = ibmi?.getConnection();
        if (connection) {
          const config = connection.getConfig();
          const tempRemotePath = config.tempDir + '/' + item.job.replaceAll("/", "_") + '_' + item.spoolname + '_' + item.nbr + '.pdf';

          progress.report({ message: 'Generating PDF...' });
          const genpdf = await connection.runSQL(` select SYSTOOLS.GENERATE_PDF(
                            JOB_NAME            => '${item.job}',
                            SPOOLED_FILE_NAME   => '${item.spoolname}',
                            SPOOLED_FILE_NUMBER => '${item.nbr}',
                            PATH_NAME           => '${tempRemotePath}') as SENT
                            FROM SYSIBM.SYSDUMMY1`);

          if (genpdf[0].SENT === 1) {
            try {
              progress.report({ message: 'Downloading PDF...' });
              await connection.client.getFile(saveLocation.fsPath, tempRemotePath);
            } catch (error) {
              result.successful = false;
              result.error = String(error);
            }
            finally {
              await connection.runCommand({
                command: `rm -f ${tempRemotePath}`,
                environment: `pase`
              });
            }
          }
          else {
            result.successful = false;
            result.error = `PDF generation failed`;
          }
        }
        else {
          result.successful = false;
          result.error = `No connection`;
        }
        return result;
      });

      if (result.successful) {
        vscode.window.showInformationMessage(`PDF successfully generated.`);
        return true;
      }
      else {
        vscode.window.showErrorMessage(`Failed to generate PDF`);
        return false;
      }
    } else {
      return false;
    }
  };
}

/**
 * Interface representing a spooled file entry
 */
interface Entry {
  /** Timestamp when spool was created */
  spoolts: string
  /** Spooled file name */
  spoolname: string
  /** User who created the spool */
  spooluser: string
  /** User data associated with the spool */
  spooldta: string
  /** Spool status */
  spoolsts: string
  /** Spool size in KB */
  spoolsiz: number
  /** Number of pages */
  pages: number
  /** Job name that created the spool */
  job: string
  /** Spool file number */
  nbr: number
}

/**
 * Output Queue (OUTQ) object class
 * Handles display and management of IBM i Output Queues and their spooled files
 */
export default class Outq extends Base {
  /** Output queue information from database */
  private outq?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Array of spooled file entries */
  private _entries: Entry[] = [];

  /**
   * Fetch output queue information and spooled files
   */
  async fetch() {
    await this.fetchInfo();
    await this.fetchSpools();
  }

  /**
   * Fetch output queue metadata from IBM i
   */
  async fetchInfo(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'OUTPUT_QUEUE_INFO');

      this.outq = await connection.runSQL(
        `select NUMBER_OF_FILES,
            NUMBER_OF_WRITERS,
            WRITERS_TO_AUTOSTART,
            PRINTER_DEVICE_NAME,
            ORDER_OF_FILES,
            OUTPUT_QUEUE_STATUS,
            WRITER_JOB_NAME,
            WRITER_JOB_STATUS,
            WRITER_TYPE,
            SPOOLED_FILE_ASP_ATTRIBUTE,
            SPOOLED_FILE_ASP_NUMBER,
            SPOOLED_FILE_ASPGRP,
            TEXT_DESCRIPTION,
            MESSAGE_QUEUE_LIBRARY,
            MESSAGE_QUEUE_NAME,
            NETWORK_CONNECTION_TYPE,
            DESTINATION_TYPE,
            REMOTE_SYSTEM_NAME,
            REMOTE_PRINTER_QUEUE,
            INTERNET_ADDRESS,
            DESTINATION_OPTIONS
            from QSYS2.OUTPUT_QUEUE_INFO
            WHERE OUTPUT_QUEUE_NAME = '${this.name}' AND OUTPUT_QUEUE_LIBRARY_NAME = '${this.library}'
            Fetch first row only`)
    }
  }

  /**
   * Fetch all spooled files in the output queue
   */
  async fetchSpools(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const entryRows = await connection.runSQL(
        `select to_char(CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as CREATE_TIMESTAMP,
            SPOOLED_FILE_NAME,
            USER_NAME,
            USER_DATA,
            STATUS,
            SIZE,
            TOTAL_PAGES,
            JOB_NAME,
            FILE_NUMBER from QSYS2.OUTPUT_QUEUE_ENTRIES_BASIC
            WHERE OUTPUT_QUEUE_NAME = '${this.name}' AND OUTPUT_QUEUE_LIBRARY_NAME = '${this.library}'`)
      this._entries = [];

      this._entries.push(...entryRows.map(this.toEntry));
    }
  }

  /**
   * Generate HTML for the output queue view with tabs
   * @returns HTML string
   */
  generateHTML(): string {
    return Components.panels([
      { title: "Output Queue", content: this.renderJobQueuePanel() },
      { title: "Spools", badge: this._entries.length, content: this.renderEntries(this._entries) }
    ]);
  }

  /**
   * Render the output queue information panel
   * @returns HTML string for the panel
   */
  private renderJobQueuePanel(): string {
    return generateDetailTable({
      title: `Output Queue: ${this.library}/${this.name}`,
      subtitle: 'Output Queue Information',
      columns: this.columns,
      data: this.outq,
      actions: [
        {
          label: 'Delete old spools 📆',
          action: ACTION_DLT,
          appearance: 'secondary',
          style: 'width: 100%; text-align: center;'
        },
        {
          label: 'Clear 🧹',
          action: ACTION_CLR,
          appearance: 'secondary',
          style: 'width: 100%; text-align: center;'
        }
      ]
    });
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from QSYS2.OUTPUT_QUEUE_ENTRIES_BASIC
   * @returns Entry object
   */
  private toEntry(row: Tools.DB2Row): Entry {
    return {
      spoolts: String(row.CREATE_TIMESTAMP),
      spoolname: String(row.SPOOLED_FILE_NAME),
      spooluser: String(row.USER_NAME),
      spooldta: String(row.USER_DATA),
      spoolsts: String(row.STATUS),
      spoolsiz: Number(row.SIZE),
      pages: Number(row.TOTAL_PAGES),
      job: String(row.JOB_NAME),
      nbr: Number(row.FILE_NUMBER),
    };
  }

  /**
   * Render the spooled files table
   * @param entries - Array of spooled file entries
   * @returns HTML string for the table
   */
  renderEntries(entries: Entry[]) {
    const columns: FastTableColumn<Entry>[] = [
      { title: "Name", width: "1fr", getValue: e => e.spoolname },
      { title: "Data", width: "1fr", getValue: e => e.spooldta },
      { title: "Status", width: "0.5fr", getValue: e => e.spoolsts },
      { title: "User", width: "1fr", getValue: e => e.spooluser },
      { title: "Job", width: "2fr", getValue: e => e.job },
      { title: "Number", width: "0.7fr", getValue: e => String(e.nbr) },
      { title: "Timestamp", width: "2fr", getValue: e => e.spoolts },
      { title: "Pages", width: "0.5fr", getValue: e => String(e.pages) },
      { title: "Size (KB)", width: "1fr", getValue: e => String(e.spoolsiz) },
      {
        title: "Actions",
        width: "1fr", getValue: e => {
          const arg = encodeURIComponent(JSON.stringify(e));
          return `<vscode-button appearance="primary" href="action:genPdf?entry=${arg}">Download ⬇️</vscode-button>
                <vscode-button appearance="secondary" href="action:delPdf?entry=${arg}">Delete ❌</vscode-button>`;
        }
      }
    ];

    const customStyles = `
        /* Custom styles for cells - specific to outq entries table */
        .outq-entries-table vscode-data-grid-cell[grid-column="1"] {
            color: var(--vscode-textLink-foreground);
        }
        `;

    return `<div class="outq-entries-table">` + generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: 'No spools found in this outq.',
      customStyles: customStyles,
      customScript: ""
    }) + `</div>`;
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;
    const params = new URLSearchParams(uri.query);
    let entryJson;
    switch (uri.path) {
      case ACTION_CLR:
        if (await OutputQueueActions.clrOutq(this)) {
          refetch = true;
        }
        break;

      case ACTION_DLT:
        if (await OutputQueueActions.delOldSpl(this)) {
          refetch = true;
        }
        break;

      case "genPdf":
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          await OutputQueueActions.genPdf(entry)
        }
        break;

      case "delPdf":
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if (await OutputQueueActions.delSpool(entry)) {
            refetch = true;
          }
        }
        break;
    }

    if (refetch) {
      await this.fetch();
    }
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for output queues)
   */
  async save(): Promise<void> {
    // Output queues are read-only in this view
  }
}
