import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateTableHtmlCode } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_CHG = "chg";

export namespace UsrspcActions {
  export const register = (context: vscode.ExtensionContext) => {
      context.subscriptions.push(
          vscode.commands.registerCommand("vscode-ibmi-fs.chgUsrspc", chgUsrspc),
      );
  };

  function isStringNumber(value: string): boolean {
    return !isNaN(Number(value)) && value.trim() !== '';
  }

  export const chgUsrspc = async (item: IBMiObject | UserSpace, dta: Tools.DB2Row[], curvalue: string): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();


    let start  = await vscode.window.showInputBox({
      title: `Start position`,
      value: '1',
      validateInput: start => {
        if (!isStringNumber(start) || parseInt(start) <= 0) {
            return `The start position must be a number bigger or equal than 1`;
        }
      }
    });

    let newvalue  = await vscode.window.showInputBox({
      title: `Change USRSPC value`,
      value: curvalue,
      validateInput: newvalue => {
        if (newvalue.length<1) {
            return `Insert a new value`;
        }
      }
    });

    if(newvalue && start){
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        try {
          await connection.runSQL(`CALL QSYS2.CHANGE_USER_SPACE(USER_SPACE => '${name}', 
                             USER_SPACE_LIBRARY => '${library}', 
                             DATA => '${newvalue}', 
                             START_POSITION => ${start})`);
          vscode.window.showInformationMessage(`User Space ${library}/${name} updated.`);
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(`An error occurred while updating the USRSPC ${library}/${name}`);
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

export class UserSpace extends Base {
  columns: Map<string, string> = new Map();
  private usrspc: any

  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      
      this.columns = await getColumns(connection,'USER_SPACE_INFO');
      this.columns.set('DATA', 'Data');
      this.columns.set('DATA_BINARY', 'Binary Data');

      let sql = `SELECT x.*, y.data, y.data_binary 
                  FROM QSYS2.USER_SPACE_INFO x, TABLE(QSYS2.USER_SPACE(
                    USER_SPACE => '${this.name}', USER_SPACE_LIBRARY => '${this.library}')) y
                  WHERE x.USER_SPACE = '${this.name}' AND x.user_space_library='${this.library}'`
      this.usrspc = await connection. runSQL(sql)
    }
        
  }

  generateHTML(): string {
    let html=generateTableHtmlCode(this.columns,this.usrspc, `["DATA","DATA_BINARY"]`);
    html=html.trim()+`
        ${Components.divider()}
        </br>
        ${Components.button("Change value ✏️", { action: ACTION_CHG, style:"width:100%; text-align: center"})}`;

    return html;
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
      let refetch = false;
      switch (uri.path) {
          case ACTION_CHG:
              if (await UsrspcActions.chgUsrspc(this, this.usrspc, this.usrspc[0].DATA)) {
                  refetch = true;
              }
              break;
      }
      if (refetch) {
          await this.fetch();
      }
      return { rerender: refetch };
  }  

  async save(): Promise<void> {
  }
}