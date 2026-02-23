/**
 * Command Management Module
 *
 * This module provides functionality for viewing IBM i Commands (*CMD).
 * Commands are objects that define CL commands, including their processing programs,
 * validity checking, prompt override programs, and various execution attributes.
 *
 * Key Features:
 * - Display command information and attributes
 * - View command processing program details
 * - View validity checking program configuration
 * - View prompt override program settings
 * - View help and message file associations
 * - View execution environment settings (interactive, batch, REXX, etc.)
 * - View threading and CCSID attributes
 * - Read-only view (no modification capabilities)
 *
 * @module command
 */

import Base from "./base";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, checkViewExists, executeSqlIfExists } from "../tools";
import * as vscode from 'vscode';

/**
 * Command (*CMD) object class
 * Handles display of IBM i Command information
 */
export default class Cmd extends Base {
  /** Command information from database */
  private cmd?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  /**
   * Fetch command information from IBM i
   * Retrieves comprehensive command details from QSYS2.COMMAND_INFO catalog
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'COMMAND_INFO');

      this.cmd = await executeSqlIfExists(
        connection,
        `SELECT PROXY_COMMAND,
          PROXY_TARGET_COMMAND_LIBRARY,
          PROXY_TARGET_COMMAND,
          TEXT_DESCRIPTION,
          COMMAND_PROCESSING_PROGRAM_LIBRARY,
          COMMAND_PROCESSING_PROGRAM,
          COMMAND_PROCESSING_PROGRAM_STATE,
          SOURCE_FILE_LIBRARY,
          SOURCE_FILE,
          SOURCE_FILE_MEMBER,
          VALIDITY_CHECKING_PROGRAM_LIBRARY,
          VALIDITY_CHECKING_PROGRAM,
          VALIDITY_CHECKING_PROGRAM_STATE,
          PROMPT_TEXT_MESSAGE_FILE_LIBRARY,
          PROMPT_TEXT_MESSAGE_FILE,
          RETRIEVE_PROMPT_MESSAGE,
          PROMPT_OVERRIDE_PROGRAM_LIBRARY,
          PROMPT_OVERRIDE_PROGRAM,
          PROMPT_OVERRIDE_PROGRAM_STATE,
          MESSAGE_FILE_LIBRARY,
          MESSAGE_FILE,
          HELP_PANEL_GROUP_LIBRARY,
          HELP_PANEL_GROUP,
          HELP_IDENTIFIER,
          HELP_SEARCH_INDEX_LIBRARY,
          HELP_SEARCH_INDEX,
          CURRENT_LIBRARY_NAME,
          PRODUCT_LIBRARY_NAME,
          MAXIMUM_POSITIONAL_PARAMETERS,
          ALLOW_LIMITED_USER,
          DEBUG_MODE,
          PRODUCTION_MODE,
          SERVICE_MODE,
          ALLOW_RUN_INTERACTIVE,
          ALLOW_RUN_BATCH,
          ALLOW_RUN_EXEC,
          ALLOW_RUN_BATCH_ENTRY,
          ALLOW_RUN_INTERACTIVE_ENTRY,
          ALLOW_RUN_BATCH_PGM,
          ALLOW_RUN_INTERACTIVE_PGM,
          ALLOW_RUN_BATCH_REXX,
          ALLOW_RUN_INTERACTIVE_REXX,
          "CCSID",
          GUI_ENABLED,
          "THREADSAFE",
          MULTITHREADED_JOB_ACTION,
          TARGET_RELEASE
        FROM QSYS2.COMMAND_INFO
        WHERE COMMAND_LIBRARY = '${this.library}'
        AND COMMAND_NAME = '${this.name}'
        Fetch first row only`,
        'QSYS2',
        'COMMAND_INFO',
        'VIEW'
      );

      if (this.cmd === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "COMMAND_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the command view
   * @returns HTML string containing formatted command information
   */
  generateHTML(): string {
    return generateDetailTable({
      title: vscode.l10n.t("Command: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t('Command Information'),
      columns: this.columns,
      data: this.cmd,
      hideNullValues: true
    });
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for commands (read-only view)
    return {};
  }

  /**
   * Save changes (not applicable for commands)
   */
  async save(): Promise<void> {
    // Commands are read-only in this view
  }
}
