import { QsysFsOptions } from "@halcyontech/vscode-ibmi-types";
import { Range } from "vscode";
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';

export interface ErrorDS {
  errorID?: string
  errorText?: string
}
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
  messageReplyProgram?: string
  messageReplyTimestamp?: string
}   
export interface IBMiMessageQueueFilter {
  messageQueueLibrary: string
  messageQueue: string
  type: string
}   
export interface IBMiMessageQueue extends IBMiMessageQueueFilter {
  text?: string
  protected?: boolean
}  
export interface IBMiMessageFile{
  messageFileLibrary?: string
  messageFile?: string
  messageText?: string
  messageIDCount?: number
}
export interface IBMiMessageIDDetails{
  messageFileLibrary?: string
  messageFile?: string
  messageId?: string
  messageText?: string
  messageSecondLevelText?: string
  severity?: number
  messageDataCount?: number
  messageData?: string
  logProblem?: string
  creationDate?: Date
  creationLevel?: number
  modificationDate?: Date
  modificationLevel?: number
  messageidccsid?: number
  defaultProgramLibrary?: string
  defaultProgram?: string
  replyType?: string
  replyLength?: number
  replyDecimalPositions?: number
  defaultReply?: string
  validReplyValuesCount?: number
  validReplyValues?: string
  validReplyLowerLimit?: string
  validReplyUpperLimit?: string
  validReplyRelationshipOperator?: string
  validReplyRelationshipValue?: string
  specialReplyValuesCount?: number
  spec96ialReplyValues?: string
  dumpListCount?: number
  dumpList?: string
  alertOption?: string
  alertIndex?: number
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
  objectType:string
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