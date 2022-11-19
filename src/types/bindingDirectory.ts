import * as vscode from 'vscode';
import Base from "./base";
import { makeid, getTempLibrary, getTable, getBase } from '../tools';

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

interface ILESymbol {
  library: string;
  object: string;
  symbol: string;
  usage: string;
}

export default class BindingDirectory extends Base {
  entries: Entry[] | undefined;
  exports: ILESymbol[]|undefined;

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

    if (command.code === 0) {
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

      this.entries = results;
      this.exports = await this.getExports();
    }
  }

  generateHTML(): string {
    const entriesTab = /*html*/`<vscode-data-grid>
    <vscode-data-grid-row row-type="header">
      <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Object</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Type</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Activation</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="4">Creation</vscode-data-grid-cell>
    </vscode-data-grid-row>
    ${this.entries?.map(entry => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${entry.library}/${entry.object}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${entry.type}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3">${entry.activation}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="4">${entry.creation.date}</vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>
    
    <vscode-button href="action://doathing#abcd-sdfnsdf">
      Do a thing
      <span slot="start" class="codicon codicon-add"></span>
    </vscode-button>
    `;

    const exportsTab = /*html*/`<vscode-data-grid>
    <vscode-data-grid-row row-type="header">
      <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Symbol</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Object</vscode-data-grid-cell>
      <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Usage</vscode-data-grid-cell>
    </vscode-data-grid-row>
    ${this.exports?.map(entry => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${entry.symbol}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${entry.library}/${entry.object}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3">${entry.usage}</vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>`;

    const panels = /*html*/`
    <vscode-panels>
      <vscode-panel-tab id="tab-1">
        ENTRIES
        <vscode-badge appearance="secondary">${this.entries?.length}</vscode-badge>
      </vscode-panel-tab>
      <vscode-panel-tab id="tab-2">
        EXPORTS
        <vscode-badge appearance="secondary">${this.exports?.length}</vscode-badge>
      </vscode-panel-tab>
      <vscode-panel-view id="view-1">${entriesTab}</vscode-panel-view>
      <vscode-panel-view id="view-2">${exportsTab}</vscode-panel-view>
    </vscode-panels>`;

    return panels;
  }

  handleAction(data: any): void {
    console.log(data);
  }

  private async getExports(): Promise<ILESymbol[]|undefined> {
    const instance = getBase();

    const connection = instance.getConnection();
    if (connection) {
      const config = instance.getConfig();
      const libraryList = [config.currentLibrary, ...config.libraryList];
      const libraryInList = libraryList.map(lib => `'${lib.toUpperCase()}'`).join(`, `);

      const query = [
        `select `,
        `  b.PROGRAM_LIBRARY,`,
        `  b.PROGRAM_NAME,`,
        `  b.SYMBOL_NAME,`,
        `  b.SYMBOL_USAGE`,
        `from QSYS2.PROGRAM_EXPORT_IMPORT_INFO as b`,
        `right join qsys2.BINDING_DIRECTORY_INFO as c`,
        `  on c.ENTRY = b.PROGRAM_NAME`,
        `where `,
        `  (c.BINDING_DIRECTORY_LIBRARY = '${this.library.toUpperCase()}' and c.BINDING_DIRECTORY = '${this.name.toUpperCase()}') `,
        `  and`,
        `  (c.ENTRY_LIBRARY = b.PROGRAM_LIBRARY or (c.ENTRY_LIBRARY = '*LIBL' and b.PROGRAM_LIBRARY in (${libraryInList})))`,
      ].join(` `);

      const rows: any[] = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, query);

      return rows.map(row => ({
        library: row.PROGRAM_LIBRARY,
        object: row.PROGRAM_NAME,
        symbol: row.SYMBOL_NAME,
        usage: row.SYMBOL_USAGE
      }));
    }
  }
}