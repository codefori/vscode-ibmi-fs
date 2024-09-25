import { QsysFsOptions } from "@halcyontech/vscode-ibmi-types";
import { Range } from "vscode";

export interface IBMiMessageQueueMessage {
  messageQueueLibrary?: string
  messageQueue?: string
  messageID?: string
  messageType?: string
  messageSubType?: string
  severity?: string
  messageTimestamp?: string
  messageKey?: string
  messageKeyAssociated?: string
  fromUser?: string
  fromJob?: string
  fromProgram? :string
  messageFileLibrary?: string
  messageFile?: string
  messageTokens?: string
  messageText?: string
  messageTextSecondLevel?: string
}  
export interface IBMiMessageQueueViewItem {
  messageQueueLibrary: string
  messageQueue: string
  messageID: string
  messageKey: string
  messageText: string
}  
export interface IBMiMessageQueue {
  messageQueueLibrary: string
  messageQueue: string
  text?: string
}  

export interface MsgOpenOptions {
  readonly?: boolean;
}

export interface FuncInfo {
  funcSysLib: string
  funcSysName: string
  text: string
  comment: string
}

export interface SearchParms {
  messageQueue: string | undefined,
  messageQueueLibrary?: string,
  term: string | undefined,
  word: string,
}