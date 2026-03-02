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
import { getColumns, generateDetailTable, generateFastTable, FastTableColumn, getProtected, checkTableFunctionExists, checkViewExists, checkProcedureExists, executeSqlIfExists } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

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

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to clear Output Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Clear OUTQ"))) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `CLROUTQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Output Queue {0}/{1} cleared.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to clear Output Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }
      
      // Show confirmation dialog to prevent accidental holds
      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to hold Output Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Hold OUTQ"))) {

        // Execute HLDOUTQ command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `HLDOUTQ OUTQ(${library}/${name})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Output Queue {0}/{1} held.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to hold Output Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to release Output Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Release OUTQ"))) {
        // Execute RLSOUTQ command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `RLSOUTQ OUTQ(${library}/${name})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Output Queue {0}/{1} released.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to release Output Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Unable to hold Output Queue {0}/{1}", library, name));
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
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      // Query output queue to get writer information
      let outq = await executeSqlIfExists(
        connection,
        `SELECT NETWORK_CONNECTION_TYPE, NUMBER_OF_WRITERS
          FROM QSYS2.OUTPUT_QUEUE_INFO
          WHERE OUTPUT_QUEUE_NAME = '${name}' AND OUTPUT_QUEUE_LIBRARY_NAME = '${library}'
          FETCH FIRST ROW ONLY`,
        'QSYS2',
        'OUTPUT_QUEUE_INFO',
        'VIEW'
      );

      if (outq === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OUTPUT_QUEUE_INFO"));
        return false;
      }

      // Get network connection type (null for local printers)
      let nettype = outq[0].NETWORK_CONNECTION_TYPE ? String(outq[0].NETWORK_CONNECTION_TYPE) : null;
      // Get current number of active writers
      let nbr = outq[0].NUMBER_OF_WRITERS || Number(outq[0].NUMBER_OF_WRITERS) === 0 ? Number(outq[0].NUMBER_OF_WRITERS) : 1;

      // Check if there's a writer configured for this output queue
      if(!nettype){
        vscode.window.showErrorMessage(vscode.l10n.t("No writer to manage"));
        return false;
      } else if(nbr === 0){
        // No writers running, start one
        return strWtr(item, nettype);
      } else {
        // Writer(s) running, stop them
        return endWtr(item);
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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
    if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to end writer {0}?", name), { modal: true }, vscode.l10n.t("End Writer"))) {
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
          vscode.window.showInformationMessage(vscode.l10n.t("Writer {0} ended.", name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to end writer {0}:\n{1}", name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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
    if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to start writer {0}?", name), { modal: true }, vscode.l10n.t("Start Writer"))) {
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
          vscode.window.showInformationMessage(vscode.l10n.t("Writer {0} started.", name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to start writer {0}:\n{1}", name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      const days = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("xxx days"),
        title: vscode.l10n.t("Days after which to delete spools"),
        validateInput: days => {
          if (isNaN(Number(days)) || Number(days) < 1) {
            return vscode.l10n.t("The number of days should be bigger than 0");
          }
        }
      });

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to delete spools that are older than {0} days from Output Queue {1}/{2}?", String(days), library, name), { modal: true }, vscode.l10n.t("Delete old spools"))) {
        try {
          const result = await executeSqlIfExists(
            connection,
            `CALL SYSTOOLS.DELETE_OLD_SPOOLED_FILES(DELETE_OLDER_THAN => CURRENT DATE - ${days} DAYS,
                                        P_OUTPUT_QUEUE_NAME => '${name}',
                                        P_OUTPUT_QUEUE_LIBRARY_NAME => '${library}',
                                        PREVIEW => 'NO')`,
            'SYSTOOLS',
            'DELETE_OLD_SPOOLED_FILES',
            'PROCEDURE'
          );

          if (result === null) {
            vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "SYSTOOLS", "DELETE_OLD_SPOOLED_FILES"));
            return false;
          }

          vscode.window.showInformationMessage(vscode.l10n.t("Old spools from {0}/{1} deleted.", library, name));
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(vscode.l10n.t("An error occurred while deleting old spool in OUTQ {0}/{1}", library, name));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Delete a specific spooled file
   * @param item - The spool entry to delete
   * @returns True if successful, false otherwise
   */
  export const delSpool = async (item: Entry): Promise<boolean> => {
    if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to delete spool {0} number {1} of job {2}?", item.spoolname, String(item.nbr), item.job), { modal: true }, vscode.l10n.t("Delete spool"))) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `DLTSPLF FILE(${item.spoolname}) JOB(${item.job}) SPLNBR(${item.nbr})`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Spool deleted."));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to delete selected spool:\n{0}", String(cmdrun.stderr)));
          return false;
        }
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
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

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if GENERATE_PDF function exists
      const functionExists = await checkTableFunctionExists(connection, 'SYSTOOLS', 'GENERATE_PDF');
      if (!functionExists) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "SYSTOOLS", "GENERATE_PDF"));
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    const saveLocation = await vscode.window.showSaveDialog({
      title: vscode.l10n.t("Download PDF File"),
      defaultUri: vscode.Uri.file(`${name}.pdf`),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      filters: { 'PDF': ["pdf"] }
    });

    if (saveLocation) {
      const result = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("PDF generation")
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

          progress.report({ message: vscode.l10n.t("Generating PDF...") });
          const genpdf = await connection.runSQL(` select SYSTOOLS.GENERATE_PDF(
                            JOB_NAME            => '${item.job}',
                            SPOOLED_FILE_NAME   => '${item.spoolname}',
                            SPOOLED_FILE_NUMBER => '${item.nbr}',
                            PATH_NAME           => '${tempRemotePath}') as SENT
                            FROM SYSIBM.SYSDUMMY1`);

          if (genpdf[0].SENT === 1) {
            try {
              progress.report({ message: vscode.l10n.t("Downloading PDF...") });
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
            result.error = vscode.l10n.t("PDF generation failed");
          }
        } else {
          result.successful = false;
          result.error = vscode.l10n.t("Not connected to IBM i");
        }
        return result;
      });

      if (result.successful) {
        vscode.window.showInformationMessage(vscode.l10n.t("PDF successfully generated."));
        return true;
      }
      else {
        vscode.window.showErrorMessage(vscode.l10n.t("Failed to generate PDF"));
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
   * Fetch only searchable data (spools) without reloading queue info
   * This avoids reloading the Detail tab when searching/paginating in the Spools tab
   */
  async fetchSearchData(): Promise<void> {
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

      this.outq = await executeSqlIfExists(
        connection,
        `select NUMBER_OF_FILES,
            NUMBER_OF_WRITERS,
            WRITERS_TO_AUTOSTART,
            PRINTER_DEVICE_NAME,
            ORDER_OF_FILES,
            OUTPUT_QUEUE_STATUS,
            WRITER_JOB_NAME,
            WRITER_JOB_STATUS,
            WRITER_TYPE,
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
            Fetch first row only`,
        'QSYS2',
        'OUTPUT_QUEUE_INFO',
        'VIEW'
      );

      if (this.outq === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OUTPUT_QUEUE_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch all spooled files in the output queue
   * Supports server-side search and pagination
   */
  async fetchSpools(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      // Build WHERE clause with base conditions
      let whereClause = `OUTPUT_QUEUE_NAME = '${this.name}' AND OUTPUT_QUEUE_LIBRARY_NAME = '${this.library}'`;

      // Add search filter if present
      if (this.searchTerm && this.searchTerm.trim() !== '' && this.searchTerm.trim() !== '-') {
        const searchPattern = `%${this.searchTerm.trim().toUpperCase()}%`;
        whereClause += ` AND (
          UPPER(SPOOLED_FILE_NAME) LIKE '${searchPattern}' OR
          UPPER(USER_NAME) LIKE '${searchPattern}' OR
          UPPER(USER_DATA) LIKE '${searchPattern}' OR
          UPPER(STATUS) LIKE '${searchPattern}' OR
          UPPER(JOB_NAME) LIKE '${searchPattern}'
        )`;
      }

      // Get total count for pagination
      const countRows = await executeSqlIfExists(
        connection,
        `SELECT COUNT(*) as TOTAL FROM QSYS2.OUTPUT_QUEUE_ENTRIES_BASIC WHERE ${whereClause}`,
        'QSYS2',
        'OUTPUT_QUEUE_ENTRIES_BASIC',
        'VIEW'
      );

      if (countRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OUTPUT_QUEUE_ENTRIES_BASIC"));
        return;
      }

      this.totalItems = countRows.length > 0 ? Number(countRows[0].TOTAL) : 0;

      // Calculate OFFSET for pagination
      const offset = (this.currentPage - 1) * this.itemsPerPage;

      // Fetch paginated data
      const entryRows = await executeSqlIfExists(
        connection,
        `select to_char(CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as CREATE_TIMESTAMP,
            SPOOLED_FILE_NAME,
            USER_NAME,
            USER_DATA,
            STATUS,
            SIZE,
            TOTAL_PAGES,
            JOB_NAME,
            FILE_NUMBER from QSYS2.OUTPUT_QUEUE_ENTRIES_BASIC
            WHERE ${whereClause}
            ORDER BY CREATE_TIMESTAMP DESC
            LIMIT ${this.itemsPerPage} OFFSET ${offset}`,
        'QSYS2',
        'OUTPUT_QUEUE_ENTRIES_BASIC',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OUTPUT_QUEUE_ENTRIES_BASIC"));
        return;
      }

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
      { title: vscode.l10n.t("Detail"), content: this.renderJobQueuePanel() },
      { title: vscode.l10n.t("Spools"), badge: this.totalItems, content: this.renderEntries(this._entries) }
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
      subtitle: vscode.l10n.t('Output Queue Information'),
      columns: this.columns,
      data: this.outq,
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
      { title: vscode.l10n.t("Name"), width: "1fr", getValue: e => e.spoolname },
      { title: vscode.l10n.t("Data"), width: "1fr", getValue: e => e.spooldta },
      { title: vscode.l10n.t("Status"), width: "0.5fr", getValue: e => e.spoolsts },
      { title: vscode.l10n.t("User"), width: "1fr", getValue: e => e.spooluser },
      { title: vscode.l10n.t("Job"), width: "2fr", getValue: e => e.job },
      { title: vscode.l10n.t("Number"), width: "0.7fr", getValue: e => String(e.nbr) },
      { title: vscode.l10n.t("Timestamp"), width: "1.5fr", getValue: e => e.spoolts },
      { title: vscode.l10n.t("Pages"), width: "0.5fr", getValue: e => String(e.pages) },
      { title: vscode.l10n.t("Size (KB)"), width: "1fr", getValue: e => String(e.spoolsiz) },
      {
        title: vscode.l10n.t("Actions"),
        width: "1fr",
        getValue: e => {
          // Encode spool entry as URL parameter for action handlers
          const arg = encodeURIComponent(JSON.stringify(e));
          return `<vscode-button appearance="primary" href="action:genPdf?entry=${arg}">${vscode.l10n.t("Download")} ⬇️</vscode-button>
                <vscode-button appearance="secondary" href="action:delPdf?entry=${arg}">${vscode.l10n.t("Delete")} ❌</vscode-button>`;
        }
      }
    ];

    // Custom CSS styles for the output queue entries table
    const customStyles = `
        /* Highlight spool names with link color for better visibility */
        .outq-entries-table vscode-table-cell:first-child {
            color: var(--vscode-textLink-foreground);
        }
        `;

    // Generate and return the complete table HTML
    return `<div class="outq-entries-table">` + generateFastTable({
      title: ``,
      subtitle: vscode.l10n.t("Total Spools: {0}", String(this.totalItems)),
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t("No spools found in this outq."),
      customStyles: customStyles,
      enableSearch: true,
      searchPlaceholder: vscode.l10n.t("Search spools..."),
      enablePagination: true,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm
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
