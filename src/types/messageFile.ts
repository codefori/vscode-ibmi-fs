/**
 * Message File Management Module
 *
 * This module provides functionality for managing IBM i Message Files (MSGF).
 * Message files contain predefined messages used by IBM i applications for
 * error handling, user communication, and system notifications.
 *
 * Key Features:
 * - Display all messages in the message file
 * - View message details (ID, text, severity, reply type)
 * - First and second level message text
 * - Reply type and valid reply values
 * - Fast table component for performance with many messages
 *
 * @module messagefile
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { getInstance } from "../ibmi";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import { generateFastTable, FastTableColumn } from "../tools";
import * as vscode from 'vscode';

/**
 * Interface representing a message file entry
 */
interface Entry {
  /** Message ID (e.g., CPF0001) */
  msgid: string
  /** First level message text (brief description) */
  msgtxt1: string
  /** Second level message text (detailed help) */
  msgtxt2: string
  /** Message severity (0-99, higher = more severe) */
  severity: number
  /** Reply type (*NONE, *RPY, etc.) */
  replytype: string
  /** Default reply value */
  replydft: string
  /** Valid reply values or range */
  replyvalid: string
}

/**
 * Message File (MSGF) object class
 * Handles display of IBM i Message File contents
 */
export default class Msgf extends Base {
  /** Internal message file reference */
  private msgf?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  /** SQL SELECT clause for custom queries */
  selectClause: string | undefined;
  /** Array of message entries */
  private _entries: Entry[] = [];

  /**
   * Fetch message file data
   */
  async fetch() {
    await this.fetchMessages();
  }

  /**
   * Fetch all messages from the message file
   * Uses QSYS2.MESSAGE_FILE_DATA service to retrieve message definitions
   */
  async fetchMessages(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      const entryRows = await connection.runSQL(
        `SELECT MESSAGE_ID,
                MESSAGE_TEXT,
                MESSAGE_SECOND_LEVEL_TEXT,
                SEVERITY,
                REPLY_TYPE,
                DEFAULT_REPLY,
                CASE
                    WHEN VALID_REPLY_VALUES IS NOT null THEN REGEXP_REPLACE(LTRIM(RTRIM(VALID_REPLY_VALUES)), ' +', ' ')
                    WHEN VALID_REPLY_LOWER_LIMIT IS NOT null
                        AND VALID_REPLY_UPPER_LIMIT IS NOT null THEN VALID_REPLY_LOWER_LIMIT CONCAT ' -> ' CONCAT VALID_REPLY_UPPER_LIMIT
                    ELSE null
                END AS VALID_REPLY_VALUES
            FROM qsys2.message_file_data
            WHERE message_file = '${this.name}' AND message_file_library = '${this.library}'`)
      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the message file view
   * Uses a fast table component for better performance with many messages
   * @returns HTML string
   */
  generateHTML(): string {
    // Define table columns with widths
    const columns: FastTableColumn<Entry>[] = [
      { title: "MSGID", getValue: e => e.msgid, width: "0.25fr" },
      { title: "First Level", getValue: e => e.msgtxt1, width: "1fr" },
      { title: "Second Level", getValue: e => e.msgtxt2, width: "2fr" },
      { title: "Sev.", getValue: e => e.severity, width: "0.2fr" },
      { title: "Reply Type", getValue: e => e.replytype, width: "0.2fr" },
      { title: "Reply Dft", getValue: e => e.replydft, width: "0.2fr" },
      { title: "Reply Valid", getValue: e => e.replyvalid, width: "0.2fr" }
    ];

    const customStyles = `
      /* Custom styles for cells - specific to messagefile entries table */
      .messagefile-entries-table vscode-data-grid-cell[grid-column="1"] {
        color: var(--vscode-textLink-foreground);
      }
    `;

    return `<div class="messagefile-entries-table">` + generateFastTable({
      title: `Message File: ${this.library}/${this.name}`,
      subtitle: `Total Messages: ${this._entries.length}`,
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: 'No messages found in this message file.',
      customStyles: customStyles,
    }) + `</div>`;
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from QSYS2.MESSAGE_FILE_DATA
   * @returns Entry object
   */
  private toEntry(row: Tools.DB2Row): Entry {
    return {
      msgid: String(row.MESSAGE_ID),
      msgtxt1: String(row.MESSAGE_TEXT),
      msgtxt2: String(row.MESSAGE_SECOND_LEVEL_TEXT),
      severity: Number(row.SEVERITY),
      replytype: String(row.REPLY_TYPE),
      replydft: String(row.DEFAULT_REPLY),
      replyvalid: String(row.VALID_REPLY_VALUES)
    };
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for message files
    return {};
  }

  /**
   * Save changes (not applicable for message files)
   */
  async save(): Promise<void> {
    // Message files are read-only in this view
  }
}