import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import { Code4i } from '../tools';
import { ErrorDS, IBMiMessageQueueMessage, MsgOpenOptions, ObjAttributes, ObjLockState } from '../typings';
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
    , MS1.MESSAGE_SUBTYPE, digits(MS1.SEVERITY) SEVERITY
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
  export async function getMessageReplies(queues: string[], libraries: string[], msgKey?: string): Promise<IBMiMessageQueueMessage[]> {
    const OBJS = queues.map(queue => `'${queue}'`).join(', ');
    const OBJLIBS = (libraries.length === 0 || libraries.length === 1 && libraries[0] === '*LIBL')
      ? 'select LL.SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO LL where LL.SCHEMA_NAME = B.OBJLONGSCHEMA'
      : libraries.map(library => `'${library}'`).join(', ');
    const objQuery2 = `select MSR.MESSAGE_QUEUE_LIBRARY, MSR.MESSAGE_QUEUE_NAME
      , MSR.MESSAGE_TEXT MESSAGE_REPLY, MSR.FROM_USER REPLY_FROM_USER, MSR.FROM_JOB REPLY_FROM_JOB
      , MSR.MESSAGE_KEY, MSR.ASSOCIATED_MESSAGE_KEY
      from QSYS2.MESSAGE_QUEUE_INFO MSR
      where MESSAGE_TYPE = 'REPLY'
      ${OBJS ? ` and MSR.MESSAGE_QUEUE_NAME in (${OBJS})` : ''}
      ${OBJLIBS ? ` and MSR.MESSAGE_QUEUE_LIBRARY in (${OBJLIBS})` : ''}
      ${msgKey ? ` and MSR.ASSOCIATED_MESSAGE_KEY = binary(${msgKey})` : ''}
      `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery2);
    let returnMessageReplies: IBMiMessageQueueMessage[] = [];
    let err: ErrorDS[] = [];
    if (results.length > 0) {
      returnMessageReplies = results.map((result) =>
      ({
        messageQueueLibrary: String(result.MESSAGE_QUEUE_LIBRARY),
        messageQueue: String(result.MESSAGE_QUEUE),
        messageReply: String(result.MESSAGE_REPLY),
        messageReplyJob: String(result.REPLY_FROM_JOB),
        messageReplyUser: String(result.REPLY_FROM_USER),
        messageKey: String(result.MESSAGE_KEY), // Reply message key
        messageKeyAssociated: String(result.ASSOCIATED_MESSAGE_KEY) // answered INQUIRY message key
      } as IBMiMessageQueueMessage)
      );
    }
    return returnMessageReplies;
  }

  export async function getObjectText(objects: string[], libraries: string[], types: string[]): Promise<ObjAttributes[]> {
    const OBJS = objects.map(object => `'${object}'`).join(', ');
    const OBJLIBS = (libraries.length === 0 || libraries.length === 1 && libraries[0] === '*LIBL')
      ? ''
      : libraries.map(library => `'${library}'`).join(', ');
    const library = (libraries.length === 1 && libraries[0] === '*LIBL')
      ? '*LIBL'
      : '*ALL';
    const TYPES = types?.map(type => `${type}`).join(', ') || '';

    // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
    const objQuery = `/*GETOBJECTTEXT*/ select OBJLONGSCHEMA SCHEMA_NAME, OBJNAME OBJECT_NAME, OBJTEXT OBJECT_TEXT
    from table ( QSYS2.OBJECT_STATISTICS(OBJECT_SCHEMA => '${library}', OBJTYPELIST => '${TYPES}', OBJECT_NAME => '*ALL') ) OB 
    where 1=1
    ${OBJLIBS ? `OBJLONGSCHEMA in (${OBJLIBS})` : ''}
    ${OBJS ? `and OBJNAME in (${OBJS})` : ``}
    `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    let objAttributes: ObjAttributes[] = [];
    if (results.length > 0) {
      objAttributes = results.map((result) =>
      ({
        library: result.SCHEMA_NAME,
        name: result.OBJECT_NAME,
        text: result.OBJECT_TEXT
      } as ObjAttributes)
      );
    }
    return objAttributes;
  }
  export async function getObjectLocks(objects: string[], libraries: string[], types: string[]): Promise<ObjLockState[]> {
    const OBJS = objects.map(object => `'${object}'`).join(', ');
    const OBJLIBS = (libraries.length === 0 || libraries.length === 1 && libraries[0] === '*LIBL')
      ? 'select LL.SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO LL where LL.SCHEMA_NAME = B.OBJLONGSCHEMA'
      : libraries.map(library => `'${library}'`).join(', ');
    const TYPESA = types?.map(type => `'${type}'`).join(', ') || '';// comma list for IN() clause
    const TYPESB = types?.map(type => `${type}`).join(', ') || '';// comma list without quote of each item

    // Note: this line does not work for most *USRPRFs because as a regular programmer I dont have access to see the profile
    const objQuery = `/*GETOBJECTLOCKS*/with T1 as (select B.OBJLONGSCHEMA SCHEMA_NAME, B.OBJNAME OBJECT_NAME, B.OBJTYPE OBJECT_TYPE
      , LOCK_STATE, LOCK_STATUS, LOCK_SCOPE, JOB_NAME
      , row_number() over( partition by b.OBJNAME) QUEUE_NUMBER
      from table(QSYS2.OBJECT_STATISTICS('*ALL', '${TYPESB}', '*ALL')) B
      left join  QSYS2.OBJECT_LOCK_INFO OL on OL.OBJECT_NAME=B.OBJNAME and OL.OBJECT_SCHEMA=B.OBJLONGSCHEMA ${TYPESA ? `and OL.OBJECT_TYPE in (${TYPESA})` : ``} 
      where 1=1
      ${OBJLIBS ? ` and B.OBJLONGSCHEMA in (${OBJLIBS})` : ''}
      ${OBJS ? `and B.OBJNAME in (${OBJS})` : ``}
      ${TYPESA ? `and B.OBJTYPE in (${TYPESA})` : ``}
      ) select SCHEMA_NAME ,OBJECT_NAME ,LOCK_STATE ,LOCK_STATUS ,LOCK_SCOPE ,JOB_NAME 
      from T1 where QUEUE_NUMBER = 1`.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    let objLockState: ObjLockState[] = [];
    if (results.length > 0) {
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
    }
    return objLockState;
  }
  export async function answerMessage(item: IBMiMessageQueueMessage, userReply?: string): Promise<boolean> {
    userReply = userReply || '*DFT';
    //TODO: look for AS400 command
    // TODO: else look for the SQL function.
    const commandResult = await Code4i.runCommand({
      command: `SNDRPY MSGKEY(${item.messageKey}) MSGQ(${item.messageQueueLibrary}/${item.messageQueue}) RPY(${userReply}) RMV(*NO)          `
      , environment: `ile`
    });
    if (commandResult) {
      // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
      if (commandResult.code === 0 || commandResult.code === null) {
      } else {
      }
    }

    return true;
  }
}