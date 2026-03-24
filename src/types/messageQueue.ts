/**
 * Message Queue Management Module
 *
 * This module provides functionality for managing IBM i Message Queues (MSGQ).
 * Message queues are objects used to store messages sent by programs, system functions,
 * or users. They provide a way to communicate between jobs and store diagnostic,
 * informational, and inquiry messages.
 *
 * Key Features:
 * - Display message queue contents with detailed information
 * - View message text (first and second level)
 * - Show message metadata (severity, timestamp, sender job/user)
 * - Clear all messages from a queue
 * - Fast table component for performance with many messages
 *
 * @module messagequeue
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { getInstance } from "../ibmi";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import { generateFastTable, FastTableColumn, getProtected, checkViewExists, executeSqlIfExists } from "../tools";
import * as vscode from 'vscode';
import ObjectProvider from "../objectProvider";

/**
 * Namespace containing actions for Message Queue objects
 */
export namespace MessageQueueActions {
  /**
   * Register Message Queue commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.sendToMessageQueue", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const msgq: Msgq = new Msgq(item, library, name);
            const result = await sendToMessageQueue(msgq);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu
          return sendToMessageQueue(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.clearMessageQueue", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const msgq: Msgq = new Msgq(item, library, name);
            const result = await clearMessageQueue(msgq);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu
          return clearMessageQueue(item);
        }
      }),
    );
  };

  /**
   * Send a message to a Message Queue
   * @param item - The Message Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const sendToMessageQueue = async (item: IBMiObject | Msgq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection, item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      // Ask for message ID (required)
      const messageId = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("Message ID (e.g., CPF9898)"),
        title: vscode.l10n.t("Enter Message ID"),
        prompt: vscode.l10n.t("Message ID")
      });

      if (!messageId) {
        return false;
      }

      // Ask for message file (defaults to QCPFMSG)
      const messageFile = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("Message file name (default: QCPFMSG)"),
        title: vscode.l10n.t("Enter Message File"),
        prompt: vscode.l10n.t("Message file"),
        value: "QCPFMSG"
      });

      if (!messageFile) {
        return false;
      }

      // Ask for message file library (defaults to QSYS)
      const messageFileLibrary = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("Message file library (default: QSYS)"),
        title: vscode.l10n.t("Enter Message File Library"),
        prompt: vscode.l10n.t("Message file library"),
        value: "QSYS"
      });

      if (!messageFileLibrary) {
        return false;
      }

      // Ask for message text (optional)
      const messageText = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("Message text (optional)"),
        title: vscode.l10n.t("Enter message text (optional)"),
        prompt: vscode.l10n.t("Message text")
      });

      // User can cancel or leave empty
      if (messageText === undefined) {
        return false;
      }

      try {
        // Build SQL call using QSYS2.SEND_MESSAGE procedure
        const messageLength = messageText ? messageText.length : 1;
        const sqlCall = `CALL QSYS2.SEND_MESSAGE(
          MESSAGE_ID => '${messageId}',
          MESSAGE_LENGTH => ${messageLength},
          MESSAGE_TEXT => ${messageText ? `'${messageText.replace(/'/g, "''")}'` : `'-'`},
          MESSAGE_FILE_LIBRARY => '${messageFileLibrary}',
          MESSAGE_FILE => '${messageFile}',
          MESSAGE_QUEUE_LIBRARY => '${library}',
          MESSAGE_QUEUE => '${name}'
        )`;

        const result = await executeSqlIfExists(
          connection,
          sqlCall,
          'QSYS2',
          'SEND_MESSAGE',
          'PROCEDURE'
        );

        if (result === null) {
          vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "QSYS2", "SEND_MESSAGE"));
          return false;
        }

        vscode.window.showInformationMessage(vscode.l10n.t("Message sent to Message Queue {0}/{1}.", library, name));
        return true;
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t("An error occurred while sending message to Message Queue {0}/{1}: {2}", library, name, String(error)));
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Clear all messages from a Message Queue
   * @param item - The Message Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const clearMessageQueue = async (item: IBMiObject | Msgq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to clear Message Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Clear MSGQ"))) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `QSYS/CLRMSGQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Message Queue {0}/{1} cleared.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to clear Message Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
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
}

/**
 * Interface representing a message queue entry
 */
interface Entry {
  /** Message ID */
  msgid: string
  /** First level message text */
  msgtxt1: string
  /** Second level message text (detailed help) */
  msgtxt2: string
  /** Message severity (0-99) */
  severity: number
  /** Message timestamp */
  timestamp: string
  /** Job that sent the message */
  job: string
  /** User that sent the message */
  user: string
}

/**
 * Message Queue (MSGQ) object class
 * Handles display of IBM i Message Queue contents
 */
export default class Msgq extends Base {
  /** Internal message queue reference */
  private msgq?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  /** SQL SELECT clause for custom queries */
  selectClause: string | undefined;
  /** Array of message entries */
  private _entries: Entry[] = [];

