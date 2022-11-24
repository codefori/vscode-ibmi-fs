import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";
import { Components } from "../webviewToolkit";

export default class Program extends Base {
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  private info?: any;
  private type: string = ``;
  private boundModules?: ILEModule[];
  private boundServicePrograms?: ILEServiceProgram[];
  private exportedSymbols?: ILEExport[];

  async fetch(): Promise<void> {
    const instance = getBase();
    const connection = instance.getConnection();
    const content = instance.getContent();
    if (connection && content) {
      await this.loadProgramInfoColumns(content);

      const library = this.library.toUpperCase();
      const name = this.name.toUpperCase();

      //https://www.ibm.com/docs/en/i/7.4?topic=services-program-info-view
      const [programInfo] = await content.runSQL(`Select ${this.selectClause} From QSYS2.PROGRAM_INFO Where PROGRAM_LIBRARY = '${library}' And PROGRAM_NAME = '${name}'`);

      this.type = programInfo.OBJECT_TYPE;

      reorganizeFields(programInfo);
      this.info = programInfo;

      [this.boundModules, this.boundServicePrograms, this.exportedSymbols] =
        await Promise.all([
          getBoundModules(library, name),
          getBoundServicePrograms(library, name),
          getServiceProgramExports(library, name)
        ]);
    } else {
      throw new Error(`No connection`);
    }
  }

  private async loadProgramInfoColumns(content: any) {
    if (!this.selectClause) {
      this.selectClause = "";
      const hasFullSQL = content.ibmi.config?.enableSQL;
      //https://www.ibm.com/docs/en/i/7.4?topic=views-syscolumns2
      const columnDetail = await content.runSQL(`Select COLUMN_NAME, ${this.castIfNeeded("COLUMN_HEADING", 60, hasFullSQL)}, CCSID, LENGTH From QSYS2.SYSCOLUMNS2 Where TABLE_NAME = 'PROGRAM_INFO'`);

      columnDetail.forEach((column: any) => {
        const name = column.COLUMN_NAME!.toString();
        if (name !== "PROGRAM_NAME" && name !== "PROGRAM_LIBRARY") {
          const heading = this.parseHeading(column.COLUMN_HEADING!.toString());
          const length = Number(column.LENGTH);
          this.columns.set(name, heading);
          this.selectClause += (this.selectClause ? ',' : '') + this.castIfNeeded(name, length, hasFullSQL || (column.CCSID || 0) !== 1200);
        }
      });
    }
  }

  /**
   * Casts a column to CCSID 37 in case our user uses an undefined CCSID.
   * (so everyone can enjoy this feature)
   * @returns the column name or Cast(`columnName` As VarChar(`length`) CCSID 37) As `columnName` if user's CCSId is undefined
   */
  private castIfNeeded(columnName: string, length: number, hasFullSQL?: boolean): string {
    return hasFullSQL ? columnName : `Cast(${columnName} As VarChar(${length}) CCSID 37) As ${columnName}`;
  }

  private parseHeading(rawHeading: string): string {
    const partSize = 20;
    const parts = Math.ceil(rawHeading.length / partSize);
    let heading = "";
    for (let part = 0; part < parts; part++) {
      heading += rawHeading.substring(partSize * part, partSize * (part + 1)).trim() + " ";
    }
    return heading.trimEnd();
  }

  generateHTML(): string {
    const detailTab = /*html*/`<vscode-data-grid>
    ${Object.entries(this.info).filter(row => row[1]).map(row => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${this.columns.get(row[0]) || row[0]}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${row[1]}</vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>`;

    const boundTab = /*html*/`
      <section>
        ${this.boundModules ?
        Components.dataGrid<ILEModule>({
          columns: [
            { title: "Module", cellValue: d => `${d.library}/${d.object}` },
            { title: "Attribute", cellValue: d => d.attribute },
            { title: "Created", cellValue: d => d.created },
            { title: "Debug Data Available", cellValue: d => d.debugData }
          ]
        }, this.boundModules)
        : ``}
      </section>

      <section>
        ${Components.divider()}
      </section>

      <section>
        ${this.boundServicePrograms ?
        Components.dataGrid<ILEServiceProgram>({
          columns: [
            { title: "Service Program", cellValue: d => `${d.library}/${d.object}` },
            { title: "Signature", cellValue: d => d.signature },
          ]
        }, this.boundServicePrograms)
        : ``}
      </section>
    `;

    const exportsAvailable = this.type === `*SRVPGM`;

    let exportsTab = ``;
    if (exportsAvailable && this.exportedSymbols) {
      exportsTab = Components.dataGrid<ILEExport>({
        stickyHeader: true,
        columns: [
          { title: "Symbol", cellValue: d => d.name },
          { title: "Usage", cellValue: d => d.usage },
        ]
      }, this.exportedSymbols);
    }

    const boundCount = (this.boundModules ? this.boundModules.length : 0) + (this.boundServicePrograms ? this.boundServicePrograms.length : 0);

    const panels = /*html*/`
      <vscode-panels>
        <vscode-panel-tab id="tab-1">
          DETAIL
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-2">
          BOUND
          <vscode-badge appearance="secondary">${boundCount}</vscode-badge>
        </vscode-panel-tab>
        ${exportsAvailable ?
          /*html*/`
          <vscode-panel-tab id="tab-3">
            EXPORTS
            <vscode-badge appearance="secondary">${this.exportedSymbols?.length}</vscode-badge>
          </vscode-panel-tab>
          `
        : ``
      }
        <vscode-panel-view id="view-1">${detailTab}</vscode-panel-view>
        <vscode-panel-view id="view-2">${boundTab}</vscode-panel-view>
        ${exportsAvailable ? `<vscode-panel-view id="view-3">${exportsTab}</vscode-panel-view>` : ``}
      </vscode-panels>`;

    return panels;
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    return {};
  }

