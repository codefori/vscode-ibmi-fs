/**
 * User Space Management Module
 *
 * This module provides functionality for managing IBM i User Spaces (USRSPC).
 * User Spaces are objects that provide temporary or permanent storage for data
 * that can be accessed by multiple programs.
 *
 * Key Features:
 * - Display user space information and attributes
 * - View user space content (hexadecimal and text representation)
 * - Change user space data
 * - Support for different user space sizes
 * - Automatic space extension capabilities
 *
 * @module userspace
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, getProtected, checkTableFunctionExists, checkProcedureExists, checkViewExists, executeSqlIfExists } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

/**
 * Namespace containing actions for User Space objects
 */
export namespace UserSpaceActions {
  /**
   * Register User Space commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.chgUsrspc", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await chgUsrspc({ library, name } as IBMiObject);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu or webview
          return chgUsrspc(item);
        }
      }),
    );
  };

  /**
   * Check if a string represents a valid number
   * @param value - String to validate
   * @returns True if valid number, false otherwise
   */
  function isStringNumber(value: string): boolean {
    return !isNaN(Number(value)) && value.trim() !== '';
  }

  /**
   * Change the value of a User Space
   * @param item - The User Space object or IBMiObject
   * @param dta - User space information from database
   * @param curvalue - Current value of the user space
   * @returns True if successful, false otherwise
   */
  export const chgUsrspc = async (item: IBMiObject | Usrspc): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      let usrspc = await executeSqlIfExists(
        connection,
        `SELECT DATA FROM TABLE(QSYS2.USER_SPACE(
                    USER_SPACE => '${item.name}', USER_SPACE_LIBRARY => '${item.library}'))`,
        'QSYS2',
        'USER_SPACE',
        'FUNCTION'
      );

      if (usrspc === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "USER_SPACE"));
        return false;
      }

      let curvalue = usrspc[0]?.DATA ? String(usrspc[0].DATA) : ''

      // Get the start position for the change
      let start = await vscode.window.showInputBox({
        title: vscode.l10n.t("Start position"),
        value: '1',
        validateInput: start => {
          if (!isStringNumber(start) || parseInt(start) <= 0) {
            return vscode.l10n.t("The start position must be a number bigger or equal than 1");
          }
        }
      });

      // Get the new value
      let newvalue = await vscode.window.showInputBox({
        title: vscode.l10n.t("Change USRSPC value"),
        value: curvalue,
        validateInput: newvalue => {
          if (newvalue.length < 1) {
            return vscode.l10n.t("Insert a new value");
          }
        }
      });

      if (newvalue && start) {
        try {
          const result = await executeSqlIfExists(
            connection,
            `CALL QSYS2.CHANGE_USER_SPACE(USER_SPACE => '${name}',
                            USER_SPACE_LIBRARY => '${library}',
                            DATA => '${newvalue}',
                            START_POSITION => ${start})`,
            'QSYS2',
            'CHANGE_USER_SPACE',
            'PROCEDURE'
          );

          if (result === null) {
            vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "QSYS2", "CHANGE_USER_SPACE"));
            return false;
          }

          vscode.window.showInformationMessage(vscode.l10n.t("User Space {0}/{1} updated.", library, name));
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(vscode.l10n.t("An error occurred while updating the USRSPC {0}/{1}", library, name));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  }
}

/**
 * User Space (USRSPC) object class
 * Handles display and modification of IBM i User Spaces
 */
export class Usrspc extends Base {
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  /** User space information from database */
  private usrspc: any

  /**
   * Fetch user space information from IBM i
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'USER_SPACE_INFO');
      // Add custom columns for data display
      this.columns.set('DATA', vscode.l10n.t("Data"));
      this.columns.set('DATA_BINARY', vscode.l10n.t("Binary Data"));

      this.usrspc = await executeSqlIfExists(
        connection,
        `SELECT SIZE, EXTENDABLE, INITIAL_VALUE, OBJECT_DOMAIN, TEXT_DESCRIPTION, y.data, y.data_binary
                  FROM QSYS2.USER_SPACE_INFO x, TABLE(QSYS2.USER_SPACE(
                    USER_SPACE => '${this.name}', USER_SPACE_LIBRARY => '${this.library}')) y
                  WHERE x.USER_SPACE = '${this.name}' AND x.user_space_library='${this.library}'`,
        'QSYS2',
        'USER_SPACE_INFO',
        'VIEW'
      );

      if (this.usrspc === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "USER_SPACE_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the user space view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: `User Space: ${this.library}/${this.name}`,
      subtitle: vscode.l10n.t('User Space Information'),
      columns: this.columns,
      data: this.usrspc,
      codeColumns: ['DATA', 'DATA_BINARY']
    });
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
   * Save changes (not applicable for user spaces)
   */
  async save(): Promise<void> {
    // User spaces are saved immediately via CHANGE_USER_SPACE procedure
  }
}