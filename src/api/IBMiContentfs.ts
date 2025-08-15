import vscode from "vscode";
import { Code4i } from '../tools';
import { IBMiMessageQueue, IBMiMessageQueueMessage, MsgOpenOptions, ObjAttributes, ObjLockState } from '../typings';


export namespace IBMiContentMsgq {
  /**
  * @param {string} messageQueue
  * @param {string} SortOptions
  * @returns {Promise<IBMiMessageQueueMessage[]>}
  */
  export async function getMessageQueueMessageList(caller: string, treeFilter: IBMiMessageQueue , searchWords?: string, messageID?: string, messageType?: string
  ): Promise<IBMiMessageQueueMessage[]> {

    treeFilter.messageQueue = treeFilter.messageQueue.toLocaleUpperCase();
    treeFilter.messageQueueLibrary = treeFilter.messageQueueLibrary !== '*LIBL' ? treeFilter.messageQueueLibrary.toLocaleUpperCase() : ``;
    messageID = messageID?.toLocaleUpperCase() || '';
    const searchWordsU = searchWords?.toLocaleUpperCase() || '';

    const objQuery = `/*${caller}*/ select MS1.MESSAGE_QUEUE_LIBRARY, MS1.MESSAGE_QUEUE_NAME, MS1.MESSAGE_ID, MS1.MESSAGE_TYPE, MS1.MESSAGE_TEXT
    , MS1.MESSAGE_SUBTYPE, digits(MS1.SEVERITY) SEVERITY
    , MS1.MESSAGE_TIMESTAMP
    , hex(MS1.MESSAGE_KEY) MESSAGE_KEY
    , hex(MS1.ASSOCIATED_MESSAGE_KEY) ASSOCIATED_MESSAGE_KEY
    , MS1.FROM_USER, MS1.FROM_JOB, MS1.FROM_PROGRAM, MS1.MESSAGE_FILE_LIBRARY, MS1.MESSAGE_FILE_NAME
      from QSYS2.MESSAGE_QUEUE_INFO MS1
      ${!treeFilter.messageQueueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
      where MS1.MESSAGE_TYPE not in ('REPLY') 
      ${treeFilter.type === '*MSGQ' ?`and MS1.MESSAGE_QUEUE_NAME = '${treeFilter.messageQueue}'`:''}
      ${treeFilter.type === '*USRPRF' ?`and MS1.FROM_USER = '${treeFilter.messageQueue}'`:''}
      ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
      ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
      ${searchWordsU ? ` and (ucase(MESSAGE_TEXT) like '%${searchWordsU}%' 
                          or ucase(MESSAGE_SECOND_LEVEL_TEXT) like '%${searchWordsU}%'
                          or ucase(MESSAGE_ID) = '${searchWordsU}'
                          or ucase(MESSAGE_TYPE) like '%${searchWordsU}%'
                        )` : ''}
                        `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return [];
    }
    let searchWords_ = searchWords?.toLocaleLowerCase().split(' ') || [];