  save(): Promise<void> {
    //throw new Error("Method not implemented.");
    return Promise.resolve();
  }
}

function reorganizeFields(programInfo: any) {
  if (programInfo.PROGRAM_ENTRY_PROCEDURE_MODULE) {
    programInfo.PROGRAM_ENTRY_PROCEDURE_MODULE = `${programInfo.PROGRAM_ENTRY_PROCEDURE_MODULE_LIBRARY}/${programInfo.PROGRAM_ENTRY_PROCEDURE_MODULE}`;
    programInfo.PROGRAM_ENTRY_PROCEDURE_MODULE_LIBRARY = null;
  }

  if (programInfo.EXPORT_SOURCE_FILE) {
    programInfo.EXPORT_SOURCE_FILE = `${programInfo.EXPORT_SOURCE_LIBRARY}/${programInfo.EXPORT_SOURCE_FILE},${programInfo.EXPORT_SOURCE_FILE_MEMBER}`;
    programInfo.EXPORT_SOURCE_LIBRARY = null;
    programInfo.EXPORT_SOURCE_FILE_MEMBER = null;
  }

  if (programInfo.PROCEDURE_EXPORTS) {
    programInfo.PROCEDURE_EXPORTS = `${programInfo.PROCEDURE_EXPORTS} / ${programInfo.MAXIMUM_PROCEDURE_EXPORTS}`;
    programInfo.MAXIMUM_PROCEDURE_EXPORTS = null;
  }

  if (programInfo.AUXILIARY_STORAGE_SEGMENTS) {
    programInfo.AUXILIARY_STORAGE_SEGMENTS = `${programInfo.AUXILIARY_STORAGE_SEGMENTS} / ${programInfo.MAXIMUM_AUXILIARY_STORAGE_SEGMENTS}`;
    programInfo.MAXIMUM_AUXILIARY_STORAGE_SEGMENTS = null;
  }

  if (programInfo.PROGRAM_SIZE) {
    programInfo.PROGRAM_SIZE = `${programInfo.PROGRAM_SIZE} / ${programInfo.MAXIMUM_PROGRAM_SIZE}`;
    programInfo.MAXIMUM_PROGRAM_SIZE = null;
  }

  if (programInfo.MODULES) {
    programInfo.MODULES = `${programInfo.MODULES} / ${programInfo.MAXIMUM_MODULES}`;
    programInfo.MAXIMUM_MODULES = null;
  }

  if (programInfo.STRING_DIRECTORY_SIZE) {
    programInfo.STRING_DIRECTORY_SIZE = `${programInfo.STRING_DIRECTORY_SIZE} / ${programInfo.MAXIMUM_STRING_DIRECTORY_SIZE}`;
    programInfo.MAXIMUM_STRING_DIRECTORY_SIZE = null;
  }

  if (programInfo.SERVICE_PROGRAMS) {
    programInfo.SERVICE_PROGRAMS = `${programInfo.SERVICE_PROGRAMS} / ${programInfo.MAXIMUM_SERVICE_PROGRAMS}`;
    programInfo.MAXIMUM_SERVICE_PROGRAMS = null;
  }

  if (programInfo.COPYRIGHT_STRING_SIZE) {
    programInfo.COPYRIGHT_STRING_SIZE = `${programInfo.COPYRIGHT_STRING_SIZE} / ${programInfo.MAXIMUM_COPYRIGHT_STRING_SIZE}`;
    programInfo.MAXIMUM_COPYRIGHT_STRING_SIZE = null;
  }

  if (programInfo.DATA_EXPORTS) {
    programInfo.DATA_EXPORTS = `${programInfo.DATA_EXPORTS} / ${programInfo.MAXIMUM_DATA_EXPORTS}`;
    programInfo.MAXIMUM_DATA_EXPORTS = null;
  }

  if (programInfo.SOURCE_FILE) {
    programInfo.SOURCE_FILE = `${programInfo.SOURCE_FILE_LIBRARY}/${programInfo.SOURCE_FILE},${programInfo.SOURCE_FILE_MEMBER}`;
    programInfo.SOURCE_FILE_LIBRARY = null;
    programInfo.SOURCE_FILE_MEMBER = null;
  }

  if (programInfo.SORT_SEQUENCE && programInfo.SORT_SEQUENCE_LIBRARY) {
    programInfo.SORT_SEQUENCE = `${programInfo.SORT_SEQUENCE_LIBRARY}/${programInfo.SORT_SEQUENCE}`;
    programInfo.SORT_SEQUENCE_LIBRARY = null;
  }

  if (programInfo.SQL_SORT_SEQUENCE && programInfo.SQL_SORT_SEQUENCE_LIBRARY) {
    programInfo.SQL_SORT_SEQUENCE = `${programInfo.SQL_SORT_SEQUENCE_LIBRARY}/${programInfo.SQL_SORT_SEQUENCE}`;
    programInfo.SQL_SORT_SEQUENCE_LIBRARY = null;
  }

  if (programInfo.SQL_PACKAGE_LIBRARY && programInfo.SQL_PACKAGE) {
    programInfo.SQL_PACKAGE = `${programInfo.SQL_PACKAGE_LIBRARY}/${programInfo.SQL_PACKAGE}`;
    programInfo.SQL_PACKAGE_LIBRARY = null;
  }
}

