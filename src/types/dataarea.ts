import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns, generateTableHtml } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_CHG = "chg";

export namespace DtaaraActions {
  export const register = (context: vscode.ExtensionContext) => {
      context.subscriptions.push(
          vscode.commands.registerCommand("vscode-ibmi-fs.ChgDtaara", chgDtaara),
      );
  };

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

  export const chgDtaara = async (item: IBMiObject | DataArea, dta: Tools.DB2Row[], curvalue: string): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    let newvalue=null;

    switch(dta[0].DATA_AREA_TYPE){
      case `*DEC`:
        newvalue = await vscode.window.showInputBox({
            title: `Change DTAARA value`,
            value: curvalue,
            validateInput: newvalue => {
              if (checkDecimal(newvalue,dta)) {
                  return `The value lenght must be a number`;
              }
            }
          });
          break;

      case `*LGL`:
          newvalue = await vscode.window.showInputBox({
            title: `Change DTAARA value`,
            value: curvalue,
            validateInput: newvalue => {
              if (isNaN(Number(newvalue)) || (Number(newvalue) !==0&&Number(newvalue)!==1)) {
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
              if (newvalue.length>Number(dta[0].LENGTH)) {
                  return `The value lenght must be less or equals than ${dta[0].LENGTH} characters`;
              }
            }
          });
          break;
    }

    if(newvalue){
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

export class DataArea extends Base {
  columns: Map<string, string> = new Map();
  private dta: any
  private dtavalue: any

  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      
      this.columns = await getColumns(connection,'DATA_AREA_INFO');
      this.dta = await connection. runSQL(
                `SELECT DATA_AREA_TYPE
                 from QSYS2.DATA_AREA_INFO
                 WHERE DATA_AREA_NAME = '${this.name}' AND DATA_AREA_LIBRARY = '${this.library}'
                 Fetch first row only`)

      let sql=""

      if(this.dta[0].DATA_AREA_TYPE!=='*DEC'){
        sql=`select DATA_AREA_NAME,
          DATA_AREA_LIBRARY,
          DATA_AREA_TYPE,
          LENGTH,
          TEXT_DESCRIPTION `
      } else {
        sql=`select DATA_AREA_NAME,
          DATA_AREA_LIBRARY,
          DATA_AREA_TYPE,
          DECIMAL_POSITIONS,
          LENGTH,
          TEXT_DESCRIPTION `
      } 

      sql=sql.trim()+` from QSYS2.DATA_AREA_INFO
          WHERE DATA_AREA_NAME = '${this.name}' AND DATA_AREA_LIBRARY = '${this.library}'
          Fetch first row only`;

      this.dta = await connection. runSQL(sql)
      this.dtavalue = await connection. runSQL(`SELECT DATA_AREA_VALUE
                 from QSYS2.DATA_AREA_INFO
                 WHERE DATA_AREA_NAME = '${this.name}' AND DATA_AREA_LIBRARY = '${this.library}'
                 Fetch first row only`)
    }
        
  }

  generateTableHtmlCODE(columns: Map<string, string>, obj: any): string {
  
      let html=`<vscode-data-grid>`;
  
      columns.forEach((label, key) => {
      if(key in obj[0]){
          let value = obj[0][key as keyof typeof obj];
          if(!value)
          value="-"
          html=html.trim()+`<vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1"><b>${label}</b></vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2"><code>${value}</code></vscode-data-grid-cell>
          </vscode-data-grid-row>`;
      }
      });
  
      html=html.trim()+`</vscode-data-grid>`;
  
      return html;
  }

  generateHTML(): string {
  
        let html=generateTableHtml(this.columns,this.dta);
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
              if (await DtaaraActions.chgDtaara(this, this.dta, this.dtavalue[0].DATA_AREA_VALUE)) {
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