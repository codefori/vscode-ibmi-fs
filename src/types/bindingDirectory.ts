import * as vscode from 'vscode';
import Base from "./base";
import { makeid, getTempLibrary, getTable, getBase } from '../tools';

enum EntryStatus {
  existed,
  created,
  deleted,
}

interface Entry {
  object: string;
  library: string;
  type: string;
  activation: string;
  creation: {
    time: number;
    date: number;
  };
  status: EntryStatus,
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
        },
        status: EntryStatus.existed
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
      <vscode-data-grid-cell cell-type="columnheader" grid-column="5">Creation</vscode-data-grid-cell>
    </vscode-data-grid-row>
    ${this.entries?.filter(entry => entry.status !== EntryStatus.deleted).map(entry => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${entry.library}/${entry.object}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${entry.type}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="3">${entry.activation}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="4">${entry.creation.date}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="5">
        <vscode-link href="action:delete" entrylibrary="${entry.library}" entryobject="${entry.object}">
          Delete
        </vscode-button>
        </vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>
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

  async save(): Promise<void> {
    if (this.entries) {
      const deleted = this.entries?.filter(entry => entry.status === EntryStatus.deleted);
      const created = this.entries?.filter(entry => entry.status === EntryStatus.created);

      for (const currentEntry of deleted) {
        const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
          command: `RMVBNDDIRE BNDDIR(${this.library}/${this.name}) OBJ(${currentEntry.library}/${currentEntry.object})`,
          environment: `ile`
        });

        if (command.code && command.code >= 1) {
          throw new Error(command.stderr);
        }

        const existingIndex = this.entries.findIndex(entry => entry.library === currentEntry.library && entry.object === currentEntry.object);
        if (existingIndex) { 
          this.entries.splice(existingIndex, 1);
        }
      }

      if (created.length > 0) {
        const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
          command: `ADDBNDDIRE BNDDIR(${this.library}/${this.name}) OBJ(${created.map(currentEntry => `(${currentEntry.library}/${currentEntry.object} ${currentEntry.type} ${currentEntry.activation})`)})`,
          environment: `ile`
        });
        if (command.code && command.code >= 1) {
          throw new Error(command.stderr);
        }

        created.forEach(currentEntry => {
          currentEntry.status = EntryStatus.existed;
        });
      }
    }
  }

  handleAction(data: any): boolean {
    const uri = vscode.Uri.parse(data.href);
    switch (uri.path) {
      case `delete`:
        return this.deleteEntry(data);
    }

    return false;
  }

  private deleteEntry(data: {entrylibrary: string, entryobject: string}) {
    if (this.entries) {
      const existingIndex = this.entries?.findIndex(entry => entry.library === data.entrylibrary && entry.object === data.entryobject);
      if (existingIndex !== undefined && existingIndex >= 0) {
        this.entries[existingIndex].status = EntryStatus.deleted;
        return true;
      }
    }

    return false;
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