interface ILEModule {
  library: string;
  object: string;
  attribute: string;
  created: string;
  debugData: "*YES" | "*NO";
}

async function getBoundModules(library: string, object: string): Promise<ILEModule[]> {
  const query = [
    `select `,
    `  a.BOUND_MODULE_LIBRARY,`,
    `  a.BOUND_MODULE,`,
    `  a.MODULE_ATTRIBUTE,`,
    `  a.MODULE_CREATE_TIMESTAMP,`,
    `  a.DEBUG_DATA`,
    `from QSYS2.BOUND_MODULE_INFO as a`,
    `where a.PROGRAM_LIBRARY = '${library}' and a.PROGRAM_NAME = '${object}'`
  ].join(` `);

  const rows: any[] = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, query);
  return rows.map(row => ({
    library: row.BOUND_MODULE_LIBRARY,
    object: row.BOUND_MODULE,
    attribute: row.MODULE_ATTRIBUTE,
    created: row.MODULE_CREATE_TIMESTAMP,
    debugData: row.DEBUG_DATA
  }));
}

interface ILEServiceProgram {
  library: string;
  object: string;
  signature: string;
}

async function getBoundServicePrograms(library: string, object: string): Promise<ILEServiceProgram[]> {
  const query = [
    `select `,
    `  a.BOUND_SERVICE_PROGRAM_LIBRARY,`,
    `  a.BOUND_SERVICE_PROGRAM,`,
    `  a.BOUND_SERVICE_PROGRAM_SIGNATURE`,
    `from QSYS2.BOUND_SRVPGM_INFO as a`,
    `where a.PROGRAM_LIBRARY = '${library}' and a.PROGRAM_NAME = '${object}'`
  ].join(` `);

  const rows: any[] = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, query);
  return rows.map(row => ({
    library: row.BOUND_SERVICE_PROGRAM_LIBRARY,
    object: row.BOUND_SERVICE_PROGRAM,
    signature: row.BOUND_SERVICE_PROGRAM_SIGNATURE
  }));
}

interface ILEExport {
  name: string;
  usage: string;
}

async function getServiceProgramExports(library: string, object: string): Promise<ILEExport[]> {
  const query = [
    `select `,
    `  a.SYMBOL_NAME,`,
    `  a.SYMBOL_USAGE`,
    `from QSYS2.PROGRAM_EXPORT_IMPORT_INFO as a`,
    `where a.PROGRAM_LIBRARY = '${library}' and a.PROGRAM_NAME = '${object}'`
  ].join(` `);

  const rows: any[] = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, query);
  return rows.map(row => ({
    name: row.SYMBOL_NAME,
    usage: row.SYMBOL_USAGE,
  }));
}