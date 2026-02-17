/**
 * Data Area Management Module
 *
 * This module provides functionality for managing IBM i Data Areas (DTAARA).
 * Data Areas are objects that store data that can be accessed by multiple programs.
 *
 * Key Features:
 * - Display data area information and current value
 * - View data area attributes (type, length, decimal positions)
 * - Change data area content
 * - Support for different data area types (*CHAR, *DEC, *LGL)
 *
 * @module dataarea
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, getProtected } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';
import { t } from '../l10n';

/**
 * Namespace containing actions for Data Area objects
 */
export namespace DataAreaActions {
  /**
   * Register Data Area commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.ChgDtaara", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await chgDtaara({ library, name } as IBMiObject);
            // Refresh the editor after action
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          // Called from context menu or webview
          return chgDtaara(item);
        }
      }),
    );
  };

  /**
   * Validate decimal value for data area
   * @param value - Value to validate
   * @param dta - Data area information from database
   * @returns True if valid, false otherwise
   */
  function checkDecimal(value: string, dta: Tools.DB2Row[]): boolean {
    if (value) {
      const max = (Math.pow(10, Number(dta[0].LENGTH)) - 1) / (Number(dta[0].DECIMAL_POSITIONS) ? Math.pow(10, Number(dta[0].DECIMAL_POSITIONS)) : 1);
      const min = max * -1;
      const number = Number(value);
      if (isNaN(number)) {
        return false
      } else if (number > max || number < min) {
        return false
      } else {
        return true;
      }
    } else {
      return false;
    }
  };

