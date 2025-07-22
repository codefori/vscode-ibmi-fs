import { CodeForIBMi, CommandResult, RemoteCommand, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { SortOrder } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import { FilterType } from '@halcyontech/vscode-ibmi-types/api/Filter';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Extension, extensions, ExtensionContext } from "vscode";
import { loadBase, getBase } from './base';
import { ObjAttributes, ObjLockState } from './typings';

let codeForIBMi: CodeForIBMi;
export namespace Code4i {
  export async function initialize(context: ExtensionContext) {
    loadBase(context);
  }

  export function getInstance() {
    return getBase()!.instance;
  }
  export function getConnection() {
    return getInstance().getConnection();
  }
  export function getConfig() {
    return getInstance().getConnection().getConfig();
  }
  export function getContent() {
    return getInstance().getConnection().getContent();
  }
  export function getStorage() {
    return getInstance().getStorage();
  }
  export function makeid(length?: number) {
    return getBase()!.tools.makeid(length);
  }
  export function findExistingDocumentUri(uri: vscode.Uri) {
    return getBase()!.tools.findExistingDocumentUri(uri);
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
  export async function getObjectList(filters: 
                        { library: string; object?: string; types?: string[]; filterType?: FilterType; member?: string; memberType?: string; }
                        , sortOrder?: SortOrder): Promise<IBMiObject[]> {
    return getContent().getObjectList(filters, sortOrder);
  }
  export async function runCommand(command: RemoteCommand): Promise<CommandResult> {
    return await getConnection().runCommand(command);
  }

}
// export async function getObjectText(objects: string[], librarys: string[], types: string[]): Promise<ObjAttributes[]> {
//   const OBJS = objects.map(object => `'${object}'`).join(', ');
//   const OBJLIBS = (librarys.length === 0 || librarys.length === 1 && librarys[0] === '*LIBL')
//       ? ''
//       : librarys.map(library => `'${library}'`).join(', ');
//   const library = (librarys.length === 1 && librarys[0] === '*LIBL')
//       ? '*LIBL'
//       : '*ALL';
//   const TYPES = types?.map(type => `'${type}'`).join(', ') || '';
//   // object = object.toUpperCase();
//   // library = library.toUpperCase();
//   // type = type.toUpperCase();

//   // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
//   const objQuery = `/*GETOBJECTTEXT*/ select OBJLONGSCHEMA SCHEMA_NAME, OBJNAME OBJECT_NAME, OBJTEXT OBJECT_TEXT
//     from table ( QSYS2.OBJECT_STATISTICS(OBJECT_SCHEMA => '${library}', OBJTYPELIST => '${TYPES}', OBJECT_NAME => '*ALL') ) OB 
//     where 1=1
//     ${OBJLIBS ? `OBJECT_SCHEMA in (${OBJLIBS})` : ''}
//     ${OBJS ? `and OBJECT_NAME in (${OBJS})` : ``}
//     limit 1
//     `.replace(/\n\s*/g, ' ');
//   let results = await Code4i!.runSQL(objQuery);
//   let objAttributes: ObjAttributes[] = [];
//   if (results.length > 0) {
//     objAttributes = results.map( (result) => 
//     ({
//       library: result.SCHEMA_NAME,
//       name: result.OBJECT_NAME,
//       text: result.OBJECT_TEXT
//     } as ObjAttributes)
//     );
//   }else {
//     objAttributes = [{
//       library: '',
//       name: '',
//       text: `I dont know where to find the text for ${librarys.values}/${objects.values}`
//     } as ObjAttributes];
//   }
//   // const objAttributes = (results.length === 0)
//   //   ? ` I dont know where to find the text for ${librarys.values}/${objects.values}`
//   //   : String(results[0].OBJECT_TEXT);
//   return objAttributes;
// }
// export async function getObjectLocks(objects: string[], librarys: string[], types: string[]): Promise<ObjLockState[]> {
//   const OBJS = objects.map(object => `'${object}'`).join(', ');
//   const OBJLIBS = (librarys.length === 0 || librarys.length === 1 && librarys[0] === '*LIBL')
//     ? 'select SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY'
//     : librarys.map(library => `'${library}'`).join(', ');
//   const TYPES = types?.map(type => `'${type}'`).join(', ') || '';
//   // object = object.toUpperCase();
//   // library = library.toUpperCase();
//   // type = type.toUpperCase();

//   // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
//   const objQuery = `/*GETOBJECTLOCKS*/ select OBJECT_SCHEMA SCHEMA_NAME, OBJECT_NAME, LOCK_STATE, LOCK_STATUS, LOCK_SCOPE, JOB_NAME
//     from QSYS2.OBJECT_LOCK_INFO ob 
//     where 1=1
//     ${OBJLIBS ? `OBJECT_SCHEMA in (${OBJLIBS})` : ''}
//     ${OBJS ? `and OBJECT_NAME in (${OBJS})` : ``}
//     ${TYPES ? `and OBJECT_TYPE in (${TYPES})` : ``}
//     limit 1`.replace(/\n\s*/g, ' ');
//   let results = await Code4i!.runSQL(objQuery);
//   let objLockState: ObjLockState[] = [];
//   if (results.length > 0) {
//     objLockState = results.map( (result) => 
//     ({
//       library: result.SCHEMA_NAME,
//       name: result.OBJECT_NAME,
//       lockState: result.LOCK_STATE,
//       lockStatus: result.LOCK_STATUS,
//       lockScope: result.LOCK_SCOPE,
//       jobName: result.JOB_NAME
//     } as ObjLockState)
//     );
//   }else {
//     objLockState = [{
//       library: '',
//       name: '',
//       jobName: `I dont know where to find the text for ${librarys.values}/${objects.values}`
//     } as ObjLockState];
//   }
//   // const objLockState = (results.length === 0)
//   //   ? ` I dont know where to find the lock information for ${librarys.values}/${objects.values}`
//   //   : String(results[0].LOCK_STATE);
//   return objLockState;
// }

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
  return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}