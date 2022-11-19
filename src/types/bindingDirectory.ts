import * as vscode from 'vscode';
import Base from "./base";
import { makeid, getTempLibrary, getTable } from '../tools';

interface Entry {
  object: string;
  library: string;
  type: string;
  activation: string;
  creation: {
    time: number;
    date: number;
  };
}

export default class BindingDirectory extends Base {
  data: Entry[]|undefined;

  dispose(): void {
    throw new Error('Method not implemented.');
  }

  async fetch(): Promise<void> {
    const tempLib = getTempLibrary();
    const tempName = makeid();

    const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
      command: `DSPBNDDIR BNDDIR(${this.library}/${this.name}) OUTPUT(*OUTFILE) OUTFILE(${tempLib}/${tempName})`,
      environment: `ile`
    });

    const rows = await getTable(tempLib, tempName);
    const results: Entry[] = rows.map(row => ({
      object: row.BNOBNM,
      library: row.BNDRLB,
      type: row.BNOBTP,
      activation: row.BNOACT,
      creation: {
        date: row.BNODAT,
        time: row.BNOTIM,
      }
    }));

    this.data = results;
  }

  generateHTML(): string {
    const body = /*html*/`<vscode-data-grid>
    <vscode-data-grid-row row-type="header">
      <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Object</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Type</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Activation</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="4">Creation</vscode-data-grid-cell>
    </vscode-data-grid-row>
    ${this.data?.map(entry => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${entry.library}/${entry.object}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${entry.type}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3">${entry.activation}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="4">${entry.creation.date}</vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>`;

    return body;
  }
}