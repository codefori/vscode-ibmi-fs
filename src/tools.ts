import IBMi from '@halcyontech/vscode-ibmi-types/api/IBMi';
import { getInstance } from "./ibmi";

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
    return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}

export async function getColumns(ibmi: IBMi, table: String) {

    //https://www.ibm.com/docs/en/i/7.4?topic=views-syscolumns2
    let columns: Map<string, string> = new Map();
    const columnDetail = await ibmi.runSQL(`Select COLUMN_NAME, "COLUMN_HEADING", CCSID, LENGTH From QSYS2.SYSCOLUMNS2 Where TABLE_NAME = '${table}'`);

    columnDetail.forEach((column) => {
        const name = column.COLUMN_NAME!.toString();
        const heading = parseHeading(column.COLUMN_HEADING!.toString());
        const length = Number(column.LENGTH);
        columns.set(name, heading);
    });

    return columns;
    
}

function parseHeading(rawHeading: string): string {
    const partSize = 20;
    const parts = Math.ceil(rawHeading.length / partSize);
    let heading = "";
    for (let part = 0; part < parts; part++) {
      heading += rawHeading.substring(partSize * part, partSize * (part + 1)).trim() + " ";
    }
    return heading.trimEnd();
  }

function castIfNeeded(columnName: string, length: number, hasFullSQL?: boolean): string {
    return hasFullSQL ? columnName : `Cast(${columnName} As VarChar(${length}) CCSID 37) As ${columnName}`;
}