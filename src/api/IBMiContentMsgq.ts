import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import { Code4i, makeid } from '../tools';
import { IBMiMessageQueueViewItem, IBMiMessageQueueMessage, MsgOpenOptions } from '../typings';
import { CommandResult } from '@halcyontech/vscode-ibmi-types';
const tmpFile = util.promisify(tmp.file);
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);


export type SortOptions = {
  order: "name" | "date" | "?"
  ascending?: boolean
};
export namespace IBMiContentMsgq {
  /**
  * @param {string} messageQueue
  * @param {string} SortOptions
  * @returns {Promise<IBMiMessageQueueViewItem[]>}
  */
  export async function getMessageQueueMessageList(queue: string, queueLibrary: string
                                                , sort: SortOptions = { order: "date" ,ascending :true }
                                                , searchWords?: string, messageID?: string) : Promise<IBMiMessageQueueViewItem[]> {

    queue = queue.toUpperCase();
    queueLibrary = queueLibrary.toUpperCase();
    sort.order = sort.order || { order: 'date' ,ascending:'asc'};
    messageID = messageID || '';

    const objQuery = [`select MESSAGE_ID, MESSAGE_KEY, MESSAGE_TEXT`
    , ` from table ( QSYS2.MESSAGE_QUEUE_INFO(`
    , ` QUEUE_NAME => '${queue}'`
    , `, QUEUE_LIBRARY => '${queueLibrary}')`
    , `) where 1=1`
    , ` ${messageID ? ` and MESSAGE_ID = '${messageID}'`:''}`
    , ` ${searchWords ?` and (MESSAGE_TEXT like '%${searchWords}%' or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%')`:''}`
    , ` order by MESSAGE_TIMESTAMP ${!sort.ascending ? 'desc' : 'asc'}`].join(``);
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return [];
    }
    let searchWords_ = searchWords?.split(' ') || [];

    // return results
    let returnMsgqList = results
      .map(object => ({
        messageQueueLibrary: queueLibrary,
        messageQueue: queue,
        messageID: object.MESSAGE_ID,
        messageKey: object.MESSAGE_KEY,
        messageText: object.MESSAGE_TEXT,
         } as IBMiMessageQueueViewItem))
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
    let fileEncoding :BufferEncoding | null= "utf8";
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
  export async function getMessageQueueCount(messageQueue: string, messageQueueLibrary: string, searchWords?: string, messageID?: string): Promise<string> {
    messageQueue = messageQueue.toUpperCase();
    messageQueueLibrary = messageQueueLibrary.toUpperCase();

    // let results: Tools.DB2Row[];

    const objQuery = `select count(*) MSGQ_COUNT
    from table (QSYS2.MESSAGE_QUEUE_INFO(QUEUE_LIBRARY => '${messageQueueLibrary}', QUEUE_NAME=>'${messageQueue}') ) MSGQ 
    where 1=1
    ${messageID ? ` and MESSAGE_ID = '${messageID}'`:''}
    ${searchWords ?` and (MESSAGE_TEXT like '%${searchWords}%' or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%')`:''}`;
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

    // let results: Tools.DB2Row[];

    const objQuery = `select MESSAGE_TYPE, MESSAGE_SUBTYPE, digits(SEVERITY) SEVERITY, MESSAGE_TIMESTAMP, MESSAGE_KEY, ASSOCIATED_MESSAGE_KEY
    , FROM_USER, FROM_JOB, FROM_PROGRAM, MESSAGE_FILE_LIBRARY, MESSAGE_FILE_NAME
    from table (QSYS2.MESSAGE_QUEUE_INFO(QUEUE_LIBRARY => '${messageQueueLibrary}', QUEUE_NAME=>'${messageQueue}') ) MSGQ 
    where MESSAGE_KEY = binary(${msgKey})` ;
    let results = await Code4i!.runSQL(objQuery);
    let returnMessageAttributes :IBMiMessageQueueMessage;
    if (results.length === 0) {
      return returnMessageAttributes = {messageText: ` ${messageQueueLibrary}/${messageQueue} has no messages`};
    }
    else {
      returnMessageAttributes = {
        messageQueueLibrary: messageQueueLibrary,
        messageQueue: messageQueue,
        messageType: String(results[0].MESSAGE_TYPE),
        messageSubType: String(results[0].MESSAGE_SUBTYPE),
        severity: String(results[0].SEVERITY),
        messageTimestamp: String(results[0].MESSAGE_TIMESTAMP),
        messageKey: String(results[0].MESSAGE_KEY),
        messageKeyAssociated: String(results[0].ASSOCIATED_MESSAGE_KEY),
        fromUser: String(results[0].FROM_USER),
        fromJob: String(results[0].FROM_JOB),
        fromProgram: String(results[0].FROM_PROGRAM),
        messageFileLibrary: String(results[0].MESSAGE_FILE_LIBRARY),
        messageFile: String(results[0].MESSAGE_FILE_NAME),
      }
      ;
    }
    return returnMessageAttributes;
  }
  export function getObjectText(object: string, library: string, type: string): Promise<string | undefined>
  {
    return Code4i.getObjectText(object, library, type);
  }

}