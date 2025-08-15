import vscode, { l10n } from "vscode";
import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import { Code4i } from '../tools';
import { IBMiUserJob, DspJobOpenOptions, IBMiUserJobsFilter } from '../typings';

const tmpFile = util.promisify(tmp.file);
const readFileAsync = util.promisify(fs.readFile);

export namespace IBMiContentJobs {
  /**
  * @param {string} user - user of the job to show details
  * @param {string} treeFilter - Basic tree view node details for a user job
  * @param {string} searchWords - value to search for in list of user jobs 
  * @param {string} activeJobStatus - condition to indicate if user job is waiting on a message to be answered.
  * @returns {Promise<IBMiUserJob[]>}
  */
  export async function getUserJobList(caller: string, user: IBMiUserJobsFilter, searchWords?: string, activeJobStatus?: string): Promise<IBMiUserJob[]> {

    const searchWordsU = searchWords?.toLocaleUpperCase() || '';
    const activeJobStatusU = activeJobStatus?.toLocaleUpperCase() || '';

    // TODO: So IBM does not consistently give information if a job is in MSGW status.  
    //        Column V_ACTIVE_JOB_STATUS hold several values but if a job is in MSGW and HELD the status is HLD
    //        just as if the job was a normally running job that was held.  This means currently I have no way to 
    //        know if a job is in MSGW status if its held.  I am not certain if it matters.
    const objQuery = `/*${caller}*/ select JOB_NAME, JOB_NAME_SHORT, JOB_USER, JOB_NUMBER, JOB_STATUS ,JOB_TYPE
      , ifnull(JOB_QUEUE_LIBRARY,'') JOB_QUEUE_LIBRARY, ifnull(JOB_QUEUE_NAME,'') JOB_QUEUE_NAME
      , ifnull(nullif(JOB_QUEUE_STATUS, 'RELEASED'),'') JOB_QUEUE_STATUS
      , CCSID JOB_CCSID, JOB_ENTERED_SYSTEM_TIME 
      , V_ACTIVE_JOB_STATUS
      from table (QSYS2.JOB_INFO(JOB_USER_FILTER => '${user}')) JI
      left join table (QSYS2.GET_JOB_INFO(JI.JOB_NAME,V_IGNORE_ERRORS =>'YES')) GJI on 1=1
      where JOB_TYPE not in ('SBS','SYS','RDR','WTR') 
      ${activeJobStatusU ? ` and V_ACTIVE_JOB_STATUS = '${activeJobStatusU}'` : ''}
        ${searchWordsU ? ` and (ucase(JOB_STATUS) like '%${searchWordsU}%' 
                            or ucase(JOB_NAME) like '%${searchWordsU}%'
                            or ucase(SUBMITTER_JOB_NAME) = '${searchWordsU}'
                          )` : ''}
                          `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return [];
    }
    let searchWords_ = searchWords?.toLocaleLowerCase().split(' ') || [];

    // return results
    let returnMsgqList = results
      .map(result => ({
        jobName: result.JOB_NAME,
        jobNameShort: result.JOB_NAME_SHORT,
        jobUser: result.JOB_USER,
        jobNumber: result.JOB_NUMBER,
        jobStatus: result.JOB_STATUS,
        jobType: result.JOB_TYPE,
        jobQueueLibrary: result.JOB_QUEUE_LIBRARY,
        jobQueueName: result.JOB_QUEUE_NAME,
        jobQueueStatus: result.JOB_QUEUE_STATUS,
        jobCCSID: result.JOB_CCSID,
        activeJobStatus: result.V_ACTIVE_JOB_STATUS,
        jobEnteredSystemTime: result.JOB_ENTERED_SYSTEM_TIME

      } as IBMiUserJob))
      .filter(obj => searchWords_.length === 0 || searchWords_.some(term => Object.values(obj).join(" ").toLocaleLowerCase().includes(term)))
      ;

