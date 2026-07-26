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
import { CommandResult, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { getInstance } from "../ibmi";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import { executeSqlIfExists, getProtected } from "../tools";
import { generateFastTable, generateFastTableUpdate, FastTableColumn, FastTableUpdate } from "../ibmi";
import * as vscode from 'vscode';
import ObjectProvider from "../objectProvider";

/** Explicit id so refreshes can target this table; see FastTableUpdateOptions.tableId. */
const MSGF_TABLE_ID = 'msgf-entries';

export namespace MessageFileActions {
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.addMsgd", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const msgf: Msgf = new Msgf(item, library, name);
            const result = await addMsgd(msgf);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return addMsgd(item);
        }
      }),
    );
  };

  export const addMsgd = async (item: IBMiObject | Msgf): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    if (getProtected(connection, item.library)) {
      vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
      return false;
    }

    // Check if CLPrompter extension is installed
    const clPrompterExt = vscode.extensions.getExtension('CozziResearch.clprompter');
    if (clPrompterExt) {
      // Use CLPrompter for advanced prompting
      if (!clPrompterExt.isActive) {
        await clPrompterExt.activate();
      }
      const { CLPrompter } = clPrompterExt.exports;
      let command = await CLPrompter(`QSYS/ADDMSGD MSGF(${item.library}/${item.name})`);

      const cmdrun: CommandResult = await connection.runCommand({
        command: command,
        environment: `ile`
      });

      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("Added new MSGID."));
        return true;
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t("Unable to add new MSGID:\n{0}", String(cmdrun.stderr)));
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t(`This action requires "Bob Cozzi's CL Prompter and Formatter for IBM i" extension`));
      return false;
    }
  };

  export const chgMsgd = async (entry: { msgid: string, library: string, name: string }): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    const clPrompterExt = vscode.extensions.getExtension('CozziResearch.clprompter');
    if (!clPrompterExt) {
      vscode.window.showErrorMessage(vscode.l10n.t(`This action requires "Bob Cozzi's CL Prompter and Formatter for IBM i" extension`));
      return false;
    }

    if (!clPrompterExt.isActive) { await clPrompterExt.activate(); }
    const { CLPrompter } = clPrompterExt.exports;
    const command = await CLPrompter(`QSYS/CHGMSGD MSGID(${entry.msgid}) MSGF(${entry.library}/${entry.name})`);
    if (!command) { return false; }

    const cmdrun: CommandResult = await connection.runCommand({ command, environment: `ile` });
    if (cmdrun.code === 0) {
      vscode.window.showInformationMessage(vscode.l10n.t("Message {0} changed.", entry.msgid));
      return true;
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Unable to change message {0}:\n{1}", entry.msgid, String(cmdrun.stderr)));
      return false;
    }
  };

  export const rmvMsgd = async (entry: { msgid: string, library: string, name: string }): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    if (!await vscode.window.showWarningMessage(
      vscode.l10n.t("Are you sure you want to remove message {0} from {1}/{2}?", entry.msgid, entry.library, entry.name),
      { modal: true },
      vscode.l10n.t("Remove")
    )) { return false; }

    const cmdrun: CommandResult = await connection.runCommand({
      command: `QSYS/RMVMSGD MSGID(${entry.msgid}) MSGF(${entry.library}/${entry.name})`,
      environment: `ile`
    });
    if (cmdrun.code === 0) {
      vscode.window.showInformationMessage(vscode.l10n.t("Message {0} removed.", entry.msgid));
      return true;
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Unable to remove message {0}:\n{1}", entry.msgid, String(cmdrun.stderr)));
      return false;
    }
  };
}

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
  /** Message substitution variable descriptions */
  parameters: string
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
      
      // Build WHERE clause with search filter
      let whereClause = `message_file = '${this.name}' AND message_file_library = '${this.library}'`;
      
      if (this.searchTerm && this.searchTerm.trim() !== '' && this.searchTerm.trim() !== '-') {
        const searchPattern = `%${this.searchTerm.trim().toUpperCase()}%`;
        whereClause += ` AND (
          UPPER(MESSAGE_ID) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_TEXT) LIKE '${searchPattern}' OR
          UPPER(MESSAGE_SECOND_LEVEL_TEXT) LIKE '${searchPattern}' OR
          UPPER(REPLY_TYPE) LIKE '${searchPattern}' OR
          UPPER(DEFAULT_REPLY) LIKE '${searchPattern}'
        )`;
      }
      
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
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_FILE_DATA"));
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
                END AS VALID_REPLY_VALUES,
                REPLACE(MESSAGE_DATA, ' &', '\n&') as PARAMETERS
            FROM qsys2.message_file_data
            WHERE ${whereClause}
            ORDER BY MESSAGE_ID
            LIMIT ${this.itemsPerPage} OFFSET ${offset}`,
        'QSYS2',
        'MESSAGE_FILE_DATA',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "MESSAGE_FILE_DATA"));
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
   * Generate HTML for the message file view
   * Uses a fast table component for better performance with many messages
   * @returns HTML string
   */
  /**
   * Column definitions for the messages table.
   * Shared by the full render and the incremental update: if the two ever disagree, the
   * patched rows no longer line up with the header still on screen.
   */
  private getColumns(): FastTableColumn<Entry>[] {
    return [
      { title: vscode.l10n.t("MSGID"), getValue: e => e.msgid, width: "0.25fr" },
      { title: vscode.l10n.t("First Level"), getValue: e => e.msgtxt1, width: "1fr" },
      { title: vscode.l10n.t("Second Level"), getValue: e => e.msgtxt2.replaceAll('&N','\n').replaceAll('&B','\n\t').replaceAll('&P','\n\t'), width: "0.3fr", collapsible: true, showTitle: true },
      { title: vscode.l10n.t("Sev."), getValue: e => String(e.severity), width: "0.2fr" },
      { title: vscode.l10n.t("Reply Type"), getValue: e => e.replytype, width: "0.2fr" },
      { title: vscode.l10n.t("Reply Dft"), getValue: e => e.replydft, width: "0.3fr" },
      { title: vscode.l10n.t("Reply Valid"), getValue: e => e.replyvalid, width: "0.3fr" },
      { title: vscode.l10n.t("Parameters"), getValue: e => e.parameters, width: "0.3fr", collapsible: true, showTitle: true },
      {
        title: vscode.l10n.t("Actions"),
        width: "0.7fr",
        getValue: e => {
          const arg = encodeURIComponent(JSON.stringify({ msgid: e.msgid, library: this.library, name: this.name }));
          return `<vscode-button appearance="primary" href="action:chgMsgd?entry=${arg}">${vscode.l10n.t("Change")}</vscode-button>
                  <vscode-button appearance="secondary" href="action:rmvMsgd?entry=${arg}">${vscode.l10n.t("Delete")}</vscode-button>`;
        }
      }
    ];
  }

  /** Subtitle text, kept in one place so the update carries the same wording as the render. */
  private getSubtitle(): string {
    return vscode.l10n.t("Total Messages: {0}", String(this.totalItems));
  }

  /** @inheritdoc */
  generateTableUpdate(): FastTableUpdate {
    return generateFastTableUpdate({
      columns: this.getColumns(),
      data: this._entries,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      subtitle: this.getSubtitle(),
      tableId: MSGF_TABLE_ID
    });
  }

  /**
   * Generate HTML for the message file view
   * Uses a fast table component for better performance with many messages
   * @returns HTML string
   */
  generateHTML(): string {
    const customStyles = `
      /* Custom styles for cells - specific to messagefile entries table */
      .messagefile-entries-table vscode-table-cell:first-child {
        color: var(--vscode-textLink-foreground);
      }
    `;

    return `<div class="messagefile-entries-table">` + generateFastTable({
      title: vscode.l10n.t("Message File: {0}/{1}", this.library, this.name),
      subtitle: this.getSubtitle(),
      columns: this.getColumns(),
      data: this._entries,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t("No messages found in this message file."),
      customStyles: customStyles,
      enableSearch: true,
      searchPlaceholder: vscode.l10n.t("Search messages..."),
      enablePagination: true,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm,
      tableId: MSGF_TABLE_ID
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
      replyvalid: String(row.VALID_REPLY_VALUES),
      parameters: String(row.PARAMETERS)
    };
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    const href = data.href;
    if (!href) { return {}; }

    const uri = vscode.Uri.parse(href);
    let refetch = false;
    const params = new URLSearchParams(uri.query);
    let entryJson;

    switch (uri.path) {
      case "chgMsgd":
        entryJson = params.get("entry");
        if (entryJson) {
          const entry = JSON.parse(decodeURIComponent(entryJson));
          if (await MessageFileActions.chgMsgd(entry)) {
            refetch = true;
          }
        }
        break;

      case "rmvMsgd":
        entryJson = params.get("entry");
        if (entryJson) {
          const entry = JSON.parse(decodeURIComponent(entryJson));
          if (await MessageFileActions.rmvMsgd(entry)) {
            refetch = true;
          }
        }
        break;
    }

    if (refetch) {
      await this.fetch();
    }

    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for message files)
   */
  async save(): Promise<void> {
    // Message files are read-only in this view
  }
}