import { QsysFsOptions } from "@halcyontech/vscode-ibmi-types";
import { Range } from "vscode";

export interface IBMiMessageQueueMessage {
  messageType?: string
  messageQueueLibrary?: string
  messageQueue?: string
  messageID?: string
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
  messageText: string
  messageTextSecondLevel?: string
  messageReply?: string
  messageReplyUser?: string
  messageReplyJob?: string
}   
export interface IBMiMessageQueue {
  messageQueueLibrary: string
  messageQueue: string
  text?: string
  protected?: boolean
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
export interface ObjLockState {
  library:string
  name:string
  lockState: string
  lockStatus: string
  lockScope: string
  jobName: string
}
export interface ObjAttributes {
  library:string
  name:string
  text: string
}
export interface SearchParms {
  messageQueue: string | undefined,
  messageQueueLibrary?: string,
  term: string | undefined,
  word: string,
}