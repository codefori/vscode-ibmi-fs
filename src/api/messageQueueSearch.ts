/* searchUserMessage */
import util from "util";
import fs from "fs";
import tmp from "tmp";
import { Code4i } from "../tools";
import { isProtectedFilter } from '../filesystem/qsys/MsgQFs';
import { IBMiContentMsgq,sortObjectArrayByProperty } from "./IBMiContentfs";
import { IBMiMessageQueue } from '../typings';

const tmpFile = util.promisify(tmp.file);
const writeFileAsync = util.promisify(fs.writeFile);

export namespace MessageQueueSearch {

  export interface Result {
    path: string
    lines: Line[]
    readonly?: boolean
    label?: string
    contextValue?: string
  }
  export interface Line {
    number: number
    content: string
  }

  export async function searchMessageQueue(searchTerm: string, treeFilter: IBMiMessageQueue, searchWords?: string, messageID?: string): Promise<Result[]> {
    const connection = Code4i.getConnection();
    const config = Code4i.getConfig();
    const content = Code4i.getContent();

    if (connection && config && content) {

      const client = connection.client;
      const tempLib = config.tempLibrary;
      const tempName = Code4i.makeid();
      const tempRmt = connection.getTempRemote(tempLib + `VSC_TMP_1` + `VSC_TMP_1`);
      if (tempRmt) {
        const tmpobj = await tmpFile();
        const setccsid = connection.remoteFeatures.setccsid;
        let objects = await IBMiContentMsgq.getMessageQueueMessageList(`MessageQueueSearch.searchMessageQueue`
                                      , treeFilter, searchWords, messageID);
        objects = sortObjectArrayByProperty(objects, `messageTimestamp`, `asc`);

        // const workFileFormat = {
        //   messageQueueLibrary: objects[0].messageQueueLibrary,
        //   messageQueue: objects[0].messageQueue,
        //   messageID: objects[0].messageID,
        //   messageKey: objects[0].messageKey,
        //   messageText: objects[0].messageText
        // };
        // let largeString = JSON.stringify(workFileFormat);
        const query =
          `create or replace table ${tempLib}.${tempName} as (select MESSAGE_ID, MESSAGE_KEY, MESSAGE_TEXT
          from table ( QSYS2.MESSAGE_QUEUE_INFO(
           QUEUE_NAME => '${treeFilter.messageQueue}'
           QUEUE_LIBRARY => '${treeFilter.messageQueueLibrary}')
           where 1=1
          ${messageID ? ` and MESSAGE_ID = '${messageID}'` : ''}
          ${searchWords ? ` and (MESSAGE_TEXT like '%${searchWords}%' or MESSAGE_SECOND_LEVEL_TEXT like '%${searchWords}%')` : ''}
          )  with no data`.replace(/\n\s*/g, '');
        const rs = await Code4i!.runSQL(query);
      }
      else { return []; }
    }
    else {
      throw new Error("Please connect to an IBM i");
    }
    return [];
  }
}

function sliceUp(arr: any[], size: number): any[] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}
function sanitizeSearchTerm(searchTerm: string): string {
  return searchTerm.replace(/\\/g, `\\\\`).replace(/"/g, `\\\\"`);
}
function parseGrepOutput(output: string, filter?: string, pathTransformer?: (path: string) => string): MessageQueueSearch.Result[] {
  const results: MessageQueueSearch.Result[] = [];
  const readonly = isProtectedFilter(filter);
  for (const line of output.split('\n')) {
    if (!line.startsWith(`Binary`)) {
      const parts = line.split(`:`); //path:line
      const path = pathTransformer?.(parts[0]) || parts[0];
      let result = results.find(r => r.path === path);
      if (!result) {
        result = {
          path,
          lines: [],
          readonly,
        };
        results.push(result);
      }

      const contentIndex = nthIndex(line, `:`, 2);
      if (contentIndex >= 0) {
        const curContent = line.substring(contentIndex + 1);

        result.lines.push({
          number: Number(parts[1]),
          content: curContent
        });
      }
    }
  }

  return results;
}
function nthIndex(aString: string, pattern: string, n: number) {
  let index = -1;
  while (n-- && index++ < aString.length) {
    index = aString.indexOf(pattern, index);
    if (index < 0) { break; }
  }
  return index;
}