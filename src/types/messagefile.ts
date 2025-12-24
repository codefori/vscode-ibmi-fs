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
  /** Message ID */
  msgid: string
  /** First level message text */
  msgtxt1: string
  /** Second level message text (detailed help) */
  msgtxt2: string
  /** Message severity (0-99) */
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
export default class MsgfFast extends Base {
  private msgf?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
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
   * Limited to 500 messages for performance
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
            WHERE message_file = '${this.name}' AND message_file_library = '${this.library}'
            limit 500`)
      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
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
      customScript: ""
    }) + `</div>`;
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from qsys2.message_file_data
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