  /**
   * Change the value of a Data Area
   * @param item - The Data Area object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const chgDtaara = async (item: IBMiObject | Dtaara): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    let newvalue = null;

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(t("Unable to perform object action because it is protected."));
        return false;
      }

      // Fetch dta
      const dtaSql = `SELECT DATA_AREA_TYPE, LENGTH, DECIMAL_POSITIONS, DATA_AREA_VALUE
          FROM QSYS2.DATA_AREA_INFO
          WHERE DATA_AREA_NAME = '${name}' AND DATA_AREA_LIBRARY = '${library}'
          FETCH FIRST ROW ONLY`;
      let dta = await connection.runSQL(dtaSql);

      // Ensure dta is available
      if (!dta || dta.length === 0) {
        vscode.window.showErrorMessage(t("Unable to retrieve Data Area information for {0}/{1}", library, name));
        return false;
      }

      let cmd='';

      // Handle different data area types
      if(dta[0].DATA_AREA_TYPE==='*CHAR'){
        const startend = await vscode.window.showQuickPick(
          [t("YES"), t("NO")],
          {
            placeHolder: t("Do you want specify start/end?"),
            title: t("Do you want specify start/end?"),
            canPickMany: false,
          },
        );

        if(startend&&startend===t("YES")){
          const start = await vscode.window.showInputBox({
            title: t("Enter start"),
            placeHolder: t("1 is the first char"),
            value: '1',
            validateInput: start => {
              if (isNaN(Number(start))||Number(start)<1||Number(start)>2000) {
                return t("The value must be a valid number");
              }
            }
          });

          const lenght = await vscode.window.showInputBox({
            title: t("Enter substring length"),
            value: String(Number(dta![0].LENGTH)-Number(start)+1),
            placeHolder: t("Max value: {0}", String(Number(dta![0].LENGTH)-Number(start)+1)),
            validateInput: lenght => {
              if (isNaN(Number(lenght))||Number(lenght)<1||Number(lenght)>2000||Number(lenght)+Number(start)-1>Number(dta![0].LENGTH)) {
                return t("The substring length must be a valid number");
              }
            }
          });

          newvalue = await vscode.window.showInputBox({
            title: t("Change DTAARA value"),
            value: String(dta[0].DATA_AREA_VALUE).substring(Number(start)-1,Number(start)-1+Number(lenght)),
            validateInput: newvalue => {
              if (newvalue.length > Number(lenght)) {
                return t("The value length must be less or equals than {0} characters", String(lenght));
              }
            }
          });

          if(start&&lenght&&newvalue){
            cmd=`CHGDTAARA DTAARA(${library}/${name} (${start} ${lenght})) VALUE('${newvalue}')`;
          } else {
            cmd='';
          }
        } else {
          newvalue = await vscode.window.showInputBox({
            title: t("Change DTAARA value"),
            value: String(dta[0].DATA_AREA_VALUE),
            validateInput: newvalue => {
              if (newvalue.length > Number(dta![0].LENGTH)) {
                return t("The value length must be less or equals than {0} characters", String(dta![0].LENGTH));
              }
            }
          });

          if(newvalue){
            cmd=`CHGDTAARA DTAARA(${library}/${name}) VALUE('${newvalue}')`;
          } else {
            cmd='';
          }
        }
        
      } else {
        switch (dta[0].DATA_AREA_TYPE) {
          case '*DEC':
            newvalue = await vscode.window.showInputBox({
              title: t("Change DTAARA value"),
              value: String(dta[0].DATA_AREA_VALUE),
              validateInput: newvalue => {
                if (!checkDecimal(newvalue, dta!)) {
                  return t("The value must be a valid decimal number");
                }
              }
            });
            break;

          case `*LGL`:
            newvalue = await vscode.window.showInputBox({
              title: t("Change DTAARA value"),
              value: String(dta[0].DATA_AREA_VALUE),
              validateInput: newvalue => {
                if (isNaN(Number(newvalue)) || (Number(newvalue) !== 0 && Number(newvalue) !== 1)) {
                  return t("For *LGL dtaara value must be 0 or 1");
                }
              }
            });
            break;

          case `*CHAR`:
            
            newvalue = await vscode.window.showInputBox({
              title: t("Change DTAARA value"),
              value: String(dta[0].DATA_AREA_VALUE),
              validateInput: newvalue => {
                if (newvalue.length > Number(dta![0].LENGTH)) {
                  return t("The value length must be less or equals than {0} characters", String(dta![0].LENGTH));
                }
              }
            });
            break;
        }

        if(newvalue){
          cmd=`CHGDTAARA DTAARA(${library}/${name}) VALUE('${newvalue}')`;
        } else {
          cmd='';
        }
      }

      if (cmd&&cmd.trim() !== ``) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: cmd,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(t("Data Area {0}/{1} changed.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(t("Unable change Data Area {0}/{1}:\n{2}", library, name, cmdrun.stderr));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return false;
    }
  }
}

/**
 * Data Area (DTAARA) object class
 * Handles display and modification of IBM i Data Areas
 */
export class Dtaara extends Base {
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  /** Data area information from database */
  private dta: any

  /**
   * Fetch data area information from IBM i
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'DATA_AREA_INFO');
      
      // First query to get data area type
      this.dta = await connection.runSQL(
        `SELECT DATA_AREA_TYPE
         from QSYS2.DATA_AREA_INFO
         WHERE DATA_AREA_NAME = '${this.name}' AND DATA_AREA_LIBRARY = '${this.library}'
         Fetch first row only`)

      // Build SQL based on data area type (decimal areas have DECIMAL_POSITIONS)
      let sql = `select DATA_AREA_VALUE,
          DATA_AREA_TYPE,
          LENGTH,
          TEXT_DESCRIPTION ${this.dta[0].DATA_AREA_TYPE === '*DEC' ? ', DECIMAL_POSITIONS' : ''}
          from QSYS2.DATA_AREA_INFO
          WHERE DATA_AREA_NAME = '${this.name}' AND DATA_AREA_LIBRARY = '${this.library}'
          Fetch first row only`;

      this.dta = await connection.runSQL(sql)
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the data area view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: t("Data Area: {0}/{1}", this.library, this.name),
      subtitle: t("Data Area Information"),
      columns: this.columns,
      data: this.dta,
      codeColumns: ['DATA_AREA_VALUE']
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
   * Save changes (not applicable for data areas)
   */
  async save(): Promise<void> {
    // Data areas are saved immediately via CHGDTAARA command
  }
}