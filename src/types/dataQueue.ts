/**
 * Data Queue Management Module
 *
 * This module provides functionality for managing IBM i Data Queues (DTAQ).
 * Data Queues are objects used for inter-process communication, allowing programs
 * to send and receive messages asynchronously.
 *
 * Key Features:
 * - Display data queue information and attributes
 * - View messages in the queue
 * - Send new messages to the queue
 * - Clear all messages from the queue
 * - Support for keyed and non-keyed data queues
 *
 * @module dataqueue
 */

import { IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, getProtected, checkProcedureExists, checkTableFunctionExists, checkViewExists } from "../tools";
import ObjectProvider from '../objectProvider';
import { t } from '../l10n';

/**
 * Namespace containing actions for Data Queue objects
 */
export namespace DataQueueActions {
  /**
   * Register Data Queue commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.sendToDataQueue", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const dtaq: Dtaq = new Dtaq(item, library, name);
            await dtaq.fetchInfo();
            const result = await sendToDataQueue(dtaq);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu
          return sendToDataQueue(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.clearDataQueue", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const dtaq: Dtaq = new Dtaq(item, library, name);
            await dtaq.fetchInfo();
            const result = await clearDataQueue(dtaq);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu
          return clearDataQueue(item);
        }
      }),
    );
  };

  /**
   * Clear all messages from a Data Queue
   * @param item - The Data Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const clearDataQueue = async (item: IBMiObject | Dtaq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(t("Unable to perform object action because it is protected."));
        return false;
      }

      // Check if CLEAR_DATA_QUEUE procedure exists
      const procedureExists = await checkProcedureExists(connection, 'QSYS2', 'CLEAR_DATA_QUEUE');
      if (!procedureExists) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "QSYS2", "CLEAR_DATA_QUEUE"));
        return false;
      }

      if (await vscode.window.showWarningMessage(t("Are you sure you want to clear Data Queue {0}/{1}?", library, name), { modal: true }, t("Clear DTAQ"))) {
        try {
          await connection.runSQL(`Call QSYS2.CLEAR_DATA_QUEUE('${name}', '${library}');`);
          vscode.window.showInformationMessage(t("Data Queue {0}/{1} cleared.", library, name));
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(t("An error occurred while clearing DTAQ {0}/{1}", library, name));
          return false;
       }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Send a message to a Data Queue
   * @param item - The Data Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const sendToDataQueue = async (item: IBMiObject | Dtaq): Promise<boolean> => {

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(t("Unable to perform object action because it is protected."));
        return false;
      }

      if ("keyed" in item) {
        return _sendToDataQueue(item);
      }
      else {
        const dataQueue: Dtaq = new Dtaq(vscode.Uri.file(''), item.library.toUpperCase(), item.name.toUpperCase());
        await dataQueue.fetchInfo();
        return _sendToDataQueue(dataQueue);
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Internal function to send a message to a Data Queue
   * @param dataQueue - The Data Queue object
   * @returns True if successful, false otherwise
   */
  export const _sendToDataQueue = async (dataQueue: Dtaq): Promise<boolean> => {
    // Get key data if this is a keyed data queue
    const key = dataQueue.keyed ? await vscode.window.showInputBox({
      placeHolder: t("key data"),
      title: t("Enter key data"),
      validateInput: data => {
        if (data.length > Number(dataQueue.keyLength)) {
          return t("Key data is too long (maximum {0} characters)", String(dataQueue.keyLength));
        }
      }
    }) : "";
    
    if (!dataQueue.keyed || key) {
      // Ask if message is in UTF8 format
      const fmt = await vscode.window.showQuickPick(
        [t("YES"), t("NO")],
        {
          placeHolder: t("Is message in UTF8 format?"),
          title: t("Is message in UTF8 format?"),
          canPickMany: false,
        },
      );
      
      // Get the message data
      const data = await vscode.window.showInputBox({
        placeHolder: t("message"),
        title: t("Enter message"),
        validateInput: data => {
          if (data.length > Number(dataQueue.maximumMessageLength)) {
            return t("Message is too long (maximum {0} characters)", String(dataQueue.maximumMessageLength));
          }
        }
      });
      
      if (data) {
        const ibmi = getInstance();
        const connection = ibmi?.getConnection();
        if (connection) {
          // Check if required procedures exist
          const procName = fmt === t("YES") ? 'SEND_DATA_QUEUE_UTF8' : 'SEND_DATA_QUEUE';
          const procedureExists = await checkProcedureExists(connection, 'QSYS2', procName);
          if (!procedureExists) {
            vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "QSYS2", procName));
            return false;
          }

          try {
            // Use UTF8 or standard procedure based on user input
            if (fmt === t("YES")) {
              await connection.runSQL(`CALL QSYS2.SEND_DATA_QUEUE_UTF8(${key ? `KEY_DATA => '${key}',` : ""} MESSAGE_DATA => '${data}',
                                DATA_QUEUE => '${dataQueue.name}', DATA_QUEUE_LIBRARY => '${dataQueue.library}')`);
            } else {
              await connection.runSQL(`CALL QSYS2.SEND_DATA_QUEUE(${key ? `KEY_DATA => '${key}',` : ""} MESSAGE_DATA => '${data}',
                                DATA_QUEUE => '${dataQueue.name}', DATA_QUEUE_LIBRARY => '${dataQueue.library}')`);
            }
            vscode.window.showInformationMessage(t("Data successfully sent to {0}/{1}.", dataQueue.library, dataQueue.name));
            return true;
          } catch (error) {
            vscode.window.showErrorMessage(t("An error occurred while sending data to DTAQ {0}/{1}", dataQueue.library, dataQueue.name));
            return false;
          }
        } else {
          vscode.window.showErrorMessage(t("Not connected to IBM i"));
          return false;
        }
      }
    }
    return false;
  };
}