  /**
   * Fetch message queue data
   */
  async fetch() {
    await this.fetchMessages();
  }

  /**
   * Fetch all messages from the message queue
   * Uses QSYS2.MESSAGE_QUEUE_INFO service to retrieve message details
   * Supports server-side search and pagination
   */
  async fetchMessages(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Build WHERE clause with base conditions
      let whereClause = `MESSAGE_QUEUE_LIBRARY = '${this.library}' AND MESSAGE_QUEUE_NAME = '${this.name}'`;

      // Add search filter if present
      if (this.searchTerm && this.searchTerm.trim() !== '' && this.searchTerm.trim() !== '-') {
        const searchPattern = `%${this.searchTerm.trim().toUpperCase()}%`;
        whereClause += ` AND (
          UPPER(MESSAGE_ID) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_TEXT) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_SECOND_LEVEL_TEXT) LIKE '${searchPattern}' OR
          UPPER(FROM_USER) LIKE '${searchPattern}' OR
          UPPER(FROM_JOB) LIKE '${searchPattern}'
        )`;
      }

      // Get total count for pagination
      const countRows = await executeSqlIfExists(
        connection,
        `SELECT COUNT(*) as TOTAL FROM QSYS2.MESSAGE_QUEUE_INFO WHERE ${whereClause}`,
        'QSYS2',
        'MESSAGE_QUEUE_INFO',
        'VIEW'
      );

      if (countRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_QUEUE_INFO"));
        return;
      }

      this.totalItems = countRows.length > 0 ? Number(countRows[0].TOTAL) : 0;

      // Calculate OFFSET for pagination
      const offset = (this.currentPage - 1) * this.itemsPerPage;

      // Fetch paginated data
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT MESSAGE_ID,
          MESSAGE_TEXT,
          SEVERITY,
          to_char(MESSAGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as MESSAGE_TIMESTAMP,
          FROM_USER,
          FROM_JOB,
          MESSAGE_SECOND_LEVEL_TEXT
        FROM QSYS2.MESSAGE_QUEUE_INFO
        WHERE ${whereClause}
        ORDER BY MESSAGE_TIMESTAMP DESC
        LIMIT ${this.itemsPerPage} OFFSET ${offset}`,
        'QSYS2',
        'MESSAGE_QUEUE_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_QUEUE_INFO"));
        return;
      }

      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the message queue view
   * Uses a fast table component for better performance with many messages
   * Includes search bar and pagination controls
   * @returns HTML string
   */
  generateHTML(): string {
    // Define table columns with widths
    const columns: FastTableColumn<Entry>[] = [
      { title: vscode.l10n.t("MSGID"), getValue: e => e.msgid, width: "0.5fr" },
      { title: vscode.l10n.t("First Level"), getValue: e => e.msgtxt1, width: "1fr" },
      { title: vscode.l10n.t("Second Level"), getValue: e => e.msgtxt2, width: "2fr" },
      { title: vscode.l10n.t("Sev."), getValue: e => String(e.severity), width: "0.2fr" },
      { title: vscode.l10n.t("Timestamp"), getValue: e => e.timestamp, width: "0.7fr" },
      { title: vscode.l10n.t("Job"), getValue: e => e.job, width: "1fr" },
      { title: vscode.l10n.t("User"), getValue: e => e.user, width: "0.5fr" }
    ];

    return generateFastTable({
      title: vscode.l10n.t("Message Queue: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t("Total Messages: {0}", String(this.totalItems)),
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t("No messages found in this message queue."),
      customStyles: '',
      enableSearch: true,
      searchPlaceholder: vscode.l10n.t("Search messages..."),
      enablePagination: true,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm
    });
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from QSYS2.MESSAGE_QUEUE_INFO
   * @returns Entry object
   */
  private toEntry(row: Tools.DB2Row): Entry {
    return {
      msgid: String(row.MESSAGE_ID),
      msgtxt1: String(row.MESSAGE_TEXT),
      msgtxt2: String(row.MESSAGE_SECOND_LEVEL_TEXT),
      severity: Number(row.SEVERITY),
      job: String(row.FROM_JOB),
      user: String(row.FROM_USER),
      timestamp: String(row.MESSAGE_TIMESTAMP)
    };
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for message queues
    return {};
  }

  /**
   * Save changes (not applicable for message queues)
   */
  async save(): Promise<void> {
    // Message queues are read-only in this view
  }
}