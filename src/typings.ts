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
export interface IBMiUserJobsFilter {
  user: string
}   
export interface IBMiUserJobsUsers extends IBMiUserJobsFilter {
  text?: string,
}
export interface IBMiUserJob {
  jobName?: string,
  jobNameShort?: string,
  jobUser?: string,
  jobNumber?: string,
  jobStatus?: string,
  jobType?: string,
  jobQueueLibrary?: string,
  jobQueueName?: string,
  jobCCSID?: string,
  activeJobSubsystem?: string,
  activeJobStatus?: string,
  jobMessageKey?: string,
  jobMessageQueueLibrary?: string,
  jobMessageQueueName?: string,
  jobEnteredSystemTime?: string,
  jobQueueStatus?: string,
}
export interface DspJobOpenOptions {
  readonly?: boolean;
}
export interface IBMiUserJobDetails {
jobName?: string,
jobNameShort?: string,
jobUser?: string,
jobNumber?: string,
jobStatus?: string,
jobType?: string,
jobTypeEnhanced?: string,
jobSubsystem?: string,
jobDate?: string,
jobDescriptionLibrary?: string,
jobDescription?: string,
jobAccountingCode?: string,
submitterJobName?: string,
submitterMessageQueueLibrary?: string,
submitterMessageQueue?: string,
serverType?: string,
jobEnteredSystemTime?: string,
jobScheduledTime?: string,
jobActiveTime?: string,
jobEndTime?: string,
jobEndSeverity?: number,
completionStatus?: string,
jobEndReason?: string,
jobQueueLibrary?: string,
jobQueueName?: string,
jobQueueStatus?: string,
jobQueuePriority?: number,
jobQueueTime?: string,
jobMessageQueueMaximumSize?: number,
jobMessageQueueFullAction?: string,
allowMultipleThreads?: string,
peakTemporaryStorage?: number,
defaultWait?: number,
maximumProcessingTimeAllowed?: number,
maximumTemporaryStorageAllowed?: number,
timeSlice?: number,
jobSwitches?: string,
routingData?: string,
characterIdentifierControl?: string,
sortSequenceLibrary?: string,
sortSequenceName?: string,
languageId?: string,
countryId?: string,
dateFormat?: string,
dateSeparator?: string,
timeSeparator?: string,
decimalFormat?: string,
timeZoneDescriptionName?: string,
messageLoggingLevel?: number,
messageLoggingSeverity?: number,
messageLoggingText?: string,
logClProgramCommands?: string,
statusMessage?: string,
inquiryMessageReply?: string,
breakMessage?: string,
jobLogOutput?: string,
jobLogPending?: string,
outputQueuePriority?: number,
outputQueueLibrary?: string,
outputQueueName?: string,
spooledFileAction?: string,
printerDeviceName?: string,
printKeyFormat?: string,
printText?: string,
deviceName?: string,
deviceRecoveryAction?: string,
ddmConversation?: string,
modeName?: string,
unitOfWorkId?: string,
internaljobId?: string,
vjobStatus?: string,
vActivejobStatus?: string,
vActivejobType?: string,
vRunPriority?: number,
vAuthorizationName?: string,
vSbsName?: string,
vCpuUsed?: number,
vTempStorageUsedMb?: number,
vAuxIoRequested?: number,
vPageFaults?: number,
vClientWrkstnname?: string,
vClientApplname?: string,
vClientAcctng?: string,
vClientProgramid?: string,
vClientUserid?: string,
vSqlStatementText?: string,
vSqlStmtStatus?: string,
vSqlStmtStartTimestamp?: string,
vQueryOptionsLibName?: string,
vClientIpAddress?: string,
vPjReuseCount?: number,
vPjMaxuseCount?: number
}   