/**
 * Interface representing a Data Queue entry/message
 */
interface Entry {
  /** Key data (for keyed data queues) */
  key?: string
  /** Message data in standard format */
  data: string
  /** Message data in UTF8 format */
  datautf8: string
  /** Timestamp when message was enqueued */
  timestamp: string
  /** Job name that sent the message */
  senderJob: string
  /** User who sent the message */
  senderUser: string
}

/**
 * Data Queue (DTAQ) object class
 * Handles display and management of IBM i Data Queues
 */
export class Dtaq extends Base {
  private readonly _info: Record<string, string | boolean | number> = {};
  private readonly _entries: Entry[] = [];
  private _keyed = false;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Data queue information from database */
  private dtaq?: any;

  /** Whether this is a keyed data queue */
  get keyed() {
    return this._keyed;
  }

  /** Maximum key length for keyed data queues */
  get keyLength() {
    return this._info.keyLength;
  }

  /** Maximum message length */
  get maximumMessageLength() {
    return this._info.maximumMessageLength;
  }

  /**
   * Fetch data queue information and entries
   */
  async fetch() {
    await this.fetchInfo();
    await this._fetchEntries();
  }

  /**
   * Fetch data queue metadata from IBM i
   */
  async fetchInfo() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      // Check if DATA_QUEUE_INFO view exists
      if (!await checkViewExists(connection, 'QSYS2', 'DATA_QUEUE_INFO')) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "DATA_QUEUE_INFO"));
        return;
      }

      this.columns = await getColumns(connection, 'DATA_QUEUE_INFO');
      let sql: string;

      // First query to get data queue type
      this.dtaq = await connection.runSQL(
        `SELECT DATA_QUEUE_TYPE
        FROM QSYS2.DATA_QUEUE_INFO
        WHERE DATA_QUEUE_NAME = '${this.name}' AND DATA_QUEUE_LIBRARY = '${this.library}'
        Fetch first row only`)

      // Build SQL based on data queue type (DDM vs standard)
      if (this.dtaq[0].DATA_QUEUE_TYPE === 'DDM') {
        sql = `SELECT DATA_QUEUE_TYPE,
                    TEXT_DESCRIPTION,
                    REMOTE_DATA_QUEUE_LIBRARY,
                    REMOTE_DATA_QUEUE,
                    REMOTE_LOCATION,
                    RELATIONAL_DATABASE_NAME,
                    APPC_DEVICE_DESCRIPTION,
                    LOCAL_LOCATION,
                    "MODE",
                    REMOTE_NETWORK_ID`
      } else {
        sql = `SELECT DATA_QUEUE_TYPE,
                    MAXIMUM_MESSAGE_LENGTH,
                    "SEQUENCE",
                    KEY_LENGTH,
                    INCLUDE_SENDER_ID,
                    CURRENT_MESSAGES,
                    MAXIMUM_MESSAGES,
                    SPECIFIED_MAXIMUM_MESSAGES,
                    INITIAL_MESSAGE_ALLOCATION,
                    CURRENT_MESSAGE_ALLOCATION,
                    FORCE,
                    AUTOMATIC_RECLAIM,
                    to_char(LAST_RECLAIM_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as LAST_RECLAIM_TIMESTAMP,
                    ENFORCE_DATA_QUEUE_LOCKS,
                    TEXT_DESCRIPTION`
      }

      sql = sql.trim() + ` FROM QSYS2.DATA_QUEUE_INFO
                WHERE DATA_QUEUE_NAME = '${this.name}' AND DATA_QUEUE_LIBRARY = '${this.library}'
                Fetch first row only`

      this.dtaq = await connection.runSQL(sql)
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch all entries/messages from the data queue
   */
  private async _fetchEntries() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if DATA_QUEUE_ENTRIES function exists
      const functionExists = await checkTableFunctionExists(connection, 'QSYS2', 'DATA_QUEUE_ENTRIES');
      if (!functionExists) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "DATA_QUEUE_ENTRIES"));
        return;
      }

      this._entries.length = 0;
      const entryRows = await connection.runSQL(`
                Select MESSAGE_DATA,
                MESSAGE_DATA_UTF8,
                to_char(MESSAGE_ENQUEUE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as MESSAGE_ENQUEUE_TIMESTAMP,
                SENDER_JOB_NAME,
                SENDER_CURRENT_USER ${this._keyed ? ",KEY_DATA" : ""}
                From TABLE(QSYS2.DATA_QUEUE_ENTRIES(
                    DATA_QUEUE_LIBRARY => '${this.library}',
                    DATA_QUEUE => '${this.name}'
                ))
                Order By ORDINAL_POSITION`);

      this._entries.push(...entryRows.map(toEntry));
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the data queue view with tabs
   * @returns HTML string
   */
  generateHTML(): string {
    return Components.panels([
      { title: t("Detail"), content: this.renderDataQueuePanel() },
      { title: t("Messages"), badge: this._entries.length, content: renderEntries(this._keyed, this._entries, false) },
      { title: t("Messages UTF8"), badge: this._entries.length, content: renderEntries(this._keyed, this._entries, true) }
    ]);
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    return {};
  }

  /**
   * Save changes (not applicable for data queues)
   */
  async save() {
    // Data queues don't have a save operation
  }

  /**
   * Render the data queue information panel
   * @returns HTML string for the panel
   */
  private renderDataQueuePanel(): string {
    return generateDetailTable({
      title: t("Data Queue: {0}/{1}", this.library, this.name),
      subtitle: t("Data Queue Information"),
      columns: this.columns,
      data: this.dtaq
    });
  }
}

