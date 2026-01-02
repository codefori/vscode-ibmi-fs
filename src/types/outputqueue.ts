/**
 * Output Queue Management Module
 *
 * This module provides comprehensive functionality for managing IBM i Output Queues (OUTQ),
 * their spooled files, and associated printer writers.
 *
 * Key Features:
 * - Display output queue information and statistics
 * - List all spooled files in a queue with details
 * - Hold/Release/Clear output queues
 * - Start/Stop printer writers
 * - Generate PDF from spooled files
 * - Delete individual or old spooled files
 * - Dynamic UI based on queue and writer status
 *
 * @module outputqueue
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, generateFastTable, FastTableColumn } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

// Action constants for output queue operations
const ACTION_CLR = "clr";     // Clear output queue action
const ACTION_DLT = "dltold";  // Delete old spools action
const ACTION_HLD = "hld";     // Hold output queue action
const ACTION_RLS = "rls";     // Release output queue action
const ACTION_STR = "str";     // Start writer action
const ACTION_END = "end";     // End writer action

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
      vscode.commands.registerCommand("vscode-ibmi-fs.ClrOutq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await clrOutq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return clrOutq(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.HldOutq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await hldOutq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return hldOutq(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.RlsOutq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await rlsOutq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return rlsOutq(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.MngWtr", async (item?: IBMiObject | vscode.Uri, nettype?: String) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await mngWtr({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return strWtr(item, nettype);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.EndWtr", endWtr),
      vscode.commands.registerCommand("vscode-ibmi-fs.GenPdf", genPdf),
      vscode.commands.registerCommand("vscode-ibmi-fs.DelSpool", delSpool),
      vscode.commands.registerCommand("vscode-ibmi-fs.DelOldSpool", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await delOldSpl({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return delOldSpl(item);
        }
      }),
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
        const cmdrun: CommandResult = await connection.runCommand({
          command: `CLROUTQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Output Queue ${library}/${name} cleared.`);
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
   * Hold an Output Queue
   * Prevents new spooled files from being written to the queue
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const hldOutq = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    // Show confirmation dialog to prevent accidental holds
    if (await vscode.window.showWarningMessage(`Are you sure you want to hold Output Queue ${library}/${name}?`, { modal: true }, "Hold OUTQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        // Execute HLDOUTQ command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `HLDOUTQ OUTQ(${library}/${name})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Output Queue ${library}/${name} held.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to hold Output Queue ${library}/${name}`);
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
   * Release an Output Queue
   * Allows spooled files to be written to the queue again
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const rlsOutq = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    // Show confirmation dialog
    if (await vscode.window.showWarningMessage(`Are you sure you want to release Output Queue ${library}/${name}?`, { modal: true }, "Release OUTQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        // Execute RLSOUTQ command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `RLSOUTQ OUTQ(${library}/${name})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Output Queue ${library}/${name} released.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to release Output Queue ${library}/${name}`);
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
   * Manage printer writer (start or stop based on current state)
   * Automatically determines whether to start or stop the writer based on the current number of active writers
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const mngWtr = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Query output queue to get writer information
      let outq = await connection.runSQL(
        `SELECT NETWORK_CONNECTION_TYPE, NUMBER_OF_WRITERS
          FROM QSYS2.OUTPUT_QUEUE_INFO
          WHERE OUTPUT_QUEUE_NAME = '${name}' AND OUTPUT_QUEUE_LIBRARY_NAME = '${library}'
          FETCH FIRST ROW ONLY`);
      // Get network connection type (null for local printers)
      let nettype = outq[0].NETWORK_CONNECTION_TYPE ? String(outq[0].NETWORK_CONNECTION_TYPE) : null;
      // Get current number of active writers
      let nbr = outq[0].NUMBER_OF_WRITERS || Number(outq[0].NUMBER_OF_WRITERS) === 0 ? Number(outq[0].NUMBER_OF_WRITERS) : 1;

      // Check if there's a writer configured for this output queue
      if(!nettype){
        vscode.window.showErrorMessage(`No writer to manage`);
        return false;
      } else if(nbr === 0){
        // No writers running, start one
        return strWtr(item, nettype);
      } else {
        // Writer(s) running, stop them
        return endWtr(item);
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
    
  };

  /**
   * End (stop) a printer writer
   * Immediately stops the writer associated with the output queue
   * @param item - The Output Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const endWtr = async (item: IBMiObject | Outq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    // Show confirmation dialog to prevent accidental termination
    if (await vscode.window.showWarningMessage(`Are you sure you want to end writer ${name}?`, { modal: true }, "End Writer")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        // Execute ENDWTR command with immediate option
        const cmdrun: CommandResult = await connection.runCommand({
          command: `ENDWTR WTR(${name}) OPTION(*IMMED)`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Writer ${name} ended.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to end writer ${name}`);
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
   * Start a printer writer
   * Starts either a remote or local printer writer based on network connection type
   * @param item - The Output Queue object or IBMiObject
   * @param nettype - Network connection type (optional, will be fetched if not provided)
   * @returns True if successful, false otherwise
   */
  export const strWtr = async (item: IBMiObject | Outq, nettype?: String): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    // Show confirmation dialog
    if (await vscode.window.showWarningMessage(`Are you sure you want to start writer ${name}?`, { modal: true }, "Start Writer")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {

        // Choose command based on network type:
        // - STRRMTWTR for remote/network printers
        // - STRPRTWTR for local printer devices
        let cmd = nettype && nettype !== undefined ? `STRRMTWTR OUTQ(${library}/${name})`:`STRPRTWTR DEV(${name})`;
        const cmdrun: CommandResult = await connection.runCommand({
          command: cmd,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Writer ${name} started.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to start writer ${name}`);
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
        const cmdrun: CommandResult = await connection.runCommand({
          command: `DLTSPLF FILE(${item.spoolname}) JOB(${item.job}) SPLNBR(${item.nbr})`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
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
        title: `PDF genaration`
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
      { title: "Detail", content: this.renderJobQueuePanel() },
      { title: "Spools", badge: this._entries.length, content: this.renderEntries(this._entries) }
    ]);
  }

  /**
   * Render the output queue information panel
   * @returns HTML string for the panel
   */
  /**
   * Render the output queue information panel with dynamic actions
   * Actions are conditionally displayed based on queue status and writer configuration
   * @returns HTML string for the panel
   * @private
   */
  private renderJobQueuePanel(): string {
    // Generate the detail table with queue information and action buttons
    return generateDetailTable({
      title: `Output Queue: ${this.library}/${this.name}`,
      subtitle: 'Output Queue Information',
      columns: this.columns,
      data: this.outq,
      actions: [],
      //actions: actions,
      hideNullValues: true
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
   * Render the spooled files table with action buttons
   * Each spool row displays download and delete actions
   * @param entries - Array of spooled file entries to display
   * @returns HTML string for the table
   */
  renderEntries(entries: Entry[]) {
    // Define table columns with their properties
    const columns: FastTableColumn<Entry>[] = [
      { title: "Name", width: "1fr", getValue: e => e.spoolname },
      { title: "Data", width: "1fr", getValue: e => e.spooldta },
      { title: "Status", width: "0.5fr", getValue: e => e.spoolsts },
      { title: "User", width: "1fr", getValue: e => e.spooluser },
      { title: "Job", width: "2fr", getValue: e => e.job },
      { title: "Number", width: "0.7fr", getValue: e => String(e.nbr) },
      { title: "Timestamp", width: "1.5fr", getValue: e => e.spoolts },
      { title: "Pages", width: "0.5fr", getValue: e => String(e.pages) },
      { title: "Size (KB)", width: "1fr", getValue: e => String(e.spoolsiz) },
      {
        title: "Actions",
        width: "1fr",
        getValue: e => {
          // Encode spool entry as URL parameter for action handlers
          const arg = encodeURIComponent(JSON.stringify(e));
          return `<vscode-button appearance="primary" href="action:genPdf?entry=${arg}">Download ⬇️</vscode-button>
                <vscode-button appearance="secondary" href="action:delPdf?entry=${arg}">Delete ❌</vscode-button>`;
        }
      }
    ];

    // Custom CSS styles for the output queue entries table
    const customStyles = `
        /* Highlight spool names with link color for better visibility */
        .outq-entries-table vscode-data-grid-cell[grid-column="1"] {
            color: var(--vscode-textLink-foreground);
        }
        `;

    // Generate and return the complete table HTML
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
   * Routes action requests to appropriate handlers and manages UI refresh
   * @param data - Action data from the webview containing href with action type and parameters
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // Parse the action URL to extract action type and parameters
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;  // Flag to determine if data needs to be refetched
    const params = new URLSearchParams(uri.query);
    let entryJson;
    
    // Route to appropriate action handler based on action type
    switch (uri.path) {
      // Output Queue level actions
      case ACTION_CLR:
        // Clear all spools from the queue
        if (await OutputQueueActions.clrOutq(this)) {
          refetch = true;
        }
        break;

      case ACTION_DLT:
        // Delete old spools based on age
        if (await OutputQueueActions.delOldSpl(this)) {
          refetch = true;
        }
        break;

      case ACTION_HLD:
        // Hold the output queue
        if (await OutputQueueActions.hldOutq(this)) {
          refetch = true;
        }
        break;

      case ACTION_RLS:
        // Release the output queue
        if (await OutputQueueActions.rlsOutq(this)) {
          refetch = true;
        }
        break;
      
      case ACTION_STR:
        // Start the printer writer
        if (await OutputQueueActions.strWtr(this, this.outq[0].NETWORK_CONNECTION_TYPE)) {
          refetch = true;
        }
        break;

      case ACTION_END:
        // End (stop) the printer writer
        if (await OutputQueueActions.endWtr(this)) {
          refetch = true;
        }
        break;

      // Individual spool file actions
      case "genPdf":
        // Generate and download PDF from spool file
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          await OutputQueueActions.genPdf(entry)
        }
        break;

      case "delPdf":
        // Delete a specific spool file
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if (await OutputQueueActions.delSpool(entry)) {
            refetch = true;
          }
        }
        break;
    }

    // If any action was successful, refetch data to update the UI
    if (refetch) {
      await this.fetch();
    }
    
    // Return result indicating whether the UI should be re-rendered
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for output queues)
   * Output queues are managed through IBM i commands, not direct editing
   */
  async save(): Promise<void> {
    // Output queues are read-only in this view
    // All modifications are done through IBM i commands (CLROUTQ, HLDOUTQ, etc.)
  }
}
