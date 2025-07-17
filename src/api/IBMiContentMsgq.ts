import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import { Code4i } from '../tools';
import { IBMiMessageQueueMessage, MsgOpenOptions, ObjAttributes, ObjLockState } from '../typings';
import { CommandResult } from '@halcyontech/vscode-ibmi-types';
const tmpFile = util.promisify(tmp.file);
const readFileAsync = util.promisify(fs.readFile);
// const writeFileAsync = util.promisify(fs.writeFile);


export type SortOptions = {
  order: "name" | "date" | "?"
  ascending?: boolean
};
export namespace IBMiContentMsgq {
  /**
  * @param {string} messageQueue
  * @param {string} SortOptions
  * @returns {Promise<IBMiMessageQueueMessage[]>}
  */
  export async function getMessageQueueMessageList(queue: string, queueLibrary: string
    , sort: SortOptions = { order: "date", ascending: true }
    , searchWords?: string, messageID?: string, messageType?: string
  ): Promise<IBMiMessageQueueMessage[]> {

    queue = queue.toUpperCase();
    queueLibrary = queueLibrary.toUpperCase() !== '*LIBL' ? queueLibrary.toUpperCase() : ``;
    sort.order = sort.order || { order: 'date', ascending: 'asc' };
    messageID = messageID || '';
    const objQuery3 = `select  MS1.MESSAGE_QUEUE_LIBRARY, MS1.MESSAGE_ID, MS1.MESSAGE_TYPE, MS1.MESSAGE_TEXT
    , MS1.MESSAGE_SUBTYPE, digits( MS1.SEVERITY) SEVERITY
    , MS1.MESSAGE_TIMESTAMP,  MS1.MESSAGE_KEY,  MS1.ASSOCIATED_MESSAGE_KEY
    , MS1.FROM_USER, MS1.FROM_JOB, MS1.FROM_PROGRAM, MS1.MESSAGE_FILE_LIBRARY, MS1.MESSAGE_FILE_NAME
     from QSYS2.MESSAGE_QUEUE_INFO MS1
     ${!queueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
     where MS1.MESSAGE_TYPE not in ('REPLY') and MS1.MESSAGE_QUEUE_NAME = '${queue}'
     ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
     ${searchWords ? ` and (MESSAGE_TEXT like '%${searchWords}%' or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%')` : ''}
     ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
     order by MS1.MESSAGE_TIMESTAMP ${!sort.ascending ? 'desc' : 'asc'}`.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery3);

    if (results.length === 0) {
      return [];
    }
    let searchWords_ = searchWords?.split(' ') || [];

    // return results
    let returnMsgqList = results
      .map(object => ({
        messageType: object.MESSAGE_TYPE,
        messageQueueLibrary: object.MESSAGE_QUEUE_LIBRARY,
        messageQueue: queue,
        messageID: object.MESSAGE_ID,
        messageKey: object.MESSAGE_KEY,
        messageText: object.MESSAGE_TEXT,
        messageSubType: String(object.MESSAGE_SUBTYPE),
        severity: String(object.SEVERITY),
        messageTimestamp: String(object.MESSAGE_TIMESTAMP),
        messageKeyAssociated: String(object.ASSOCIATED_MESSAGE_KEY),
        fromUser: String(object.FROM_USER),
        fromJob: String(object.FROM_JOB),
        fromProgram: String(object.FROM_PROGRAM),
        messageFileLibrary: String(object.MESSAGE_FILE_LIBRARY),
        messageFile: String(object.MESSAGE_FILE_NAME),
      } as IBMiMessageQueueMessage))
      .filter(obj => searchWords_.length === 0 || searchWords_.some(term => Object.values(obj).join(" ").includes(term)))
      ;

    return returnMsgqList;

  }
  /**
  * Download the contents of a message queue message
  * @param {string} uriPath 
  * @param {string} fileExtension 
  * @param {string=} additionalPath 
  */
  export async function downloadMessageContent(uriPath: string, fileExtension: string, options?: MsgOpenOptions) {
    const connection = Code4i.getConnection();
    const tempRmt = connection.getTempRemote(uriPath);
    const tmplclfile = await tmpFile();

    const client = connection.client;
    if (options) {
    }

    let retried = false;
    let retry = 1;
    let fileEncoding: BufferEncoding | null = "utf8";
    // let fileEncoding = `utf8`;
    let cpymsgCompleted: CommandResult = { code: -1, stdout: ``, stderr: `` };
    // let results: string;
    while (retry > 0) {
      retry--;
      try {
        //If this command fails we need to try again after we delete the temp remote
        switch (fileExtension.toLowerCase()) {
        case `pdf`:
          fileEncoding = null;
          // await connection.runCommand({
          //   command: `CPYSPLF FILE(${name}) TOFILE(*TOSTMF) JOB(${qualifiedJobName}) SPLNBR(${splfNumber}) TOSTMF('${tempRmt}') WSCST(*PDF) STMFOPT(*REPLACE)\nDLYJOB DLY(1)`
          //  , environment: `ile`
          // });
          break;
        default:
          // With the use of CPYSPLF and CPY to create a text based stream file in 1208, there are possibilities that the data becomes corrupt
          // in the tempRmt object
          connection.sendCommand({
            command: `rm -f ${tempRmt}`
          });

          // fileExtension = `txt`;
          // DLYJOB to ensure the CPY command completes in time.
          cpymsgCompleted = await connection.runCommand({
            command: ``
            , environment: `ile`
          });
        }
      } catch (e) {
        if (String(e).startsWith(`CPDA08A`)) {
          if (!retried) {
            await connection.sendCommand({ command: `rm -f ${tempRmt}`, directory: `.` });
            retry++;
            retried = true;
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
    }

    await client.getFile(tmplclfile, tempRmt);
    const results = await readFileAsync(tmplclfile, fileEncoding);
    if (cpymsgCompleted.code === 0) {
    }
    return results;
  }
  /**
  * @param {string} messageQueue
  * @param {string} messageQueueLibrary
  * @returns {Promise<String>} a string with the count of messages in message queue
  */
  export async function getMessageQueueCount(messageQueue: string, messageQueueLibrary: string, searchWords?: string, messageID?: string, messageType?: string): Promise<string> {
    messageQueue = messageQueue.toUpperCase();
    messageQueueLibrary = messageQueueLibrary.toUpperCase();

    // let results: Tools.DB2Row[];

    const objQuery = `select count(*) MSGQ_COUNT
    from table (QSYS2.MESSAGE_QUEUE_INFO(QUEUE_LIBRARY => '${messageQueueLibrary}', QUEUE_NAME=>'${messageQueue}') ) MSGQ 
    where 1=1
    ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
    ${searchWords ? ` and (MESSAGE_TEXT like '%${searchWords}%' or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%')` : ''}
    ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
    `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    if (results.length === 0) {
      return ` ${messageQueueLibrary}/${messageQueue} has no messages`;
    }
    return String(results[0].MSGQ_COUNT);
  }
  /**
  * @param {string} messageQueue
  * @param {string} messageQueueLibrary
  * @returns {Promise<String>} an object of message attributes
  */
  export async function getMessageAttributes(messageQueue: string, messageQueueLibrary: string, msgKey: string): Promise<IBMiMessageQueueMessage> {
    messageQueue = messageQueue.toUpperCase();
    messageQueueLibrary = messageQueueLibrary.toUpperCase();

    const objQuery = `select  
      MS1.MESSAGE_QUEUE_LIBRARY, MS1.MESSAGE_TYPE, MS1.MESSAGE_SUBTYPE, digits( MS1.SEVERITY) SEVERITY
    , MS1.MESSAGE_TIMESTAMP,  MS1.MESSAGE_KEY,  MS1.ASSOCIATED_MESSAGE_KEY
    , MS1.FROM_USER, MS1.FROM_JOB, MS1.FROM_PROGRAM, MS1.MESSAGE_FILE_LIBRARY, MS1.MESSAGE_FILE_NAME
    , MSR.MESSAGE_TEXT MESSAGE_REPLY, MSR.FROM_USER REPLY_FROM_USER, MSR.FROM_JOB REPLY_FROM_JOB
     from QSYS2.MESSAGE_QUEUE_INFO MS1
     ${!messageQueueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
     left join QSYS2.MESSAGE_QUEUE_INFO MSR on MSR.MESSAGE_QUEUE_NAME = MS1.MESSAGE_QUEUE_NAME 
                                          and MSR.MESSAGE_QUEUE_LIBRARY = MS1.MESSAGE_QUEUE_LIBRARY 
                                          and MSR.ASSOCIATED_MESSAGE_KEY = MS1.MESSAGE_KEY
     where MS1.MESSAGE_TYPE not in ('REPLY') and MS1.MESSAGE_QUEUE_NAME = '${messageQueue}'
       and MS1.MESSAGE_KEY = binary(${msgKey})
      `.replace(/\n\s*/g, ' ');
    const objQuery2 = `select MSR.MESSAGE_TEXT MESSAGE_REPLY, MSR.FROM_USER REPLY_FROM_USER, MSR.FROM_JOB REPLY_FROM_JOB
      from QSYS2.MESSAGE_QUEUE_INFO MSR
      where MSR.MESSAGE_QUEUE_NAME = '${messageQueue}' 
        and MSR.MESSAGE_QUEUE_LIBRARY = '${messageQueueLibrary}'
        and MSR.ASSOCIATED_MESSAGE_KEY = binary(${msgKey})
      `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery2);
    let returnMessageAttributes: IBMiMessageQueueMessage;
    if (results.length === 0) {
      return returnMessageAttributes = { messageText: ` ${messageQueueLibrary}/${messageQueue} has no messages` };
    }
    else {
      returnMessageAttributes = {
        messageQueueLibrary: String(results[0].MESSAGE_QUEUE_LIBRARY),
        messageQueue: messageQueue,
        messageType: String(results[0].MESSAGE_TYPE),
        messageSubType: String(results[0].MESSAGE_SUBTYPE),
        severity: String(results[0].SEVERITY),
        messageTimestamp: String(results[0].MESSAGE_TIMESTAMP),
        messageKey: String(results[0].MESSAGE_KEY),
        messageKeyAssociated: String(results[0].ASSOCIATED_MESSAGE_KEY),
        messageText: String(results[0].MESSAGE_TEXT),
        fromUser: String(results[0].FROM_USER),
        fromJob: String(results[0].FROM_JOB),
        fromProgram: String(results[0].FROM_PROGRAM),
        messageFileLibrary: String(results[0].MESSAGE_FILE_LIBRARY),
        messageFile: String(results[0].MESSAGE_FILE_NAME),
        messageReply: String(results[0].MESSAGE_REPLY),
        messageReplyUser: String(results[0].REPLY_FROM_USER),
        messageReplyJob: String(results[0].REPLY_FROM_JOB),
      }
        ;
    }
    return returnMessageAttributes;
  }

  export async function getObjectText(objects: string[], librarys: string[], types: string[]): Promise<ObjAttributes[]> {
    const OBJS = objects.map(object => `'${object}'`).join(', ');
    const OBJLIBS = (librarys.length === 0 || librarys.length === 1 && librarys[0] === '*LIBL')
      ? ''
      : librarys.map(library => `'${library}'`).join(', ');
    const library = (librarys.length === 1 && librarys[0] === '*LIBL')
      ? '*LIBL'
      : '*ALL';
    const TYPES = types?.map(type => `${type}`).join(', ') || '';
    // object = object.toUpperCase();
    // library = library.toUpperCase();
    // type = type.toUpperCase();

    // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
    const objQuery = `/*GETOBJECTTEXT*/ select OBJLONGSCHEMA SCHEMA_NAME, OBJNAME OBJECT_NAME, OBJTEXT OBJECT_TEXT
    from table ( QSYS2.OBJECT_STATISTICS(OBJECT_SCHEMA => '${library}', OBJTYPELIST => '${TYPES}', OBJECT_NAME => '*ALL') ) OB 
    where 1=1
    ${OBJLIBS ? `OBJLONGSCHEMA in (${OBJLIBS})` : ''}
    ${OBJS ? `and OBJNAME in (${OBJS})` : ``}
    limit 1
    `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    let objAttributes: ObjAttributes[] = [];
    if (results.length >= 0) {
      objAttributes = results.map((result) =>
      ({
        library: result.SCHEMA_NAME,
        name: result.OBJECT_NAME,
        text: result.OBJECT_TEXT
      } as ObjAttributes)
      );
    } else {
      objAttributes = [{
        library: '',
        name: '',
        text: `I dont know where to find the text for ${librarys.values}/${objects.values}`
      } as ObjAttributes];
    }
    // const objAttributes = (results.length === 0)
    //   ? ` I dont know where to find the text for ${librarys.values}/${objects.values}`
    //   : String(results[0].OBJECT_TEXT);
    return objAttributes;
  }
  // export function getObjectText(object: string, library: string, type: string): Promise<string | undefined> {
  // return getObjectText(object, library, type);
  // }

  // export function getObjectLocks(object: string, library: string, type: string): Promise<string | undefined> {
  //   return getObjectLocks(object, library, type);
  // }
  export async function getObjectLocks(objects: string[], librarys: string[], types: string[]): Promise<ObjLockState[]> {
    const OBJS = objects.map(object => `'${object}'`).join(', ');
    const OBJLIBS = (librarys.length === 0 || librarys.length === 1 && librarys[0] === '*LIBL')
      ? 'select SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO where SCHEMA_NAME = OB.OBJECT_SCHEMA'
      : librarys.map(library => `'${library}'`).join(', ');
    const TYPES = types?.map(type => `'${type}'`).join(', ') || '';
    // object = object.toUpperCase();
    // library = library.toUpperCase();
    // type = type.toUpperCase();

    // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
    const objQuery = `/*GETOBJECTLOCKS*/ select OBJECT_SCHEMA SCHEMA_NAME, OBJECT_NAME, LOCK_STATE, LOCK_STATUS, LOCK_SCOPE, JOB_NAME
    from QSYS2.OBJECT_LOCK_INFO OB 
    where 1=1
    ${OBJLIBS ? ` and OBJECT_SCHEMA in (${OBJLIBS})` : ''}
    ${OBJS ? `and OBJECT_NAME in (${OBJS})` : ``}
    ${TYPES ? `and OBJECT_TYPE in (${TYPES})` : ``}
    limit 1`.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    let objLockState: ObjLockState[] = [];
    if (results.length >= 0) {
      objLockState = results.map((result) =>
      ({
        library: result.SCHEMA_NAME,
        name: result.OBJECT_NAME,
        lockState: result.LOCK_STATE,
        lockStatus: result.LOCK_STATUS,
        lockScope: result.LOCK_SCOPE,
        jobName: result.JOB_NAME
      } as ObjLockState)
      );
    } else {
      objLockState = [{
        library: '',
        name: '',
        jobName: `I dont know where to find the text for ${librarys.values}/${objects.values}`
      } as ObjLockState];
    }
    // const objLockState = (results.length === 0)
    //   ? ` I dont know where to find the lock information for ${librarys.values}/${objects.values}`
    //   : String(results[0].LOCK_STATE);
    return objLockState;
  }
}