/**
 * Convert a database row to an Entry object
 * @param row - Database row from QSYS2.DATA_QUEUE_ENTRIES
 * @returns Entry object
 */
function toEntry(row: Tools.DB2Row): Entry {
  return {
    data: String(row.MESSAGE_DATA),
    datautf8: String(row.MESSAGE_DATA_UTF8),
    timestamp: String(row.MESSAGE_ENQUEUE_TIMESTAMP),
    key: row.KEY_DATA ? String(row.KEY_DATA) : undefined,
    senderJob: String(row.SENDER_JOB_NAME || '-'),
    senderUser: String(row.SENDER_CURRENT_USER || '-'),
  };
}

/**
 * Render the entries table for messages
 * @param keyed - Whether this is a keyed data queue
 * @param entries - Array of entries to display
 * @param isUtf8 - Whether to display UTF8 or standard format
 * @returns HTML string for the entries table
 */
function renderEntries(keyed: boolean, entries: Entry[], isUtf8: boolean) {
  const columns: FastTableColumn<Entry>[] = [
    { title: t("Timestamp"), width: "0.5fr", getValue: e => e.timestamp },
    { title: t("User"), width: "0.5fr", getValue: e => e.senderUser },
  ];

  if (isUtf8) {
    columns.push({ title: t("Message"), width: "3fr", getValue: e => e.datautf8 });
  } else {
    columns.push({ title: t("Message"), width: "3fr", getValue: e => e.data });
  }

  if (keyed) {
    columns.push({ title: t("Key"), width: "1fr", getValue: e => e.key! });
  }

  let customStyles = "";

  if(keyed){
    customStyles = `
      /* Custom styles for cells - specific to dataqueue entries table */
      .dataqueue-entries-table vscode-table-cell:nth-child(4) {
        color: var(--vscode-textLink-foreground);
      }
    `;
  }

  return `<div class="dataqueue-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: entries,
    stickyHeader: true,
    emptyMessage: t("No messages in this dtaq."),
    customStyles: customStyles,
  }) + `</div>`;

}