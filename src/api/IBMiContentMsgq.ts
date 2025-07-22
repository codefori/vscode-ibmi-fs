import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import vscode, { l10n, } from 'vscode';
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
    const objQuery = `select  MS1.MESSAGE_QUEUE_LIBRARY, MS1.MESSAGE_ID, MS1.MESSAGE_TYPE, MS1.MESSAGE_TEXT
    , MS1.MESSAGE_SUBTYPE, digits(MS1.SEVERITY) SEVERITY
    , MS1.MESSAGE_TIMESTAMP
    , hex(MS1.MESSAGE_KEY) MESSAGE_KEY
    , hex(MS1.ASSOCIATED_MESSAGE_KEY) ASSOCIATED_MESSAGE_KEY
    , MS1.FROM_USER, MS1.FROM_JOB, MS1.FROM_PROGRAM, MS1.MESSAGE_FILE_LIBRARY, MS1.MESSAGE_FILE_NAME
     from QSYS2.MESSAGE_QUEUE_INFO MS1
     ${!queueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
     where MS1.MESSAGE_TYPE not in ('REPLY') and MS1.MESSAGE_QUEUE_NAME = '${queue}'
     ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
     ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
     ${searchWords ? ` /*and (1=1 or MESSAGE_TEXT like '%${searchWords}%' 
                        or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%'
                        or MESSAGE_ID = '${searchWords}'
                        or MESSAGE_TYPE like '%${searchWords}%'
                        )*/` : ''}
     order by MS1.MESSAGE_TIMESTAMP ${!sort.ascending ? 'desc' : 'asc'}`.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);


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
  export async function getMessageQueueMessageFullDetails(queue: string, queueLibrary?: string, messageKey?: string): Promise<IBMiMessageQueueMessage> {

    queue = queue.toUpperCase();
    queueLibrary = queueLibrary && queueLibrary.toUpperCase() !== '*LIBL' ? queueLibrary.toUpperCase() : ``;
    messageKey = messageKey || '';
    const objQuery = `select MS1.MESSAGE_QUEUE_LIBRARY ,MS1.MESSAGE_QUEUE_NAME
      ,MS1.MESSAGE_ID ,MS1.MESSAGE_TYPE ,MS1.MESSAGE_SUBTYPE ,MS1.MESSAGE_TEXT ,MS1.SEVERITY ,MS1.MESSAGE_TIMESTAMP
      ,hex(MS1.MESSAGE_KEY) MESSAGE_KEY ,hex(MS1.ASSOCIATED_MESSAGE_KEY) ASSOCIATED_MESSAGE_KEY
      ,MS1.FROM_USER ,MS1.FROM_JOB ,MS1.FROM_PROGRAM
      ,MS1.MESSAGE_FILE_LIBRARY ,MS1.MESSAGE_FILE_NAME ,MS1.MESSAGE_TOKENS
      ,MS1.MESSAGE_SECOND_LEVEL_TEXT
      ,MSR.MESSAGE_TEXT REPLY_MESSAGE
      ,MSR.FROM_USER REPLY_FROM_USER ,MSR.FROM_JOB REPLY_FROM_JOB ,MSR.FROM_PROGRAM REPLY_FROM_PROGRAM
      ,MSR.MESSAGE_KEY REPLY_MESSAGE_KEY ,MSR.ASSOCIATED_MESSAGE_KEY REPLIED_MESSAGE_KEY
      ,MSR.MESSAGE_TIMESTAMP REPLY_TIMESTAMP
      from QSYS2.MESSAGE_QUEUE_INFO MS1
      left join QSYS2.MESSAGE_QUEUE_INFO MSR on MSR.MESSAGE_QUEUE_LIBRARY = MS1.MESSAGE_QUEUE_LIBRARY 
                                            and MSR.MESSAGE_QUEUE_NAME = MS1.MESSAGE_QUEUE_NAME 
                                            and MSR.ASSOCIATED_MESSAGE_KEY = MS1.MESSAGE_KEY
      ${!queueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
      where MS1.MESSAGE_TYPE not in ('REPLY') and MS1.MESSAGE_QUEUE_NAME = '${queue}'
      ${messageKey ? ` and MS1.MESSAGE_KEY = binary(x'${messageKey}')` : ''}
      `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return { messageText: `no results` };
    }
    // return results
    let returnMsgqList = results
      .map(result => ({
        messageQueueLibrary: result.MESSAGE_QUEUE_LIBRARY,
        messageQueue: queue,
        messageID: result.MESSAGE_ID,
        messageType: result.MESSAGE_TYPE,
        messageKey: result.MESSAGE_KEY,
        messageSubType: String(result.MESSAGE_SUBTYPE),
        severity: String(result.SEVERITY),
        messageTimestamp: String(result.MESSAGE_TIMESTAMP),
        fromUser: String(result.FROM_USER),
        fromJob: String(result.FROM_JOB),
        fromProgram: String(result.FROM_PROGRAM),
        messageFile: String(result.MESSAGE_FILE),
        messageFileLibrary: String(result.MESSAGE_FILE_LIBRARY),
        messageText: result.MESSAGE_TEXT,
        messageTextSecondLevel: String(result.MESSAGE_SECOND_LEVEL_TEXT),
        messageReply: String(result.REPLY_MESSAGE !== null ?result.REPLY_MESSAGE:''),
        messageReplyJob: String(result.REPLY_MESSAGE !== null ?result.REPLY_FROM_JOB:''),
        messageReplyUser: String(result.REPLY_MESSAGE !== null ?result.REPLY_FROM_USER:''),
        messageReplyProgram: String(result.REPLY_MESSAGE !== null ?result.REPLY_FROM_PROGRAM:''),
        messageKeyAssociated: String(result.REPLY_MESSAGE !== null ?result.ASSOCIATED_MESSAGE_KEY:''), // answered INQUIRY message key
        messageReplyTimestamp: String(result.REPLY_MESSAGE !== null ?result.REPLY_TIMESTAMP:'')
      } as IBMiMessageQueueMessage))
      ;

    return returnMsgqList[0];

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

    let mdContent = ``;
    let retried = false;
    let retry = 1;
    // let fileEncoding: BufferEncoding | null = "utf8";
    // let fileEncoding = `utf8`;
    // let cpymsgCompleted: CommandResult = { code: -1, stdout: ``, stderr: `` };
    // let results: string;
    while (retry > 0) {
      retry--;
      try {
        //If this command fails we need to try again after we delete the temp remote
        switch (fileExtension.toLowerCase()) {
        default:
          const thePathParts: string[] = uriPath.split(/[/~.]/);
          // console.log(thePathParts);
          const md = await getMessageQueueMessageFullDetails(thePathParts[1], thePathParts[0], thePathParts[3]);
          const mdFromJobParts = md.fromJob!.split('/');
          // console.log(...formatMessageSecondText(md.messageTextSecondLevel||''));
          if (md) {
            const fmtMsgArray = formatMessageSecondText(md.messageTextSecondLevel||'');
            mdContent = [
              `                Message Information`,
              ` Message ID . . . . . . :   ${md.messageID}         Severity . . . . . . . :   ${md.severity}`,
              ` Date sent  . . . . . . :   ${md.messageTimestamp?.substring(0, 10)}      Time sent  . . . . . . :   ${md.messageTimestamp?.substring(11, 19)}`,
              ` Message type . . . . . :   ${md.messageType}`,
              ``,
              ` From . . . . . . . . . :   ${md.fromUser}`,
              ``,
              ` From job . . . . . . . . . . . :   ${mdFromJobParts[2]}`,
              `   User . . . . . . . . . . . . :     ${mdFromJobParts[1]}`,
              `   Number . . . . . . . . . . . :     ${mdFromJobParts[0]}`,
              ``,
              ` From program . . . . . . . . . :   ${md.fromProgram}`,
              ``,
              ` To message queue . . . . . . . :   ${md.messageQueue}`,
              `   Library  . . . . . . . . . . :     ${md.messageQueueLibrary}`,
              ``,
              ` Time sent  . . . . . . . . . . :   ${md.messageTimestamp?.substring(11)}`,
              ``,
              ` Message . . . . :   ${md.messageText}`,
              // ...md.messageTextSecondLevel ? formatMessageSecondText(md.messageTextSecondLevel) :'',
              ...fmtMsgArray,
              ``,
              `${md.messageReply ? ` Reply  . . . . :   ${md.messageReply}` : ''}`,
              `${md.messageReplyUser ? ` Reply User . . :   ${md.messageReplyUser}` : ''}`,
              `${md.messageReplyJob ? ` Reply Job  . . :   ${md.messageReplyJob}` : ''}`,
              `${md.messageReplyProgram ? ` Reply Program  :   ${md.messageReplyProgram}` : ''}`,
              `${md.messageReplyTimestamp ? ` Reply Timestamp:   ${md.messageReplyTimestamp}` : ''}`,
              ``,
              `              * * * * *   E N D   O F   D E T A I L S   * * * * *`
            ].join("\n");
          } else { }
        // vscode.workspace.openTextDocument({ content: mdContent, language: `plaintext` }).then(doc => vscode.window.showTextDocument(doc));
        }
      } catch (e) {
      }
    }

    // await client.getFile(tmplclfile, tempRmt);
    // const results = await readFileAsync(tmplclfile, fileEncoding);
    // if (cpymsgCompleted.code === 0) {
    // }
    return mdContent;
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
    ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
    ${searchWords ? ` and (MESSAGE_TEXT like '%${searchWords}%' 
                        or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%'
                        or MESSAGE_ID like '%${searchWords}%'
                        or MESSAGE_ID like '%${searchWords}%'
                        )` : ''}
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
      , MSR.FROM_PROGRAM REPLY_FROM_PROGRAM
      , hex(MSR.MESSAGE_KEY) MESSAGE_KEY, hex(MSR.ASSOCIATED_MESSAGE_KEY) ASSOCIATED_MESSAGE_KEY
      from QSYS2.MESSAGE_QUEUE_INFO MSR
      where MESSAGE_TYPE = 'REPLY'
      ${OBJS ? ` and MSR.MESSAGE_QUEUE_NAME in (${OBJS})` : ''}
      ${OBJLIBS ? ` and MSR.MESSAGE_QUEUE_LIBRARY in (${OBJLIBS})` : ''}
      ${msgKey ? ` and MSR.ASSOCIATED_MESSAGE_KEY = binary(x'${msgKey}')` : ''}
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
        messageReplyProgram: String(result.REPLY_FROM_PROGRAM),
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
function formatMessageSecondText(text: string): string[] {
  const formattedText: string[] = [];
  const lineLength = 80;
  // Regex to match the special characters, capturing them
  const parts = text.split(/(&N |&P |&B )/); //
  let firstLineBreak: boolean = true;
  let formatIndents = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === '&N ') {
      formatIndents = ` `;
      if (firstLineBreak) { firstLineBreak = false; continue; }
    } else if (part === '&P ') {
      formatIndents = `      `;
      if (firstLineBreak) { firstLineBreak = false; continue; }
    } else if (part === '&B ') {
      formatIndents = `    `;
      if (firstLineBreak) { firstLineBreak = false; continue; }
    } else {
      const brokenStringArray = splitStringOnWords(part, lineLength, formatIndents);
      formattedText.push(...brokenStringArray);

      // const partLength = part.length;
      // if (partLength > lineLength) {
      //   let miniPartsLen: number = Math.ceil(partLength / lineLength);
      //   let totalLen = 0;
      //   for (let ii = 0; ii < miniPartsLen; ii++) {
      //     if (totalLen+(ii*lineLength) < partLength) {
      //       totalLen =+ ii*lineLength;
      //       formattedText.push(part.substring(ii*lineLength,lineLength));
      //       // new line for next segment
      //       if (lineIndicator === '&N ') { formattedText.push('\n'); }
      //       if (lineIndicator === '&P ') { formattedText.push('\n      '); }
      //       if (lineIndicator === '&B ') { formattedText.push('\n    '); }
      //     } else {
      //       formattedText.push(part.substring(ii));
      //     }
      //   }
      // } else {
      //   formattedText.push(part);
      // }
    }
  }

  return formattedText;
}
function splitStringOnWords(text: string, maxLength: number, formatIndents: string): string[] {
  const words = text.split(' '); // Split the string into an array of words
  const result: string[] = [];
  let currentLine = '';
  let lineIndents = '';
  let lineCount = 0;

  for (const word of words) {
    // Check if adding the next word exceeds the maxLength
    if (currentLine.length + word.length + (currentLine.length > 0 ? 1 : 0) > maxLength) {
      // If currentLine is not empty, push it to result and start a new line
      if (currentLine.length > 0) {
        if (lineCount > 0) {lineIndents='  ';lineCount++;}
        // When formatting message text, we need to split long lines and indent by proper spaces.
        result.push(formatIndents+lineIndents+currentLine.trim()); // Trim to remove any leading/trailing spaces
      }
      currentLine = word; // Start the new line with the current word
    } else {
      // Add the word to the current line
      if (currentLine.length > 0) {
        currentLine += ' '; // Add a space if it's not the first word on the line
      }
      currentLine += word;
    }
  }
  // Add the last remaining line if it's not empty
  if (currentLine.length > 0) {
    result.push(formatIndents+lineIndents+currentLine.trim());
  }

  return result;
}
