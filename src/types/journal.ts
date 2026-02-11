/**
 * Journal Management Module
 *
 * This module provides functionality for managing IBM i Journals (JRN) and their receiver chains.
 * It includes operations for displaying journal entries, generating new receivers, and viewing journal information.
 *
 * Key Features:
 * - Display journal information and statistics
 * - View journal receiver chain with details
 * - Generate new journal receivers
 * - Display journal entries using SQL
 * - View journal configuration and settings
 *
 * @module journal
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { generateDetailTable, getColumns, generateFastTable, FastTableColumn, getProtected, openSqlTemplate } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

/**
 * Namespace containing actions for Journal objects
 */
export namespace JournalActions {
  /**
   * Register Journal commands with VS Code
   * @param context - Extension context for command registration
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.GenJrnRcv", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await genJrnrcv({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return genJrnrcv(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.DspJrn", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            return dspJrn({ library, name } as IBMiObject);
          }
        } else if (item) {
          return dspJrn(item);
        }
      }),
    );
  };

  /**
   * Display Journal entries in SQL format
   * @param item - The Journal object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const dspJrn = async (item: IBMiObject | Jrn): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    // Generate SQL statement to display journal entries
    const sqlStatement = `-- Extract journal entries, ref: https://www.ibm.com/docs/en/i/7.6.0?topic=services-display-journal-table-function
    
      SELECT JT.ENTRY_TIMESTAMP,
        JT.SEQUENCE_NUMBER,
        JT.JOURNAL_CODE,
        JT.JOURNAL_ENTRY_TYPE,
        CAST(JT.ENTRY_DATA AS CHAR(2000)) AS RECORD,
        JT."OBJECT",
        JT.USER_NAME,
        JT.JOB_NAME,
        JT.JOB_USER,
        JT.JOB_NUMBER,
        JT."CURRENT_USER",
        JT.RECEIVER_NAME,
        JT.RECEIVER_LIBRARY,
        JT.RECEIVER_ASP_DEVICE,
        JT.RECEIVER_ASP_NUMBER,
        JT.OBJECT_ASP_DEVICE,
        JT.OBJECT_ASP_NUMBER,
        JT.PARENT_FILE_ID,
        JT.OBJECT_FILE_ID,
        JT.RELATIVE_DIRECTORY_FILE_ID,
        JT.OBJECT_FILE_NAME,
        JT.PATH_NAME,
        JT.DLO_NAME,
        JT.FOLDER_PATH
      FROM TABLE (
          QSYS2.DISPLAY_JOURNAL('${library}', '${name}', STARTING_RECEIVER_NAME => '*CURCHAIN')
        ) AS JT`;
    
    // Open the SQL template with the generated statement
    return await openSqlTemplate(sqlStatement);
  };

  /**
   * Generate new journal receiver
   * @param item - The Journal object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const genJrnrcv = async (item: IBMiObject | Jrn): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(`Unable to perform object action because it is protected.`);
        return false;
      }

      const cmdrun: CommandResult = await connection.runCommand({
        command: `CHGJRN JRN(${library}/${name}) JRNRCV(*GEN)`,
        environment: `ile`
      });

      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(`Generated new journal receiver.`);
        return true;
      } else {
        vscode.window.showErrorMessage(`Unable to generate new journal reciever:\n${cmdrun.stderr}`);
        return false;
      }
  } else {
    vscode.window.showErrorMessage(`Not connected to IBM i`);
    return false;
  }
  };
}

/**
 * Interface representing a journal receiver entry in the chain
 */
interface Entry {
  /** Journal receiver name (library/name format) */
  receiver: string
  /** Independent ASP name where receiver resides */
  iasp: string
  /** Threshold percentage for receiver size */
  threshold: string
  /** Current size of the receiver in bytes */
  size: Number
  /** Status of the receiver (ONLINE, SAVED, etc.) */
  status: string
  /** Number of journal entries in this receiver */
  entries: number
  /** First sequence number in the receiver */
  first: number
  /** Last sequence number in the receiver */
  last: number
  /** Timestamp when receiver was attached to journal */
  attach: string
  /** Timestamp when receiver was detached from journal */
  detach: string
  /** Timestamp when receiver was saved */
  save: string
}

/**
 * Journal (JRN) object class
 * Handles display and management of IBM i Journals and their receiver chains
 */
export default class Jrn extends Base {
  /** Journal information from QSYS2.JOURNAL_INFO */
  private jrn?: any;
  /** Column definitions for display from system catalog */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Array of journal receiver entries in the chain */
  private _entries: Entry[] = [];

