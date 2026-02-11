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
import { generateFastTable, FastTableColumn, getProtected } from "../tools";
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
      vscode.commands.registerCommand("vscode-ibmi-fs.clearMessageQueue", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const dtaq: Msgq = new Msgq(item, library, name);
            const result = await clearMessageQueue(dtaq);
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
        vscode.window.showWarningMessage(`Unable to perform object action because it is protected.`);
        return false;
      }

      if (await vscode.window.showWarningMessage(`Are you sure you want to clear Message Queue ${library}/${name}?`, { modal: true }, "Clear MSGQ")) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `CLRMSGQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Message Queue ${library}/${name} cleared.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to clear Message Queue ${library}/${name}:\n${cmdrun.stderr}`);
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
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
   */
  async fetchMessages(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      const entryRows = await connection.runSQL(
        `SELECT MESSAGE_ID,
          MESSAGE_TEXT,
          SEVERITY,
          to_char(MESSAGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as MESSAGE_TIMESTAMP,
          FROM_USER,
          FROM_JOB,
          MESSAGE_SECOND_LEVEL_TEXT
        FROM QSYS2.MESSAGE_QUEUE_INFO
        WHERE MESSAGE_QUEUE_LIBRARY = '${this.library}'
              AND MESSAGE_QUEUE_NAME = '${this.name}'
        ORDER BY MESSAGE_TIMESTAMP DESC`)
      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the message queue view
   * Uses a fast table component for better performance with many messages
   * @returns HTML string
   */
  generateHTML(): string {
    // Define table columns with widths
    const columns: FastTableColumn<Entry>[] = [
      { title: "MSGID", getValue: e => e.msgid, width: "0.5fr" },
      { title: "First Level", getValue: e => e.msgtxt1, width: "1fr" },
      { title: "Second Level", getValue: e => e.msgtxt2, width: "2fr" },
      { title: "Sev.", getValue: e => e.severity, width: "0.2fr" },
      { title: "Timestamp", getValue: e => e.timestamp, width: "0.7fr" },
      { title: "Job", getValue: e => e.job, width: "1fr" },
      { title: "User", getValue: e => e.user, width: "0.5fr" }
    ];

    return generateFastTable({
      title: `Message Queue: ${this.library}/${this.name}`,
      subtitle: `Total Messages: ${this._entries.length}`,
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: 'No messages found in this message queue.',
      customStyles: '',
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