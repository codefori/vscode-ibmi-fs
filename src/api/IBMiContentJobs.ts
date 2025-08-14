import vscode, { l10n } from "vscode";
import fs from 'fs';
import tmp from 'tmp';
import util from 'util';
import { Code4i } from '../tools';
import { IBMiUserJobDetails, IBMiUserJob, DspJobOpenOptions, IBMiUserJobsFilter } from '../typings';

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

    // TODO: if in the future IBM exposes the Message Reply condition of the job to this UDF, replace the condition of V_ACTIVE_STATUS with that information
    //       in the mean time assume HLD for an active job can mean MSGW.  There is no other condition to know of MSGW status right now. 
    const objQuery = `/*${caller}*/ select JOB_NAME, JOB_NAME_SHORT, JOB_USER, JOB_NUMBER, JOB_STATUS ,JOB_TYPE
      , JOB_QUEUE_LIBRARY, JOB_QUEUE_NAME, nullif(JOB_QUEUE_STATUS,'RELEASED') JOB_QUEUE_STATUS, CCSID JOB_CCSID, JOB_ENTERED_SYSTEM_TIME 
      , case when V_ACTIVE_JOB_STATUS = 'HLD' then 'MSGW' else V_ACTIVE_JOB_STATUS end V_ACTIVE_JOB_STATUS
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
        jobQueueLibrary: result.JOB_QUEUE_LIBRARY==='null'?undefined:result.JOB_QUEUE_LIBRARY,
        jobQueueName: result.JOB_QUEUE_NAME==='null'?undefined:result.JOB_QUEUE_NAME,
        jobQueueStatus: result.JOB_QUEUE_STATUS==='null'?undefined:result.JOB_QUEUE_STATUS,
        jobCCSID: result.JOB_CCSID,
        activeJobStatus: result.V_ACTIVE_JOB_STATUS==='null'?undefined:result.V_ACTIVE_JOB_STATUS,
        jobEnteredSystemTime: result.JOB_ENTERED_SYSTEM_TIME

      } as IBMiUserJob))
      .filter(obj => searchWords_.length === 0 || searchWords_.some(term => Object.values(obj).join(" ").toLocaleLowerCase().includes(term)))
      ;

    return returnMsgqList;

  }
  /**
  * @param {string} user - user of the job to show details
  * @param {string} treeFilter - Basic tree view node details for a user job
  * @returns {Promise<IBMiUserJobDetails[]>}
  */
  export async function getUserJobFullDetails(user: IBMiUserJobsFilter, treeFilter: IBMiUserJob): Promise<IBMiUserJobDetails> {

    treeFilter.jobName = treeFilter.jobName?.toLocaleUpperCase() || '';
    treeFilter.jobNameShort = treeFilter.jobNameShort?.toLocaleUpperCase() || '';
    const objQuery = `select JOB_NAME, JOB_NAME_SHORT, JOB_USER, JOB_NUMBER, JOB_INFORMATION, JOB_STATUS, JOB_TYPE, JOB_TYPE_ENHANCED,
      JOB_SUBSYSTEM, JOB_DATE, JOB_DESCRIPTION_LIBRARY, JOB_DESCRIPTION, JOB_ACCOUNTING_CODE, SUBMITTER_JOB_NAME,
      SUBMITTER_MESSAGE_QUEUE_LIBRARY, SUBMITTER_MESSAGE_QUEUE, SERVER_TYPE, JOB_ENTERED_SYSTEM_TIME, JOB_SCHEDULED_TIME,
      JOB_ACTIVE_TIME, JOB_END_TIME, JOB_END_SEVERITY, COMPLETION_STATUS, JOB_END_REASON, JOB_QUEUE_LIBRARY, JOB_QUEUE_NAME, JOB_QUEUE_STATUS,
      JOB_QUEUE_PRIORITY, JOB_QUEUE_TIME, JOB_MESSAGE_QUEUE_MAXIMUM_SIZE, JOB_MESSAGE_QUEUE_FULL_ACTION, ALLOW_MULTIPLE_THREADS, PEAK_TEMPORARY_STORAGE,
      DEFAULT_WAIT, MAXIMUM_PROCESSING_TIME_ALLOWED, MAXIMUM_TEMPORARY_STORAGE_ALLOWED, TIME_SLICE, JOB_SWITCHES, ROUTING_DATA, CHARACTER_IDENTIFIER_CONTROL,
      SORT_SEQUENCE_LIBRARY, SORT_SEQUENCE_NAME, LANGUAGE_ID, COUNTRY_ID, DATE_FORMAT, DATE_SEPARATOR, TIME_SEPARATOR, DECIMAL_FORMAT, TIME_ZONE_DESCRIPTION_NAME,
      MESSAGE_LOGGING_LEVEL, MESSAGE_LOGGING_SEVERITY, MESSAGE_LOGGING_TEXT, LOG_CL_PROGRAM_COMMANDS, STATUS_MESSAGE, INQUIRY_MESSAGE_REPLY,
      BREAK_MESSAGE, JOB_LOG_OUTPUT, JOB_LOG_PENDING, OUTPUT_QUEUE_PRIORITY, OUTPUT_QUEUE_LIBRARY, OUTPUT_QUEUE_NAME, SPOOLED_FILE_ACTION,
      PRINTER_DEVICE_NAME, PRINT_KEY_FORMAT, PRINT_TEXT, DEVICE_NAME, DEVICE_RECOVERY_ACTION, DDM_CONVERSATION, MODE_NAME, UNIT_OF_WORK_ID, INTERNAL_JOB_ID
      from table (QSYS2.JOB_INFO(JOB_USER_FILTER => '${user}', JOB_NAME_FILTER => '${treeFilter.jobNameShort}')) 
      JI where JOB_TYPE not in ('SBS','SYS','RDR','WTR') 
      and JOB_NAME = '${treeFilter.jobName}'
      `.replace(/\n\s*/g, ' ');
    let results = await Code4i!.runSQL(objQuery);

    if (results.length === 0) {
      return { jobName: `no results` };
    }
    // return results
    let returnJobsList = results
      .map(result => ({
        jobName: result.JOB_NAME,
        jobNameShort: result.JOB_NAME_SHORT,
        jobUser: result.JOB_USER,
        jobNumber: result.JOB_NUMBER,
        jobStatus: result.JOB_STATUS,
        jobType: result.JOB_TYPE,
        jobTypeEnhanced: result.JOB_TYPE_ENHANCED,
        jobSubsystem: result.JOB_SUBSYSTEM,
        jobDate: result.JOB_DATE,
        jobDescriptionLibrary: result.JOB_DESCRIPTION_LIBRARY,
        jobDescription: result.JOB_DESCRIPTION,
        jobAccountingCode: result.JOB_ACCOUNTING_CODE,
        submitterJobName: result.SUBMITTER_JOB_NAME,
        submitterMessageQueueLibrary: result.SUBMITTER_MESSAGE_QUEUE_LIBRARY,
        submitterMessageQueue: result.SUBMITTER_MESSAGE_QUEUE,
        serverType: result.SERVER_TYPE,
        jobEnteredSystemTime: result.JOB_ENTERED_SYSTEM_TIME,
        jobScheduledTime: result.JOB_SCHEDULED_TIME,
        jobActiveTime: result.JOB_ACTIVE_TIME,
        jobEndTime: result.JOB_END_TIME,
        jobEndSeverity: result.JOB_END_SEVERITY,
        completionStatus: result.COMPLETION_STATUS,
        jobEndReason: result.JOB_END_REASON,
        jobQueueLibrary: result.JOB_QUEUE_LIBRARY,
        jobQueueName: result.JOB_QUEUE_NAME,
        jobQueueStatus: result.JOB_QUEUE_STATUS,
        jobQueuePriority: result.JOB_QUEUE_PRIORITY,
        jobQueueTime: result.JOB_QUEUE_TIME,
        jobMessageQueueMaximumSize: result.JOB_MESSAGE_QUEUE_MAXIMUM_SIZE,
        jobMessageQueueFullAction: result.JOB_MESSAGE_QUEUE_FULL_ACTION,
        allowMultipleThreads: result.ALLOW_MULTIPLE_THREADS,
        peakTemporaryStorage: result.PEAK_TEMPORARY_STORAGE,
        defaultWait: result.DEFAULT_WAIT,
        maximumProcessingTimeAllowed: result.MAXIMUM_PROCESSING_TIME_ALLOWED,
        maximumTemporaryStorageAllowed: result.MAXIMUM_TEMPORARY_STORAGE_ALLOWED,
        timeSlice: result.TIME_SLICE,
        jobSwitches: result.JOB_SWITCHES,
        routingData: result.ROUTING_DATA,
        characterIdentifierControl: result.CHARACTER_IDENTIFIER_CONTROL,
        sortSequenceLibrary: result.SORT_SEQUENCE_LIBRARY,
        sortSequenceName: result.SORT_SEQUENCE_NAME,
        languageId: result.LANGUAGE_ID,
        countryId: result.COUNTRY_ID,
        dateFormat: result.DATE_FORMAT,
        dateSeparator: result.DATE_SEPARATOR,
        timeSeparator: result.TIME_SEPARATOR,
        decimalFormat: result.DECIMAL_FORMAT,
        timeZoneDescriptionName: result.TIME_ZONE_DESCRIPTION_NAME,
        messageLoggingLevel: result.MESSAGE_LOGGING_LEVEL,
        messageLoggingSeverity: result.MESSAGE_LOGGING_SEVERITY,
        messageLoggingText: result.MESSAGE_LOGGING_TEXT,
        logClProgramCommands: result.LOG_CL_PROGRAM_COMMANDS,
        statusMessage: result.STATUS_MESSAGE,
        inquiryMessageReply: result.INQUIRY_MESSAGE_REPLY,
        breakMessage: result.BREAK_MESSAGE,
        jobLogOutput: result.JOB_LOG_OUTPUT,
        jobLogPending: result.JOB_LOG_PENDING,
        outputQueuePriority: result.OUTPUT_QUEUE_PRIORITY,
        outputQueueLibrary: result.OUTPUT_QUEUE_LIBRARY,
        outputQueueName: result.OUTPUT_QUEUE_NAME,
        spooledFileAction: result.SPOOLED_FILE_ACTION,
        printerDeviceName: result.PRINTER_DEVICE_NAME,
        printKeyFormat: result.PRINT_KEY_FORMAT,
        printText: result.PRINT_TEXT,
        deviceName: result.DEVICE_NAME,
        deviceRecoveryAction: result.DEVICE_RECOVERY_ACTION,
        ddmConversation: result.DDM_CONVERSATION,
        modeName: result.MODE_NAME,
        unitOfWorkId: result.UNIT_OF_WORK_ID,
        internaljobId: result.INTERNAL_JOB_ID
      } as IBMiUserJobDetails));

    return returnJobsList[0];

  }
  /**
  * Download the contents of a user job details
  * @param {string} user - user of the job to show details
  * @param {string} uriPath - path to use when displaying the tab
  * @param {string} fileExtension - pseudo file type to show in editor tab
  * @param {string} options - open options, not really useful. 
  */
  export async function downloadJobDetails(uriPath: string) {
    const connection = Code4i.getConnection();

    uriPath = uriPath.replace(/^\/+/, '') || '';
    const pathParts = uriPath.replace(/^\/+/, '').split('.');

    const tempRmt = connection.getTempRemote(uriPath);
    const tmplclfile = await tmpFile();
    let reportContent: string = ``;
    const cmd = `DSPJOB job(${pathParts[0]}) OUTPUT(*PRINT) OPTION(*ALL)`;
    const cmdResults = await connection.runCommand({
      command: cmd
      , environment: `ile`
    });
    if (cmdResults.stdout.length > 0) {
      reportContent = cmdResults.stdout;
    }
    else {
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
        if (commandResult.code === 0 || commandResult.code === null) {
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
        if (commandResult.code === 0 || commandResult.code === null) {
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