  /**
   * Fetch journal information and receiver chain
   */
  async fetch() {
    await this.fetchInfo();
    await this.fetchChain();
  }

  /**
   * Fetch journal metadata from QSYS2.JOURNAL_INFO
   */
  async fetchInfo(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'JOURNAL_INFO');

      this.jrn = await connection.runSQL(
        `SELECT JOURNAL_ASPGRP,
          ATTACHED_JOURNAL_RECEIVER_LIBRARY CONCAT '/' CONCAT ATTACHED_JOURNAL_RECEIVER_NAME ATTACHED_JOURNAL_RECEIVER_NAME,
          MESSAGE_QUEUE_LIBRARY CONCAT '/' CONCAT MESSAGE_QUEUE MESSAGE_QUEUE,
          DELETE_RECEIVER_OPTION,
          DELETE_RECEIVER_DELAY,
          JOURNAL_TYPE,
          JOURNAL_STATE,
          NUMBER_JOURNAL_RECEIVERS,
          TOTAL_SIZE_JOURNAL_RECEIVERS,
          NUMBER_REMOTE_JOURNALS,
          REDIRECTED_RECEIVER_LIBRARY,
          MAXIMUM_REMOTE_JOURNALS_ENTRIES_BEHIND,
          MAXIMUM_REMOTE_JOURNALS_TIME_BEHIND,
          MAXIMUM_REMOTE_JOURNALS_RETRANSMISSIONS,
          JOURNAL_TEXT,
          MANAGE_RECEIVER_OPTION,
          MANAGE_RECEIVER_DELAY,
          REMOVE_INTERNAL_ENTRIES,
          REMOVE_FIXED_LENGTH_DETAIL,
          RECEIVER_MAXIMUM_SIZE,
          MINIMIZE_ESD_FOR_DATA_AREAS,
          MINIMIZE_ESD_FOR_FILES,
          JOURNAL_CACHE,
          FIXED_LENGTH_DATA_INCLUDES_JOB_NAME,
          FIXED_LENGTH_DATA_INCLUDES_USER_NAME,
          FIXED_LENGTH_DATA_INCLUDES_PROGRAM_NAME,
          FIXED_LENGTH_DATA_INCLUDES_PROGRAM_LIBRARY,
          FIXED_LENGTH_DATA_INCLUDES_SYSTEM_SEQUENCE_NUMBER,
          FIXED_LENGTH_DATA_INCLUDES_REMOTE_ADDRESS,
          FIXED_LENGTH_DATA_INCLUDES_THREAD_ID,
          FIXED_LENGTH_DATA_INCLUDES_LOGICAL_UNIT_OF_WORK_ID,
          FIXED_LENGTH_DATA_INCLUDES_TRANSACTION_ID,
          JOURNALED_OBJECT_LIMIT,
          JOURNALED_OBJECTS,
          JOURNALED_FILES,
          JOURNALED_MEMBERS,
          JOURNALED_DATA_AREAS,
          JOURNALED_DATA_QUEUES,
          JOURNALED_IFS_OBJECTS,
          JOURNALED_ACCESS_PATHS,
          JOURNALED_COMMITMENT_DEFINITIONS,
          JOURNALED_LIBRARIES,
          JOURNAL_RECOVERY_COUNT,
          REMOTE_JOURNAL_TYPE,
          JOURNAL_DELIVERY_MODE,
          LOCAL_JOURNAL_LIBRARY CONCAT '/' CONCAT LOCAL_JOURNAL_NAME LOCAL_JOURNAL_NAME,
          LOCAL_JOURNAL_SYSTEM,
          LOCAL_JOURNAL_ASPGRP,
          SOURCE_JOURNAL_LIBRARY CONCAT '/' CONCAT SOURCE_JOURNAL_NAME SOURCE_JOURNAL_NAME,
          SOURCE_JOURNAL_SYSTEM,
          SOURCE_JOURNAL_ASPGRP,
          LOCAL_RECEIVER_SYSTEM,
          SOURCE_RECEIVER_SYSTEM,
          ACTIVATION_TIME,
          ESTIMATED_TIME_BEHIND,
          MAXIMUM_TIME_BEHIND,
          to_char(MAXIMUM_BEHIND_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as MAXIMUM_BEHIND_TIMESTAMP,
          JOURNAL_ENTRY_FILTERING
        FROM QSYS2.JOURNAL_INFO
        where JOURNAL_NAME='${this.name}' and JOURNAL_LIBRARY= '${this.library}'
          Fetch first row only`)
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Fetch all journal receivers in the chain from QSYS2.JOURNAL_RECEIVER_INFO
   */
  async fetchChain(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this._entries.length=0;
      const entryRows = await connection.runSQL(
        `SELECT JOURNAL_RECEIVER_LIBRARY CONCAT '/' CONCAT JOURNAL_RECEIVER_NAME JOURNAL_RECEIVER_NAME,
          JOURNAL_RECEIVER_ASP_NAME,
          THRESHOLD,
          SIZE,
          STATUS,
          NUMBER_OF_JOURNAL_ENTRIES,
          FIRST_SEQUENCE_NUMBER,
          LAST_SEQUENCE_NUMBER,
          to_char(ATTACH_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS ATTACH_TIMESTAMP,
          to_char(DETACH_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS DETACH_TIMESTAMP,
          to_char(SAVE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS SAVE_TIMESTAMP
        FROM QSYS2.JOURNAL_RECEIVER_INFO
        WHERE JOURNAL_NAME = '${this.name}'
              AND JOURNAL_LIBRARY = '${this.library}'
        ORDER BY ATTACH_TIMESTAMP ASC`)
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the journal view with tabs
   * @returns HTML string containing Detail and Chain tabs
   */
  generateHTML(): string {
    return Components.panels([
      { title: "Detail", content: this.renderJournalPanel() },
      { title: "Chain", badge: this._entries.length, content: this.renderEntries(this._entries) }
    ]);
  }

  /**
   * Render the journal information panel
   * Displays comprehensive journal configuration and statistics
   * @returns HTML string for the panel
   * @private
   */
  private renderJournalPanel(): string {
    // Generate the detail table with journal information
    return generateDetailTable({
      title: `Journal: ${this.library}/${this.name}`,
      subtitle: 'Journal Information',
      columns: this.columns,
      data: this.jrn,
      hideNullValues: true
    });
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from QSYS2.JOURNAL_RECEIVER_INFO
   * @returns Entry object representing a journal receiver
   */
  private toEntry(row: Tools.DB2Row): Entry {
    return {
      receiver: String(row.JOURNAL_RECEIVER_NAME),
      iasp: String(row.JOURNAL_RECEIVER_ASP_NAME),
      threshold: String(row.THRESHOLD),
      size: Number(row.SIZE),
      status: String(row.STATUS),
      entries: Number(row.NUMBER_OF_JOURNAL_ENTRIES),
      first: Number(row.FIRST_SEQUENCE_NUMBER),
      last: Number(row.LAST_SEQUENCE_NUMBER),
      attach: String(row.ATTACH_TIMESTAMP),
      detach: String(row.DETACH_TIMESTAMP),
      save: String(row.SAVE_TIMESTAMP),
    };
  }

  /**
   * Render the journal receiver chain table
   * Displays all receivers in the chain with their details and statistics
   * @param entries - Array of journal receiver entries to display
   * @returns HTML string for the table
   */
  renderEntries(entries: Entry[]) {
    // Define table columns with their properties
    const columns: FastTableColumn<Entry>[] = [
      { title: "Receiver", width: "1.2fr", getValue: e => e.receiver },
      { title: "iASP", width: "0.7fr", getValue: e => e.iasp },
      { title: "Threshold", width: "0.5fr", getValue: e => e.threshold },
      { title: "Size", width: "0.5fr", getValue: e => String(e.size) },
      { title: "Entries", width: "0.5fr", getValue: e => e.entries },
      { title: "First entry", width: "0.5fr", getValue: e => e.first },
      { title: "Last entry", width: "0.5fr", getValue: e => e.last },
      { title: "Attach timestamp", width: "1fr", getValue: e => e.attach },
      { title: "Detach timestamp", width: "1fr", getValue: e => e.detach },
      { title: "Save timestamp", width: "1fr", getValue: e => e.save },
    ];

    // Custom CSS styles for the journal receiver chain table
    const customStyles = `
      /* Highlight receiver names with link color for better visibility */
      .jrn-entries-table vscode-table-cell:first-child {
        color: var(--vscode-textLink-foreground);
      }
    `;

    // Generate and return the complete table HTML
    return `<div class="jrn-entries-table">` + generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: 'No receivers found in this chain.',
      customStyles: customStyles,
    }) + `</div>`;
  }

  /**
   * Handle user actions from the webview
   * Routes action requests to appropriate handlers and manages UI refresh
   * @param data - Action data from the webview containing href with action type and parameters
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    return { };
  }

  /**
   * Save changes (not applicable for journals)
   * Journals are managed through IBM i commands, not direct editing
   */
  async save(): Promise<void> {
    // Journals are read-only in this view
    // All modifications are done through IBM i commands (CHGJRN, etc.)
  }
}
