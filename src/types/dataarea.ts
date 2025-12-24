import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_CHG = "chg";

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
      vscode.commands.registerCommand("vscode-ibmi-fs.ChgDtaara", chgDtaara),
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
   * @param dta - Data area information from database
   * @param curvalue - Current value of the data area
   * @returns True if successful, false otherwise
   */
  export const chgDtaara = async (item: IBMiObject | Dtaara, dta: Tools.DB2Row[], curvalue: string): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    let newvalue = null;

    // Handle different data area types
    switch (dta[0].DATA_AREA_TYPE) {
      case `*DEC`:
        newvalue = await vscode.window.showInputBox({
          title: `Change DTAARA value`,
          value: curvalue,
          validateInput: newvalue => {
            if (checkDecimal(newvalue, dta)) {
              return `The value length must be a number`;
            }
          }
        });
        break;

      case `*LGL`:
        newvalue = await vscode.window.showInputBox({
          title: `Change DTAARA value`,
          value: curvalue,
          validateInput: newvalue => {
            if (isNaN(Number(newvalue)) || (Number(newvalue) !== 0 && Number(newvalue) !== 1)) {
              return `For *LGL dtaara value must be 0 or 1`;
            }
          }
        });
        break;

      case `*CHAR`:
        newvalue = await vscode.window.showInputBox({
          title: `Change DTAARA value`,
          value: curvalue,
          validateInput: newvalue => {
            if (newvalue.length > Number(dta[0].LENGTH)) {
              return `The value length must be less or equals than ${dta[0].LENGTH} characters`;
            }
          }
        });
        break;
    }

    if (newvalue) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const command: CommandResult = await connection.runCommand({
          command: `CHGDTAARA DTAARA(${library}/${name}) VALUE('${newvalue}')`,
          environment: `ile`
        });

        if (command.code === 0) {
          vscode.window.showInformationMessage(`Data Area ${library}/${name} changed.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable change Data Area ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    } else {
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
    }
  }

  /**
   * Generate HTML for the data area view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: `Data Area: ${this.library}/${this.name}`,
      subtitle: 'Data Area Information',
      columns: this.columns,
      data: this.dta,
      codeColumns: ['DATA_AREA_VALUE'],
      actions: [
        {
          label: 'Change value ✏️',
          action: ACTION_CHG,
          appearance: 'primary',
          style: 'width: 100%; text-align: center;'
        }
      ]
    });
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;
    switch (uri.path) {
      case ACTION_CHG:
        if (await DataAreaActions.chgDtaara(this, this.dta, this.dta[0].DATA_AREA_VALUE)) {
          refetch = true;
        }
        break;
    }
    if (refetch) {
      await this.fetch();
    }
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for data areas)
   */
  async save(): Promise<void> {
    // Data areas are saved immediately via CHGDTAARA command
  }
}