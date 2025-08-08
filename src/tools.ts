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
export function buildPathFileNamefromPattern(filterType: string, msg: IBMiMessageQueueMessage): string {
  let newName = ``;
  newName += `${msg.messageQueueLibrary}/${msg.messageQueue}/`;
  let counter = 0;
  // get from config
  const splfBrowserConfig = vscode.workspace.getConfiguration('vscode-ibmi-fs');
  let namePattern: string = splfBrowserConfig.get<string>('messageViewNamePattern') || '';
  if (namePattern.length === 0) { namePattern = 'messageType,messageID,messageKey'; }
  // pattern values are separated by commas.  
  const patterns = namePattern.split(/,\s*/);
  // append pattern to end of passed in name.
  patterns.forEach(element => {
    if (counter > 0) {
      newName += '~';
    }
    counter++;
    switch (element) {

    case `messageType`:
      newName += msg.messageType;
      break;
    case `messageID`:
      newName += msg.messageID;
      break;
    case `messageKey`:
      newName += msg.messageKey;
      break;
    default:
    }
  });

  return newName;
}
export function breakUpPathFileName(pPath: string): Map<string, string> {
  const myConfig = vscode.workspace.getConfiguration('vscode-ibmi-fs');
  let namePattern: string = myConfig.get<string>('messageViewNamePattern') || '';
  if (namePattern.length === 0) { namePattern = 'messageType,messageID,messageKey'; }

  // pattern values are separated by commas.  
  const patterns = namePattern.split(/,\s*/);
  const pathParts = pPath.split('/');
  const nameParts = pathParts[2].split(/[~.]/);

  const namePartMap: Map<string, string> = new Map();
  namePartMap.set('type', '*MSGQ');
  namePartMap.set('messageQueueLibrary', pathParts[0]);
  namePartMap.set('messageQueue', pathParts[1]);

  for (let i = 0; i < patterns.length; i++) {
    namePartMap.set(patterns[i], nameParts[i]);
  }

  return namePartMap;
}
export function saveFilterValuesMessages(singleFilter: IBMiMessageQueueFilter): boolean {
  const config = Code4i.getConfig();
  let messageQueues: IBMiMessageQueueFilter[] = config[`messageQueues`] || [];
  const foundFilter = messageQueues.find(queue => queue.messageQueueLibrary === singleFilter.messageQueueLibrary
    && queue.messageQueue === singleFilter.messageQueue
    && queue.type === singleFilter.type
  );

  if (!foundFilter) {
    messageQueues.push(singleFilter);
    config.messageQueues = messageQueues;
    Code4i.getInstance()!.setConfig(config);
    return true;
  }
  return false;
}
export function saveFilterValuesUserJobs(singleFilter: IBMiUserJobsFilter): boolean {
  const config = Code4i.getConfig();
  let userJobs: IBMiUserJobsFilter[] = config[`userJobs`] || [];
  const foundFilter = userJobs.find(userJob => userJob.user === singleFilter.user);

  if (!foundFilter) {
    userJobs.push(singleFilter);
    config.userJobs = userJobs;
    Code4i.getInstance()!.setConfig(config);
    return true;
  }
  return false;
}