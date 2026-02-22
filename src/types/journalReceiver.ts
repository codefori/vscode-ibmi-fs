/**
 * Journal Receiver Management Module
 *
 * This module provides functionality for viewing IBM i Journal Receivers (JRNRCV).
 * Journal Receivers are objects that store journal entries for auditing, recovery,
 * and replication purposes. They capture changes to database files and other objects.
 *
 * Key Features:
 * - Display journal receiver information and attributes
 * - View journal receiver status and statistics
 * - View sequence number ranges
 * - View attachment and detachment timestamps
 * - View linked journal receivers (previous/next)
 * - View remote journal configuration
 * - View filter settings
 * - Read-only view (no modification capabilities)
 *
 * @module journalreceiver
 */

import Base from "./base";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, checkViewExists, executeSqlIfExists } from "../tools";
import * as vscode from 'vscode';
import { t } from '../l10n';

/**
 * Journal Receiver (JRNRCV) object class
 * Handles display of IBM i Journal Receiver information
 */
export default class Jrnrcv extends Base {
  /** Journal receiver information from database */
  private jrnrcv?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  /**
   * Fetch journal receiver information from IBM i
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'JOURNAL_RECEIVER_INFO');

      this.jrnrcv = await executeSqlIfExists(
        connection,
        `SELECT DESCRIPTIVE_TEXT,
          JOURNAL_RECEIVER_ASP_NAME,
          JOURNAL_LIBRARY concat '/' concat JOURNAL_NAME JOURNAL_NAME,
          THRESHOLD,
          SIZE,
          STATUS,
          NUMBER_OF_JOURNAL_ENTRIES,
          FIRST_SEQUENCE_NUMBER,
          LAST_SEQUENCE_NUMBER,
          MAXIMUM_ENTRY_SPECIFIC_DATA_LENGTH,
          MAXIMUM_NULL_VALUE_INDICATORS,
          to_char(ATTACH_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as ATTACH_TIMESTAMP,
          to_char(DETACH_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as DETACH_TIMESTAMP,
          to_char(SAVE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as SAVE_TIMESTAMP,
          PREVIOUS_JOURNAL_RECEIVER_LIBRARY concat '/' concat PREVIOUS_JOURNAL_RECEIVER PREVIOUS_JOURNAL_RECEIVER,
          NEXT_JOURNAL_RECEIVER_LIBRARY concat '/' concat NEXT_JOURNAL_RECEIVER NEXT_JOURNAL_RECEIVER,
          RECEIVER_MAXIMUM_SIZE,
          MINIMIZE_ESD_FOR_DATA_AREAS,
          MINIMIZE_ESD_FOR_FILES,
          FIXED_LENGTH_DATA_INCLUDES_JOB_NAME,
          FIXED_LENGTH_DATA_INCLUDES_USER_NAME,
          FIXED_LENGTH_DATA_INCLUDES_PROGRAM_NAME,
          FIXED_LENGTH_DATA_INCLUDES_PROGRAM_LIBRARY,
          FIXED_LENGTH_DATA_INCLUDES_SYSTEM_SEQUENCE_NUMBER,
          FIXED_LENGTH_DATA_INCLUDES_REMOTE_ADDRESS,
          FIXED_LENGTH_DATA_INCLUDES_THREAD_ID,
          FIXED_LENGTH_DATA_INCLUDES_LOGICAL_UNIT_OF_WORK_ID,
          FIXED_LENGTH_DATA_INCLUDES_TRANSACTION_ID,
          PENDING_TRANSACTIONS,
          REMOTE_JOURNAL_TYPE,
          LOCAL_JOURNAL_SYSTEM,
          LOCAL_JOURNAL_LIBRARY concat '/' concat LOCAL_JOURNAL_NAME LOCAL_JOURNAL_NAME,
          LOCAL_JOURNAL_ASP_GROUP,
          LOCAL_JOURNAL_RECEIVER_LIBRARY,
          SOURCE_JOURNAL_SYSTEM,
          SOURCE_JOURNAL_LIBRARY concat '/' concat SOURCE_JOURNAL_NAME SOURCE_JOURNAL_NAME,
          SOURCE_JOURNAL_ASP_GROUP,
          SOURCE_JOURNAL_RECEIVER_LIBRARY,
          REDIRECTED_RECEIVER_LIBRARY,
          FILTER_BY_OBJECT,
          FILTER_IMAGES,
          FILTER_PROGRAMS,
          FILTER_PROGRAM_ARRAY,
          FILTER_PROGRAM_JSON
        FROM QSYS2.JOURNAL_RECEIVER_INFO
        where JOURNAL_RECEIVER_LIBRARY= '${this.library}' and JOURNAL_RECEIVER_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'JOURNAL_RECEIVER_INFO',
        'VIEW'
      );

      if (this.jrnrcv === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOURNAL_RECEIVER_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the journal receiver view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: `Journal Receiver: ${this.library}/${this.name}`,
      subtitle: t('Journal Receiver Information'),
      columns: this.columns,
      data: this.jrnrcv,
      hideNullValues:true
    });
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for journal receivers
    return {};
  }

  /**
   * Save changes (not applicable for journal receivers)
   */
  async save(): Promise<void> {
    // Journal receivers are read-only in this view
  }
}