    // return results
    let returnMsgqList = results
      .map(object => ({
        messageType: object.MESSAGE_TYPE,
        messageQueueLibrary: object.MESSAGE_QUEUE_LIBRARY,
        messageQueue: object.MESSAGE_QUEUE_NAME,
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
      .filter(obj => searchWords_.length === 0 || searchWords_.some(term => Object.values(obj).join(" ").toLocaleLowerCase().includes(term)))
      ;

    return returnMsgqList;

  }
  /**
  * @param {string} queue - Message Queue
  * @param {string} queueLibrary - Message Queue Library
  * @param {string} messageKey - optional
  * @returns {Promise<IBMiMessageQueueMessage[]>}
  */
  export async function getMessageQueueMessageFullDetails(treeFilter: IBMiMessageQueueMessage, type: string): Promise<IBMiMessageQueueMessage> {

    treeFilter.messageQueue = treeFilter.messageQueue?.toLocaleUpperCase()||'';
    treeFilter.messageQueueLibrary = treeFilter.messageQueueLibrary !== '*LIBL' ? treeFilter.messageQueueLibrary?.toLocaleUpperCase() : ``;
    treeFilter.messageKey = treeFilter.messageKey?.toLocaleUpperCase() ||'';
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
      ${!treeFilter.messageQueueLibrary ? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
      where MS1.MESSAGE_TYPE not in ('REPLY') 
      and MS1.MESSAGE_QUEUE_NAME = '${treeFilter.messageQueue}'
      ${type === '*USRPRF' ?`and MS1.FROM_USER = '${treeFilter.messageQueue}'`:''}
      ${treeFilter.messageKey ? ` and MS1.MESSAGE_KEY = binary(x'${treeFilter.messageKey}')` : ''}
      `.replace(/\n\s*/g, ' ');
      // ${type === '*MSGQ' ?`and MS1.MESSAGE_QUEUE_NAME = '${treeFilter.messageQueue}'`:''}
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return { messageText: `no results` };
    }
    // return results
    let returnMsgqList = results
      .map(result => ({
        messageQueueLibrary: result.MESSAGE_QUEUE_LIBRARY,
        messageQueue: result.MESSAGE_QUEUE_NAME,
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
        messageReply: String(result.REPLY_MESSAGE !== null ? result.REPLY_MESSAGE : ''),
        messageReplyJob: String(result.REPLY_MESSAGE !== null ? result.REPLY_FROM_JOB : ''),
        messageReplyUser: String(result.REPLY_MESSAGE !== null ? result.REPLY_FROM_USER : ''),
        messageReplyProgram: String(result.REPLY_MESSAGE !== null ? result.REPLY_FROM_PROGRAM : ''),
        messageKeyAssociated: String(result.REPLY_MESSAGE !== null ? result.ASSOCIATED_MESSAGE_KEY : ''), // answered INQUIRY message key
        messageReplyTimestamp: String(result.REPLY_MESSAGE !== null ? result.REPLY_TIMESTAMP : '')
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

    if (options) {
    }

    uriPath = uriPath.replace(/^\/+/, '') || '';
    const thePathParts = breakUpPathFileNameMessage(uriPath);
    const treeFilter = {
      messageQueueLibrary: thePathParts.get("messageQueueLibrary") || '',
      messageQueue: thePathParts.get("messageQueue") || '',
      messageKey: thePathParts.get("messageKey")||''
    } as IBMiMessageQueueMessage;

    let mdContent = ``;
    let retry = 1;
    while (retry > 0) {
      retry--;
      try {
        //If this command fails we need to try again after we delete the temp remote
        switch (fileExtension.toLowerCase()) {
        default:
          // const thePathParts: string[] = uriPath.split(/[/~.]/);
          const md = await getMessageQueueMessageFullDetails(treeFilter, thePathParts.get("type")||'*MSGQ');
          const mdFromJobParts = md.fromJob!.split('/');
          if (md) {
            const fmtMsgArray = formatMessageSecondText(md.messageTextSecondLevel || '');
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
        }
      } catch (e) {
      }
    }

    return mdContent;
  }
  /**
  * @param {string} messageQueue
  * @param {string} messageQueueLibrary
  * @returns {Promise<String>} a string with the count of messages in message queue
  */
  export async function getMessageQueueCount(caller: string , treeFilter: IBMiMessageQueue , searchWords?: string, messageID?: string, messageType?: string): Promise<string> {

    treeFilter.messageQueue = treeFilter.messageQueue.toLocaleUpperCase();
    treeFilter.messageQueueLibrary = treeFilter.messageQueueLibrary !== '*LIBL' ? treeFilter.messageQueueLibrary.toLocaleUpperCase() : ``;
    const searchWordsU = searchWords?.toLocaleUpperCase() || '';
    const objQuery = `/*${caller}*/ select count(*) MSGQ_COUNT
      from QSYS2.MESSAGE_QUEUE_INFO MS1
      ${!treeFilter.messageQueueLibrary || treeFilter.type === '*USRPRF'? `inner join QSYS2.LIBRARY_LIST_INFO on SCHEMA_NAME = MS1.MESSAGE_QUEUE_LIBRARY` : ''}
      where MS1.MESSAGE_TYPE not in ('REPLY') 
      ${treeFilter.type === '*MSGQ' ?`and MS1.MESSAGE_QUEUE_NAME = '${treeFilter.messageQueue}'`:''}
      ${treeFilter.type === '*USRPRF' ?`and MS1.FROM_USER = '${treeFilter.messageQueue}'`:''}
      ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
      ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
      ${searchWordsU ? ` and (ucase(MESSAGE_TEXT) like '%${searchWordsU}%' 
                          or ucase(MESSAGE_SECOND_LEVEL_TEXT) like '%${searchWordsU}%'
                          or ucase(MESSAGE_ID) = '${searchWordsU}'
                          or ucase(MESSAGE_TYPE) like '%${searchWordsU}%'
                        )` : ''}
                        `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    if (results.length === 0) {
      return ` ${treeFilter.messageQueueLibrary}/${treeFilter.messageQueue} has no messages`;
    }
    return String(results[0].MSGQ_COUNT);
  }
  /**
  * @param {string} messageQueue
  * @param {string} messageQueueLibrary
  * @returns {Promise<String>} an object of message attributes
  */
  export async function getMessageReplies(caller: string, queues: string[], libraries: string[], msgKey?: string, messageID?: string, messageType?: string): Promise<IBMiMessageQueueMessage[]> {
    let returnMessageReplies: IBMiMessageQueueMessage[] = [];
    if (queues.length > 0) {
      const OBJS = queues.map(queue => `'${queue}'`).join(', ');
      const OBJLIBS = (libraries.length === 0 || libraries.length === 1 && libraries[0] === '*LIBL')
        ? 'select LL.SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO LL'
        : libraries.map(library => `'${library}'`).join(', ');

      const objQuery = `/*${caller}*/ select MSR.MESSAGE_QUEUE_LIBRARY, MSR.MESSAGE_QUEUE_NAME
        , substr(MSR.MESSAGE_TEXT,1,25) MESSAGE_REPLY, MSR.FROM_USER REPLY_FROM_USER, MSR.FROM_JOB REPLY_FROM_JOB
        , MSR.FROM_PROGRAM REPLY_FROM_PROGRAM
        , hex(MSR.MESSAGE_KEY) MESSAGE_KEY, hex(MSR.ASSOCIATED_MESSAGE_KEY) ASSOCIATED_MESSAGE_KEY
        from QSYS2.MESSAGE_QUEUE_INFO MSR
        where MESSAGE_TYPE = 'REPLY'
        ${OBJS ? ` and MSR.MESSAGE_QUEUE_NAME in (${OBJS})` : ''}
        ${OBJLIBS ? ` and MSR.MESSAGE_QUEUE_LIBRARY in (${OBJLIBS})` : ''}
        ${msgKey ? ` and MSR.ASSOCIATED_MESSAGE_KEY = binary(x'${msgKey}')` : ''}
        ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
        `.replace(/\n\s*/g, ' ');
      // ${messageType ? ` and MESSAGE_TYPE = '${messageType}'` : ''}
      let results = await Code4i!.runSQL(objQuery);

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
    }
    return returnMessageReplies;
  }

  export async function answerMessage(item: IBMiMessageQueueMessage, userReply?: string): Promise<boolean> {
    userReply = userReply || '*DFT';
    let actionCompleteGood: boolean = true;
    const command = `SNDRPY MSGKEY(x'${item.messageKey}') MSGQ(${item.messageQueueLibrary}/${item.messageQueue}) RPY('${userReply}') RMV(*NO)`;
    const commandResult = await Code4i.runCommand({
      command: command
      , environment: `ile`
    });
    if (commandResult) {
      // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
      if (commandResult.code === 0 || commandResult.code === null) {
      } else {
        actionCompleteGood = false;
      }
    }

    return actionCompleteGood;
  }
  export async function sendMessage(item: IBMiMessageQueue, userReply?: string, inquiry?: Boolean): Promise<boolean> {
    userReply = userReply || '*DFT';
    let actionCompleteGood: boolean = true;
    const command = `SNDMSG 
    MSG('${userReply}')
    ${item.type === '*MSGQ' ?`TOMSGQ(${item.messageQueueLibrary}/${item.messageQueue})`:''}
    ${item.type === '*USRPRF' ?`TOUSR(${item.messageQueue})`:''}
    ${inquiry === true ?`MSGTYPE(*INQ) RPYMSGQ(${Code4i.getConnection().currentUser}) `:''}
    `.replace(/\n\s*/g, ' ');
    const commandResult = await Code4i.runCommand({
      command: command
      , environment: `ile`
    });
    if (commandResult) {
      // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
      if (commandResult.code === 0 || commandResult.code === null) {
      } else {
        actionCompleteGood = false;
      }
    }

    return actionCompleteGood;
  }
}
export namespace IBMiContentFS {
  export async function getObjectText(objects: string[], libraries: string[], types: string[]): Promise<ObjAttributes[]> {
    const OBJS = objects.map(object => `'${object}'`).join(', ').toLocaleUpperCase();
    const library = (libraries.length === 1 && libraries[0] === '*LIBL')
      ? '*LIBL'
      : '*ALL';
    const TYPES = types?.map(type => `${type}`).join(', ').toLocaleUpperCase() || '*ALL';
    const OBJLIBS =
      (library !== '*LIBL' && library !== '*ALL') 
      ? `'` + libraries.filter(item => !'*LIBL'.includes(item)).join(`', '`).toLocaleUpperCase() + `'` 
      : '';

    const objQuery = `/*GETOBJECTTEXT*/ select OBJLONGSCHEMA SCHEMA_NAME, OBJNAME OBJECT_NAME, OBJTEXT OBJECT_TEXT
      from table ( QSYS2.OBJECT_STATISTICS(OBJECT_SCHEMA => '${library}', OBJTYPELIST => '${TYPES}', OBJECT_NAME => '*ALL') ) OB 
      where 1=1
      ${OBJLIBS ? ` and OBJLONGSCHEMA in (${OBJLIBS})` : ''}
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
    const OBJS = objects.map(object => `'${object}'`).join(', ').toLocaleUpperCase();
    const OBJLIBS = (libraries.length === 0 || libraries.length === 1 && libraries[0] === '*LIBL')
      ? 'select LL.SCHEMA_NAME from QSYS2.LIBRARY_LIST_INFO LL where LL.SCHEMA_NAME = B.OBJLONGSCHEMA'
      : libraries.map(library => `'${library}'`).join(', ').toLocaleUpperCase();
    const TYPESA = types?.map(type => `'${type}'`).join(', ').toLocaleUpperCase() || '';// comma list for IN() clause
    const TYPESB = types?.map(type => `${type}`).join(', ').toLocaleUpperCase() || '';// comma list without quote of each item

    const objQuery = `/*GETOBJECTLOCKS*/ with T1 as (select B.OBJLONGSCHEMA SCHEMA_NAME, B.OBJNAME OBJECT_NAME, B.OBJTYPE OBJECT_TYPE
      , LOCK_STATE, LOCK_STATUS, LOCK_SCOPE, JOB_NAME
      , row_number() over( partition by b.OBJNAME,B.OBJTYPE) QUEUE_NUMBER
      from table(QSYS2.OBJECT_STATISTICS('*ALL', '${TYPESB}', '*ALL')) B
      left join  QSYS2.OBJECT_LOCK_INFO OL on OL.OBJECT_NAME=B.OBJNAME and OL.OBJECT_SCHEMA=B.OBJLONGSCHEMA ${TYPESA ? `and OL.OBJECT_TYPE in (${TYPESA})` : ``} 
      where 1=1
      ${OBJLIBS ? ` and B.OBJLONGSCHEMA in (${OBJLIBS})` : ''}
      ${OBJS ? `and B.OBJNAME in (${OBJS})` : ``}
      ${TYPESA ? `and B.OBJTYPE in (${TYPESA})` : ``}
      ) select SCHEMA_NAME ,OBJECT_NAME, OBJECT_TYPE ,LOCK_STATE ,LOCK_STATUS ,LOCK_SCOPE ,JOB_NAME 
      from T1 where QUEUE_NUMBER = 1`.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    let objLockState: ObjLockState[] = [];
    if (results.length > 0) {
      objLockState = results.map((result) =>
      ({
        library: result.SCHEMA_NAME,
        name: result.OBJECT_NAME,
        objectType: result.OBJECT_TYPE,
        lockState: result.LOCK_STATE,
        lockStatus: result.LOCK_STATUS,
        lockScope: result.LOCK_SCOPE,
        jobName: result.JOB_NAME
      } as ObjLockState)
      );
    }
    return objLockState;
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
        if (lineCount > 0) { lineIndents = '  '; lineCount++; }
        // When formatting message text, we need to split long lines and indent by proper spaces.
        result.push(formatIndents + lineIndents + currentLine.trim()); // Trim to remove any leading/trailing spaces
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
    result.push(formatIndents + lineIndents + currentLine.trim());
  }

  return result;
}

export function sortObjectArrayByProperty(
  array: any[],
  key: keyof any,
  order: 'asc' | 'desc' = 'asc'
): any[] {
  return [...array].sort((a, b) => {
    const valA = a[key];
    const valB = b[key];

    if (valA === undefined || valA === null) {
      return valB === undefined || valB === null ? 0 : (order === 'asc' ? 1 : -1);
    }
    if (valB === undefined || valB === null) {
      return order === 'asc' ? -1 : 1;
    }

    if (typeof valA === 'number' && typeof valB === 'number') {
      return order === 'asc' ? valA - valB : valB - valA;
    }

    if (typeof valA === 'string' && typeof valB === 'string') {
      return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    // Handle other types or provide a default sorting
    return 0;
  });
}
export function breakUpPathFileNameMessage(pPath: string): Map<string, string> {
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