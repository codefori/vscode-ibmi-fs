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
import { generateFastTable, FastTableColumn, checkViewExists, executeSqlIfExists } from "../tools";
import * as vscode from 'vscode';
import { t } from '../l10n';

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
   * Supports server-side search and pagination
   */
  async fetchMessages(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      console.log('fetchMessages - searchTerm:', this.searchTerm, 'currentPage:', this.currentPage, 'itemsPerPage:', this.itemsPerPage);
      
      // Build WHERE clause with search filter
      let whereClause = `message_file = '${this.name}' AND message_file_library = '${this.library}'`;
      
      if (this.searchTerm && this.searchTerm.trim() !== '' && this.searchTerm.trim() !== '-') {
        const searchPattern = `%${this.searchTerm.trim().toUpperCase()}%`;
        console.log('Adding search filter:', searchPattern);
        whereClause += ` AND (
          UPPER(MESSAGE_ID) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_TEXT) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_SECOND_LEVEL_TEXT) LIKE '${searchPattern}' OR
          UPPER(REPLY_TYPE) LIKE '${searchPattern}' OR
          UPPER(DEFAULT_REPLY) LIKE '${searchPattern}'
        )`;
      }
      
      console.log('WHERE clause:', whereClause);

      // First, get total count for pagination
      const countRows = await executeSqlIfExists(
        connection,
        `SELECT COUNT(*) as TOTAL
            FROM qsys2.message_file_data
            WHERE ${whereClause}`,
        'QSYS2',
        'MESSAGE_FILE_DATA',
        'VIEW'
      );

      if (countRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_FILE_DATA"));
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
            WHERE ${whereClause}
            ORDER BY MESSAGE_ID
            LIMIT ${this.itemsPerPage} OFFSET ${offset}`,
        'QSYS2',
        'MESSAGE_FILE_DATA',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_FILE_DATA"));
        return;
      }

      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the message file view
   * Uses a fast table component for better performance with many messages
   * @returns HTML string
   */
  generateHTML(): string {
    console.log('MessageFile generateHTML - enableSearch: true, totalItems:', this.totalItems, 'currentPage:', this.currentPage);
    
    // Define table columns with widths
    const columns: FastTableColumn<Entry>[] = [
      { title: t("MSGID"), getValue: e => e.msgid, width: "0.25fr" },
      { title: t("First Level"), getValue: e => e.msgtxt1, width: "1fr" },
      { title: t("Second Level"), getValue: e => e.msgtxt2, width: "2fr" },
      { title: t("Sev."), getValue: e => String(e.severity), width: "0.2fr" },
      { title: t("Reply Type"), getValue: e => e.replytype, width: "0.2fr" },
      { title: t("Reply Dft"), getValue: e => e.replydft, width: "0.2fr" },
      { title: t("Reply Valid"), getValue: e => e.replyvalid, width: "0.2fr" }
    ];

    const customStyles = `
      /* Custom styles for cells - specific to messagefile entries table */
      .messagefile-entries-table vscode-table-cell:first-child {
        color: var(--vscode-textLink-foreground);
      }
    `;

    return `<div class="messagefile-entries-table">` + generateFastTable({
      title: t("Message File: {0}/{1}", this.library, this.name),
      subtitle: t("Total Messages: {0}", String(this.totalItems)),
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: t("No messages found in this message file."),
      customStyles: customStyles,
      enableSearch: true,
      searchPlaceholder: t("Search messages..."),
      enablePagination: true,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm
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