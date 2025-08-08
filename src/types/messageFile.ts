import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';
import { IBMiObject, Action } from '@halcyontech/vscode-ibmi-types';


export namespace MessageFileActions {
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      // vscode.commands.registerCommand("vscode-ibmi-fs.addMessageD", addMessageD),
      // vscode.commands.registerCommand("vscode-ibmi-fs.changeMessageD", changeMessageD),
      // vscode.commands.registerCommand("vscode-ibmi-fs.copyMessageD", copyMessageD),
      // vscode.commands.registerCommand("vscode-ibmi-fs.displayMessageD", displayMessageD),
      // vscode.commands.registerCommand("vscode-ibmi-fs.removeMessageD", removeMessageD),
      // vscode.commands.registerCommand("vscode-ibmi-fs.changeMessageFile", changeMessageFile),
      // vscode.commands.registerCommand("vscode-ibmi-fs.createMessageFile", createMessageFile),
      // vscode.commands.registerCommand("vscode-ibmi-fs.deleteMessageFile", deleteMessageFile),
    );
  };

  export const removeMessageD = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    const ID = '*NA';
    if (await vscode.window.showWarningMessage(`Are you sure you want to remove message ID ${ID} from ${library}/${name}?`, { modal: true }, "Clear")) {
      const commandResult = await Code4i.getConnection().runCommand({ command: ` RMVMSGD MSGID(${ID}) MSGF(${library}/${name})`, environment: `ile` }); if (commandResult) {
        if (commandResult.code === 0 || commandResult.code === null) {
        } else {
          vscode.window.showErrorMessage(`${commandResult.stderr}.`);
        }
      }
      vscode.window.showInformationMessage(`Message Description ${library}/${name} deleted.`);
      return true;
    }
    else {
      return false;
    }
  };
  export const changeMessageFile = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    const chosenAction: Action = {
        "name": `CHGMSGF`,
        "command": `CHGMSGF MSGF(${library}/${name}) TEXT('${item.text}') CCSID()`,
        "environment": "ile",
        "type": "file",
        "extensions": [
          "GLOBAL"
        ]
      };
    if (await vscode.window.showWarningMessage(`Are you sure you want to delete message file ${library}/${name}?`, { modal: true }, "Clear")) {
      const commandResult = await Code4i.getConnection().runCommand({ command: `CHGMSGF MSGF(${library}/${name}) TEXT() CCSID()`, environment: `ile` });
      if (commandResult) {
        if (commandResult.code === 0 || commandResult.code === null) {
        } else {
          vscode.window.showErrorMessage(`${commandResult.stderr}.`);
        }
      }
      vscode.window.showInformationMessage(`Message File ${library}/${name} changed.`);
      return true;
    }
    else {
      return false;
    }
  };
  export const deleteMessageFile = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    if (await vscode.window.showWarningMessage(`Are you sure you want to delete message file ${library}/${name}?`, { modal: true }, "Clear")) {
      const commandResult = await Code4i.getConnection().runCommand({ command: `DLTMSGF MSGF(${library}/${name})`, environment: `ile` });
      if (commandResult) {
        if (commandResult.code === 0 || commandResult.code === null) {
        } else {
          vscode.window.showErrorMessage(`${commandResult.stderr}.`);
        }
      }
      vscode.window.showInformationMessage(`Message File ${library}/${name} deleted.`);
      return true;
    }
    else {
      return false;
    }
  };

  export const addMessageD = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    vscode.window.showErrorMessage(`Action not implemented.`);
    return false;
  };
  export const changeMessageD = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    vscode.window.showErrorMessage(`Action not implemented.`);
    return false;
  };
  export const copyMessageD = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    vscode.window.showErrorMessage(`Action not implemented.`);
    return false;
  };
  export const displayMessageD = async (item: IBMiObject | MessageFile): Promise<boolean> => {
    vscode.window.showErrorMessage(`Action not implemented.`);
    return false;
  };
}


export default class MessageFile extends Base {
  text?: string;
  static async get(library: string, name: string): Promise<string> {
    const results: any[] = await vscode.commands.executeCommand(
      `code-for-ibmi.runQuery`,
      [
        `SELECT`,
        `  MESSAGE_ID, MESSAGE_TEXT, MESSAGE_SECOND_LEVEL_TEXT, SEVERITY,`,
        `  LOG_PROBLEM, CREATION_DATE, MODIFICATION_DATE, CCSID,`,
        `  REPLY_TYPE, REPLY_LENGTH, REPLY_DECIMAL_POSITIONS, DEFAULT_REPLY, `,
        `  VALID_REPLY_VALUES, VALID_REPLY_LOWER_LIMIT, VALID_REPLY_UPPER_LIMIT, `,
        `  VALID_REPLY_RELATIONSHIP_OPERATOR, VALID_REPLY_RELATIONSHIP_VALUE`,
        `FROM QSYS2.MESSAGE_FILE_DATA WHERE`,
        `  MESSAGE_FILE_LIBRARY = '${library}' AND MESSAGE_FILE = '${name}'`
      ].join(` `)
    );

    let messageIDs: { [id: string]: any } = {};

    results.forEach(row => {
      messageIDs[row.MESSAGE_ID] = {
        id: row.MESSAGE_ID,
        text: row.MESSAGE_TEXT,
        secondText: row.MESSAGE_SECOND_LEVEL_TEXT,
        severity: row.SEVERITY,
        logProblem: row.LOG_PROBLEM,
        created: row.CREATION_DATE,
        modified: row.MODIFICATION_DATE,
        ccsid: row.CCSID,
        reply: row.REPLY ? {
          type: row.REPLY_TYPE,
          length: row.REPLY_LENGTH,
          decimals: row.REPLY_DECIMAL_POSITIONS,
          default: row.DEFAULT_REPLY,
          replies: (row.VALID_REPLY_VALUES ? row.VALID_REPLY_VALUES.split(` `) : null),
          limits: {
            lower: row.VALID_REPLY_LOWER_LIMIT,
            upper: row.VALID_REPLY_UPPER_LIMIT
          },
          relationship: {
            operator: row.VALID_REPLY_RELATIONSHIP_OPERATOR,
            value: row.VALID_REPLY_RELATIONSHIP_VALUE
          }
        } : null
      };
    });

    return JSON.stringify(messageIDs, null, 2);
  }
  async fetch() { const abc = MessageFile.get(this.library, this.name); }
  generateHTML(): string { return ``; }

  async handleAction(data: any): Promise<any> { }

  async save() { }
  setText(v:string) {this.text = v;}
}