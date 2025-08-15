import { CodeForIBMi, CommandResult, RemoteCommand, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { SortOrder } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import { FilterType } from '@halcyontech/vscode-ibmi-types/api/Filter';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { ExtensionContext } from "vscode";
import { loadBase, getBase } from './base';
import { IBMiMessageQueueFilter, IBMiMessageQueueMessage, IBMiUserJobsFilter } from './typings';

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

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
  return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}