    return returnMsgqList;

  }
 
  /**
  * Download the contents of a user job details
  * @param {string} user - user of the job to show details
  * @param {string} uriPath - path to use when displaying the tab
  * @param {string} fileExtension - pseudo file type to show in editor tab
  * @param {string} options - open options, not really useful. 
  */
  export async function downloadJobDetails(uriPath: string, options: DspJobOpenOptions) {
    const connection = Code4i.getConnection();

    uriPath = uriPath.replace(/^\/+/, '') || '';
    const pathParts = uriPath.replace(/^\/+/, '').split('.');

    let reportContent: string = ``;
    const cmd = `DSPJOB job(${pathParts[0]}) OUTPUT(*PRINT) OPTION(${options.printSection?options.printSection:'*ALL'})`;
    const cmdResults = await connection.runCommand({
      command: cmd
      , environment: `ile`
    });
    if (cmdResults.stdout.length > 0) {
      reportContent = cmdResults.stdout;
    }
    else if (cmdResults.stderr.length > 0) {
      throw new Error(l10n.t(`${cmdResults.stderr}`));
      reportContent = cmdResults.stderr;
    }

    return reportContent;
  }
  /**
  */
  export async function getUserJobCount(caller: string, treeFilter: IBMiUserJobsFilter, searchWords?: string, activeJobStatus?: string): Promise<string> {

    treeFilter.user = treeFilter.user.toLocaleUpperCase();
    const searchWordsU = searchWords?.toLocaleUpperCase() || '';
    const objQuery = `/*${caller}*/ select count(*) USER_JOB_COUNT
      from table (QSYS2.JOB_INFO(JOB_USER_FILTER => '${treeFilter.user}')) JI 
      left join table (QSYS2.GET_JOB_INFO(JI.JOB_NAME,V_IGNORE_ERRORS =>'YES')) GJI on 1=1
      where JOB_TYPE not in ('SBS','SYS','RDR','WTR') 
      ${activeJobStatus ? ` and V_ACTIVE_JOB_STATUS = '${activeJobStatus}'` : ''}
      ${searchWordsU ? ` and (ucase(JOB_STATUS) like '%${searchWordsU}%' 
                          or ucase(JOB_NAME) like '%${searchWordsU}%'
                          or ucase(V_ACTIVE_JOB_STATUS) like '%${searchWordsU}%'
                        )` : ''}
                        `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);
    if (results.length === 0) {
      return ` ${treeFilter.user} has no jobs`;
    }
    return String(results[0].USER_JOB_COUNT);
  }
  export async function getJobMessageWaitMessages(caller: string, jobs: string[]): Promise<IBMiUserJob[]> {

    let returnJobMessageWaits: IBMiUserJob[] = [];
    if (jobs.length > 0) {
      const JOBS = jobs.map(job => `'${job}'`).join(', ').toLocaleUpperCase();
      const objQuery = `/*${caller}*/ select MSI.FROM_JOB, MSI.MESSAGE_KEY, MSI.MESSAGE_QUEUE_LIBRARY, MSI.MESSAGE_QUEUE_NAME 
          from QSYS2.MESSAGE_QUEUE_INFO MSI 
          where MSI.MESSAGE_TYPE = 'INQUIRY'
          ${JOBS ? ` and MSI.FROM_JOB in (${JOBS})` : ''}
          `.replace(/\n\s*/g, ' ');
      let results = await Code4i!.runSQL(objQuery);

      if (results.length === 0) {
        return [];
      }
      // return results
      returnJobMessageWaits = results
        .map(object => ({
          jobName: object.FROM_JOB,
          jobMessageKey: object.MESSAGE_KEY,
          jobMessageQueueLibrary: object.MESSAGE_QUEUE_LIBRARY,
          jobMessageQueueName: object.MESSAGE_QUEUE_NAME
        } as IBMiUserJob))
        ;
    }
    return returnJobMessageWaits;
  }
  export async function answerMessage(item: IBMiUserJob, userReply?: string): Promise<boolean> {
      userReply = userReply || '*DFT';
      let actionCompleteGood: boolean = true;
      const command = `SNDRPY MSGKEY(${item.jobMessageKey}) MSGQ(${item.jobMessageQueueLibrary}/${item.jobMessageQueueName}) RPY('${userReply}') RMV(*NO)`;
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
  export async function holdJob(item: IBMiUserJob): Promise<boolean> {
      let actionCompleteGood: boolean = true;
      const command = `HLDJOB JOB(${item.jobName}) DUPJOBOPT(*MSG)`;
      const commandResult = await Code4i.runCommand({
        command: command
        , environment: `ile`
      });
      if (commandResult) {
        if (commandResult.stderr.length > 0) {
          throw new Error(commandResult.stderr);
        } else {
          actionCompleteGood = false;
        }
      } else {
         throw new Error(l10n.t(`Error atempting to hold job, ${item.jobName}.`, ));
      }
  
      return actionCompleteGood;
    }
  export async function releaseJob(item: IBMiUserJob): Promise<boolean> {
      let actionCompleteGood: boolean = true;
      const command = `RLSJOB JOB(${item.jobName}) DUPJOBOPT(*MSG)`;
      const commandResult = await Code4i.runCommand({
        command: command
        , environment: `ile`
      });
      if (commandResult) {
        if (commandResult.stderr.length > 0) {
          throw new Error(commandResult.stderr);
        } else {
          actionCompleteGood = false;
        }
      } else {
         throw new Error(l10n.t(`Error atempting to release job, ${item.jobName}.`, ));
      }
  
      return actionCompleteGood;
    }
}