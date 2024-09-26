import * as vscode from 'vscode';
import { Code4i } from '../tools';
import { Components } from '../webviewToolkit';
import Base from "./base";

type MessageDescription = {
  id: string
  severity: string
  ccsid: number
  text: string
}

export default class MessageFile extends Base {
  private readonly messages: MessageDescription[] = [];

  async fetch() {
    this.messages.splice(0, this.messages.length);

    (await Code4i.getConnection().runSQL(`
      select MESSAGE_ID, CCSID, SEVERITY, MESSAGE_TEXT
      from QSYS2.MESSAGE_FILE_DATA
      where MESSAGE_FILE_LIBRARY = '${this.library}' and MESSAGE_FILE = '${this.name}'
      order by MESSAGE_ID
    `))
      .forEach(row => this.messages.push({
        id: String(row.MESSAGE_ID),
        severity: String(row.SEVERITY),
        ccsid: Number(row.CCSID),
        text: String(row.MESSAGE_TEXT)
      }));
  }

  generateHTML(): string {
    return Components.dataGrid<MessageDescription>({
      stickyHeader: true,
      columns: [
        { title: "ID", size: "100px", cellValue: message => message.id },
        { title: "Severity", size: "80px", cellValue: message => message.severity },
        { title: "CCSID", size: "100px", cellValue: message => String(message.ccsid) },
        { title: "Text", cellValue: message => message.text }
      ]
    }, this.messages);
  }

  async handleAction(data: any) {
    //Maybe later
    return {};
  }

  async save() {
    //Maybe later
  }


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
}