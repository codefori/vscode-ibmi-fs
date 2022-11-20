import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";

export default class Program extends Base {
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  private info?: any;

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
      reorganizeFields(programInfo);

      this.info = programInfo;
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
    const programTab = /*html*/`<vscode-data-grid>
    ${Object.entries(this.info).filter(row => row[1]).map(row => {
      return /*html*/`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1">${this.columns.get(row[0]) || row[0]}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${row[1]}</vscode-data-grid-cell>
      </vscode-data-grid-row>`;
    }).join("")}
    </vscode-data-grid>`;

    return programTab;
  }

  handleAction(data: any): boolean {
    return false;
  }

  save(): Promise<void> {
    throw new Error("Method not implemented.");
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
