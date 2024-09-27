import { CodeForIBMi, CommandResult, RemoteCommand } from '@halcyontech/vscode-ibmi-types';
import Instance from "@halcyontech/vscode-ibmi-types/api/Instance";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Extension, extensions } from "vscode";

let codeForIBMi: CodeForIBMi;
let baseExtension: Extension<CodeForIBMi> | undefined;
export namespace Code4i {
  export async function initialize() {
    // const baseExtension = vscode.extensions.getExtension<CodeForIBMi>(`halcyontechltd.code-for-ibmi`);
    baseExtension = (extensions ? extensions.getExtension(`halcyontechltd.code-for-ibmi`) : undefined);
    if (baseExtension) {
      codeForIBMi = (baseExtension.isActive ? baseExtension.exports : await baseExtension.activate());
    }
    else {
      throw new Error("halcyontechltd.code-for-ibmi not found or cannot be activated");
    }
  }

  export function getConnection() {
    return codeForIBMi.instance.getConnection();
  }

  export function getConfig() {
    return codeForIBMi.instance.getConfig();
  }

  export function getContent() {
    return codeForIBMi.instance.getContent();
  }

  export function getTempLibrary(): string {
    return getConfig().tempLibrary;
  }

  export async function getTable(library: string, name: string): Promise<Tools.DB2Row[]> {
    return getContent().getTable(library, name, name, true);
  }

  export async function runSQL(sqlStatement: string): Promise<Tools.DB2Row[]> {
    return getContent().ibmi.runSQL(sqlStatement);
  }

  export async function runCommand(command: RemoteCommand): Promise<CommandResult> {
    return await getConnection().runCommand(command);
  }

  export async function getObjectText(object: string, library: string, type: string): Promise<string | undefined> {
    object = object.toUpperCase();
    library = library.toUpperCase();
    type = type.toUpperCase();

    // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
    const objQuery = `/*GETOBJECTTEXT*/ select OB.OBJTEXT OBJECT_TEXT
  from table ( QSYS2.OBJECT_STATISTICS(OBJECT_SCHEMA => '${library}', OBJTYPELIST => '${type}', OBJECT_NAME => '${object}') ) OB 
  limit 1 /*GETOBJECTTEXT*/`;
    let results = await Code4i!.runSQL(objQuery);
    if (results.length === 0) {
      return ` I dont know where to find the text for ${library}/${object}`;
    }
    const objText: string = String(results[0].OBJECT_TEXT);
    return objText;
  }
}

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
  return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}
export function findExistingDocumentUri(uri: vscode.Uri) {
  return codeForIBMi.tools.findExistingDocumentUri(uri);
}
export function makeid(length?: number) {
  return codeForIBMi.tools.makeid(length);
}
export function getInstance(): Instance | undefined {
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.instance : undefined);
}
export async function checkObject(library: string, name: string, type: string) {
  return await Code4i.getContent().checkObject({ library, name, type });
};
