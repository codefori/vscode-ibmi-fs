import * as vscode from 'vscode';
import Base from "./base";
import { makeid, Code4i } from '../tools';
import { Components } from '../webviewToolkit';

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
  exports: ILESymbol[] | undefined;

  async fetch(): Promise<void> {
    const tempLib = Code4i.getTempLibrary();
    const tempName = makeid();
    
    const command = await Code4i.runCommand({
      command: `DSPBNDDIR BNDDIR(${this.library}/${this.name}) OUTPUT(*OUTFILE) OUTFILE(${tempLib}/${tempName})`,
      environment: `ile`
    });

    if (command.code === 0) {
      const rows = await Code4i.getTable(tempLib, tempName);
      const results: Entry[] = rows.map(row => ({
        object: String(row.BNOBNM),
        library: String(row.BNOLNM),
        type: String(row.BNOBTP),
        activation: String(row.BNOACT),
        creation: {
          date: Number(row.BNODAT),
          time: Number(row.BNOTIM),
        },
        status: EntryStatus.existed
      }));

      this.entries = results;
      this.exports = await this.getExports();
    }
  }

  generateHTML(): string {
    const entriesTab = Components.dataGrid<Entry>(
      {columns: [
        {title: `Object`, cellValue: entry => `${entry.library}/${entry.object}`},
        {title: `Type`, cellValue: entry => entry.type},
        {title: `Activation`, cellValue: entry => entry.activation},
        {title: `Creation`, cellValue: entry => `${entry.creation.date} ${entry.creation.time}`},
        {title: ``, cellValue: entry => /*html*/`<vscode-link href="action:delete" entrylibrary="${entry.library}" entryobject="${entry.object}">Delete</vscode-link>`}
      ]},
      this.entries?.filter(entry => entry.status !== EntryStatus.deleted) || []
    );

    // We need a form builder!!!
    const addTab = /*html*/`
      <form>
        ${Components.textField(`inLibrary`, `Entry library`, { value: "*LIBL", maxlength: 10 })}
        <br><br>
        ${Components.textField(`inObject`, `Entry object`, { value: "*ALL", maxlength: 10, focused: true })}
        <br>
        <section>
          <p>Object Type</p>
          <vscode-single-select id="inType" readonly="false">
            <vscode-option selected>*SRVPGM</vscode-option>
            <vscode-option>*MODULE</vscode-option>
          </vscode-single-select>
        </section>
        <br>
        <section>
          <p>Activation</p>
          <vscode-single-select id="inActivation" readonly="false">
            <vscode-option selected>*IMMED</vscode-option>
            <vscode-option>*DEFER</vscode-option>
          </vscode-single-select>
        </section>
        <br><br>
        ${Components.button("Cancel", { action: "cancel" })}
      </form>
    `;

    const newExportsTab = Components.dataGrid<ILESymbol>(
      {columns: [
        {title: `Symbol`, cellValue: entry => entry.symbol},
        {title: `Object`, cellValue: entry => `${entry.library}/${entry.object}`},
        {title: `Usage`, cellValue: entry => entry.usage}
      ]},
      this.exports || []
    );

    const newPanels = Components.panels([
      { title: "Entries", content: entriesTab },
      { title: "Add", content: addTab },
      { title: "Exports", content: newExportsTab }
    ]);

    return newPanels;
  }

  async save(): Promise<void> {
    if (this.entries) {
      const deleted = this.entries?.filter(entry => entry.status === EntryStatus.deleted);
      const created = this.entries?.filter(entry => entry.status === EntryStatus.created);

      for (const currentEntry of deleted) {
        // For some reason, BNDDIR commands always post to standard out...
        const command = await Code4i.runCommand({
          command: `RMVBNDDIRE BNDDIR(${this.library}/${this.name}) OBJ(${currentEntry.library}/${currentEntry.object})`,
          environment: `ile`
        });

        if (!command.stderr.startsWith(`CPD5D1B`)) {
          throw new Error(command.stderr);
        }

        const existingIndex = this.entries.findIndex(entry => entry.library === currentEntry.library && entry.object === currentEntry.object);
        if (existingIndex) {
          this.entries.splice(existingIndex, 1);
        }
      }

      if (created.length > 0) {
        const command = await Code4i.runCommand({
          command: `ADDBNDDIRE BNDDIR(${this.library}/${this.name}) OBJ(${created.map(currentEntry => `(${currentEntry.library}/${currentEntry.object} ${currentEntry.type} ${currentEntry.activation})`).join(` `)})`,
          environment: `ile`
        });

        if (!command.stderr.startsWith(`CPD5D0A`)) {
          throw new Error(command.stderr);
        }

        created.forEach(currentEntry => {
          currentEntry.status = EntryStatus.existed;
        });
      }
    }
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
    switch (uri.path) {
      case `delete`:
        return this.deleteEntry(data);
      case `create`:
        return this.createEntry(data.bindings);
    }

    return {};
  }

  createEntry(data: { inLibrary: string, inObject: string, inType: string, inActivation: string }): HandleActionResult {
    if (this.entries) {
      if (data.inLibrary && data.inObject) {
        data.inLibrary = data.inLibrary.toUpperCase();
        data.inObject = data.inObject.toUpperCase();

        const exists = this.entries.some(entry => entry.library === data.inLibrary && entry.object === data.inObject);

        if (!exists) {
          this.entries.push({
            library: data.inLibrary,
            object: data.inObject,
            type: data.inType,
            activation: data.inActivation,
            status: EntryStatus.created,
            creation: {
              date: 0,
              time: 0
            }
          });

          return {
            dirty: true,
            rerender: true
          };
        } else {
          vscode.window.showErrorMessage(`Object already exists on binding directory.`);
        }
      } else {
        vscode.window.showErrorMessage(`Library name or object name not valid.`);
      }
    }
    return {};
  }

  private deleteEntry(data: { entrylibrary: string, entryobject: string }): HandleActionResult {
    if (this.entries) {
      const existingIndex = this.entries?.findIndex(entry => entry.library === data.entrylibrary && entry.object === data.entryobject);
      if (existingIndex !== undefined && existingIndex >= 0) {
        this.entries[existingIndex].status = EntryStatus.deleted;
        return {
          dirty: true,
          rerender: true
        };
      }
    }

    return {};
  }

  private async getExports(): Promise<ILESymbol[] | undefined> {

    const connection = Code4i.getConnection();
    if (connection) {
      const config = Code4i.getConfig();
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

      const rows = await Code4i.getContent().runSQL(query);
      return rows.map(row => ({
        library: String(row.PROGRAM_LIBRARY),
        object: String(row.PROGRAM_NAME),
        symbol: String(row.SYMBOL_NAME),
        usage: String(row.SYMBOL_USAGE)
      }));
    }
  }
}