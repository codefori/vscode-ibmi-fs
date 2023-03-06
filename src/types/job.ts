import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';

interface JobPropertie {
  jobName: string
  jobStatus: string
  enteredSystemTime: string
  jobActiveTime: string
  jobSubsystem: string
  jobTypeEnhanced: string
  jobDescription: string
  jobDescriptionLibrary: string
  jobQueueLibrary: string
  jobQueueName: string
  jobQueueStatus: string
  jobQueuePriority: number
  outputQueuePriority: number
  jobEndSeverity: number
  messageLoggingLevel: number
  messageLoggingSeverity: number
  messageLoggingText: string
  logClProgramCommands: string
  jobLogOutput: string
  printerDeviceName: string
  outputQueueName: string
  outputQueueLibrary: string
  jobDate: string
  dateFormat: string
  dateSeparator: string
  timeSeparator: string
  decimalFormat: string
  languageID: string
  countryID: string
  sortSequence: string
  ccsid: number
}

interface JobHistory {
  timestamp: string
  messageId: string
  severity: string
  texte: string
}

interface JobObjectLockInfo {
  object: string
  library: string
  objectType: string
  lockState: string
  lockStatus: string
  memberLocks: string
  asp: string
}

interface JobOpenFile {
  libraryName: string
  fileName: string
  fileType: string
  memberName: string
  deviceName: string
  recordFormat: string
  activationGroupName: string
  activationGroupNumber: string
  openOption: string
  iaspName: string
  objectText: string
}

interface ProgramStack {
  requestLevel: number
  programName: string
  programLibraryName: string
  statementIdentifiers: string
  controlBoundary: string
  programAspName: string
  moduleName: string
  moduleLibraryName: string
  procedureName: string
  activationGroupNumber: number
  activationGroupName: string
}

interface CommitmentControlStatus {
  commitmentDefinition: string
  commitmentDefinitionDescription: string
  logicalUnitOfWorkId: string
  lockSpaceId: string
  logicalUnitOfWorkState: string
  stateTimestamp: string
  resourceLocation: string
  defaultLockLevel: string
  localChangesPending: string
}

export class JobProperties extends Base {
  private jobPropertie: JobPropertie | undefined;
  private jobHistory: JobHistory[] | undefined;
  private jobObjectLockInfo: JobObjectLockInfo[] | undefined;
  private jobOpenFiles: JobOpenFile[] | undefined;
  private programsStack: ProgramStack[] | undefined;
  private commitmentsControlStatus: CommitmentControlStatus[] | undefined;

  async fetch(): Promise<void> {
    const connection = Code4i.getConnection();
    const content = Code4i.getContent();
    if (connection && content) {

      // Job Properties
      const jobProperties = await Code4i.getContent().runSQL([`SELECT X.JOB_NAME "jobName",
         X.JOB_STATUS "jobStatus",
         X.JOB_ENTERED_SYSTEM_TIME "enteredSystemTime",
         X.JOB_ACTIVE_TIME "jobActiveTime",
         X.JOB_SUBSYSTEM "jobSubsystem",
         X.JOB_TYPE_ENHANCED "jobTypeEnhanced",
         X.JOB_DESCRIPTION "jobDescription",
         X.JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
         IFNULL(X.JOB_QUEUE_LIBRARY, '') "jobQueueLibrary",
         IFNULL(X.JOB_QUEUE_NAME, '') "jobQueueName",
         IFNULL(X.JOB_QUEUE_STATUS, '') "jobQueueStatus",
         IFNULL(X.JOB_QUEUE_PRIORITY, 0) "jobQueuePriority",
         X.OUTPUT_QUEUE_PRIORITY "outputQueuePriority",
         X.JOB_END_SEVERITY "jobEndSeverity",
         X.MESSAGE_LOGGING_LEVEL "messageLoggingLevel",
         X.MESSAGE_LOGGING_SEVERITY "messageLoggingSeverity",
         X.MESSAGE_LOGGING_TEXT "messageLoggingText",
         X.LOG_CL_PROGRAM_COMMANDS "logClProgramCommands",
         X.JOB_LOG_OUTPUT "jobLogOutput",
         X.PRINTER_DEVICE_NAME "printerDeviceName",
         X.OUTPUT_QUEUE_NAME "outputQueueName",
         X.OUTPUT_QUEUE_LIBRARY "outputQueueLibrary",
         X.JOB_DATE "jobDate",
         X.DATE_FORMAT "dateFormat",
         X.DATE_SEPARATOR "dateSeparator",
         X.TIME_SEPARATOR "timeSeparator",
         X.DECIMAL_FORMAT "decimalFormat",
         ifnull(x.language_id, '') "languageID",
         ifnull(x.country_id, '') "countryID",
         ifnull(x.sort_sequence_name, '') "sortSequence",
         x.ccsid "ccsid"
         FROM TABLE (QSYS2.JOB_INFO()) X
         where x.job_name = '${this.name}' LIMIT 1`].join(` `));
         
      if (jobProperties && jobProperties.length > 0) {
        const resultsJobPropertie: JobPropertie[] = jobProperties.map(row => ({
          jobName: String(row.jobName),
          jobStatus: String(row.jobStatus),
          enteredSystemTime: String(row.enteredSystemTime),
          jobActiveTime: String(row.jobActiveTime),
          jobSubsystem: String(row.jobSubsystem),
          jobTypeEnhanced: String(row.jobTypeEnhanced),
          jobDescription: String(row.jobDescription),
          jobDescriptionLibrary: String(row.jobDescriptionLibrary),
          jobQueueLibrary: String(row.jobQueueLibrary),
          jobQueueName: String(row.jobQueueName),
          jobQueueStatus: String(row.jobQueueStatus),
          jobQueuePriority: Number(row.jobQueuePriority),
          outputQueuePriority: Number(row.outputQueuePriority),
          jobEndSeverity: Number(row.jobEndSeverity),
          messageLoggingLevel: Number(row.messageLoggingLevel),
          messageLoggingSeverity: Number(row.messageLoggingSeverity),
          messageLoggingText: String(row.messageLoggingText),
          logClProgramCommands: String(row.logClProgramCommands),
          jobLogOutput: String(row.jobLogOutput),
          printerDeviceName: String(row.printerDeviceName),
          outputQueueName: String(row.outputQueueName),
          outputQueueLibrary: String(row.outputQueueLibrary),
          jobDate: String(row.jobDate),
          dateFormat: String(row.dateFormat),
          dateSeparator: String(row.dateSeparator),
          timeSeparator: String(row.timeSeparator),
          decimalFormat: String(row.decimalFormat),
          languageID: String(row.languageID),
          countryID: String(row.countryID),
          sortSequence: String(row.sortSequence),
          ccsid: Number(row.ccsid),
        }));
        this.jobPropertie = resultsJobPropertie[0];
      }

      // History Job
      const jobHistories = await Code4i.getContent().runSQL([`select message_timestamp "timestamp", ifnull(message_id, '') "messageId", severity "severity", trim(message_text) "texte" 
        from table(qsys2.joblog_info('${this.name}')) a order by ordinal_position desc`].join(` `));
      if (jobHistories && jobHistories.length > 0){
        const resultsJobHistory: JobHistory[] = jobHistories.map(row => ({
          timestamp: String(row.timestamp),
          messageId: String(row.messageId),
          severity: String(row.severity),
          texte: String(row.texte),
        }));
        this.jobHistory = resultsJobHistory;
      }

      // Lock info
      const jobObjectsLockInfo = await Code4i.getContent().runSQL([`SELECT DISTINCT object_name "object",
        object_library "library",
        object_type "objectType",
        lock_state "lockState",
        lock_status "lockStatus",
        case when (IFNULL(MEMBER_LOCKS, 0) > 0) then 'YES' else 'NO' end "memberLocks",
        asp_name "asp"
        FROM TABLE (qsys2.job_lock_info(job_name => '${this.name}'))
        ORDER BY object_name, object_library, object_type`].join(` `));
      if (jobObjectsLockInfo && jobObjectsLockInfo.length > 0){
        const resultsJobObjectsLockInfo: JobObjectLockInfo[] = jobObjectsLockInfo.map(row => ({
          object: String(row.object),
          library: String(row.library),
          objectType: String(row.objectType),
          lockState: String(row.lockState),
          lockStatus: String(row.lockStatus),
          memberLocks: String(row.memberLocks),
          asp: String(row.asp),
        }));
        this.jobObjectLockInfo = resultsJobObjectsLockInfo;
      }

      // Open files
      const jobOpenFiles = await Code4i.getContent().runSQL([`SELECT LIBRARY_NAME "libraryName",
        FILE_NAME "fileName",
        FILE_TYPE "fileType",
        IFNULL(MEMBER_NAME, '') "memberName",
        IFNULL(DEVICE_NAME, '') "deviceName",
        IFNULL(RECORD_FORMAT, '') "recordFormat",
        ACTIVATION_GROUP_NAME "activationGroupName",
        ACTIVATION_GROUP_NUMBER "activationGroupNumber",
        OPEN_OPTION "openOption",
        IASP_NAME "iaspName",
        (SELECT objtext
            FROM TABLE (
                QSYS2.OBJECT_STATISTICS(
                  LIBRARY_NAME, '*ALL', OBJECT_NAME => FILE_NAME)
              ) A) "objectText"
        FROM TABLE (
            QSYS2.OPEN_FILES('${this.name}')
          ) a`].join(` `));
      if (jobOpenFiles && jobOpenFiles.length > 0){
        const resultsJobOpenFiles: JobOpenFile[] = jobOpenFiles.map(row => ({
          libraryName: String(row.libraryName),
          fileName: String(row.fileName),
          fileType: String(row.fileType),
          memberName: String(row.memberName),
          deviceName: String(row.deviceName),
          recordFormat: String(row.recordFormat),
          activationGroupName: String(row.activationGroupName),
          activationGroupNumber: String(row.activationGroupNumber),
          openOption: String(row.openOption),
          iaspName: String(row.iaspName),
          objectText: String(row.objectText),
        }));
        this.jobOpenFiles = resultsJobOpenFiles;
      }

      // Call stack
      const programsStack = await Code4i.getContent().runSQL([`SELECT IFNULL(A.REQUEST_LEVEL, 0) "requestLevel",
        A.PROGRAM_NAME "programName",
        A.PROGRAM_LIBRARY_NAME "programLibraryName",
        IFNULL(A.STATEMENT_IDENTIFIERS, '') "statementIdentifiers",
        A.CONTROL_BOUNDARY "controlBoundary",
        A.PROGRAM_ASP_NAME "programAspName",
        ifnull(A.MODULE_NAME, '') "moduleName",
        ifnull(A.MODULE_LIBRARY_NAME, '') "moduleLibraryName",
        ifnull(A.PROCEDURE_NAME, '') "procedureName",
        ifnull(A.ACTIVATION_GROUP_NUMBER, 0) "activationGroupNumber",
        ifnull(A.ACTIVATION_GROUP_NAME, '') "activationGroupName"
        FROM TABLE ( QSYS2.STACK_INFO('${this.name}', 'ALL') ) A
        ORDER BY A.ORDINAL_POSITION`].join(` `));
      if (programsStack && programsStack.length > 0){
        const resultsProgramsStack: ProgramStack[] = programsStack.map(row => ({
          requestLevel: Number(row.requestLevel),
          programName: String(row.programName),
          programLibraryName: String(row.programLibraryName),
          statementIdentifiers: String(row.statementIdentifiers),
          controlBoundary: String(row.controlBoundary),
          programAspName: String(row.programAspName),
          moduleName: String(row.moduleName),
          moduleLibraryName: String(row.moduleLibraryName),
          procedureName: String(row.procedureName),
          activationGroupNumber: Number(row.activationGroupNumber),
          activationGroupName: String(row.activationGroupName),
        }));
        this.programsStack = resultsProgramsStack;
      }

      // Commitment control
      const commitmentsControlStatus = await Code4i.getContent().runSQL([`SELECT COMMITMENT_DEFINITION "commitmentDefinition",
        COMMITMENT_DEFINITION_DESCRIPTION "commitmentDefinitionDescription",
        LOGICAL_UNIT_OF_WORK_ID "logicalUnitOfWorkId",
        LOCK_SPACE_ID "lockSpaceId",
        LOGICAL_UNIT_OF_WORK_STATE "logicalUnitOfWorkState",
        STATE_TIMESTAMP "stateTimestamp",
        RESOURCE_LOCATION "resourceLocation",
        DEFAULT_LOCK_LEVEL "defaultLockLevel",
        LOCAL_CHANGES_PENDING "localChangesPending"
        FROM QSYS2.DB_TRANSACTION_INFO
        WHERE JOB_NAME = '${this.name}'`].join(` `));
      if (commitmentsControlStatus && commitmentsControlStatus.length > 0){
        const resultsCommitmentsControlStatus: CommitmentControlStatus[] = commitmentsControlStatus.map(row => ({
          commitmentDefinition: String(row.commitmentDefinition),
          commitmentDefinitionDescription: String(row.commitmentDefinitionDescription),
          logicalUnitOfWorkId: String(row.logicalUnitOfWorkId),
          lockSpaceId: String(row.lockSpaceId),
          logicalUnitOfWorkState: String(row.logicalUnitOfWorkState),
          stateTimestamp: String(row.stateTimestamp),
          resourceLocation: String(row.resourceLocation),
          defaultLockLevel: String(row.defaultLockLevel),
          localChangesPending: String(row.localChangesPending),
        }));
        this.commitmentsControlStatus = resultsCommitmentsControlStatus;
      }

    } else {
      throw new Error("No connection.");
    }
  }

  generateHTML(): string {
    const propertieTab = `<h1>Job properties</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
        <vscode-data-grid-row row-type="header">
          <vscode-data-grid-cell cell-type="columnheader" grid-column="1"></vscode-data-grid-cell>
          <vscode-data-grid-cell cell-type="columnheader" grid-column="2"></vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Status of job</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobStatus}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Entered system</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.enteredSystemTime}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Started</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobActiveTime}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Subsystem</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobSubsystem}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Type of job</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobTypeEnhanced}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job description</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobDescription}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job description library</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobDescriptionLibrary}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job queue</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobQueueName}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job queue library</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobQueueLibrary}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job queue status</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobQueueStatus}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job priority (on job queue)</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobQueuePriority}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Output priority (on output queue)</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.outputQueuePriority}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">End severity</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobEndSeverity}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Message logging level</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.messageLoggingLevel}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Message logging severity</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.messageLoggingSeverity}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Message logging text</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.messageLoggingText}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Log CL program commands</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.logClProgramCommands}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job log output</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobLogOutput}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Printer device</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.printerDeviceName}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Default output queue</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.outputQueueName}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Default output queue library</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.outputQueueLibrary}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job date</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.jobDate}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Date format</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.dateFormat}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Date separator</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.dateSeparator}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Time separator</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.timeSeparator}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Decimal format</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.decimalFormat}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Language ID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.languageID}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Country ID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.countryID}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Sort sequence</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.sortSequence}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">CCSID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${this.jobPropertie?.ccsid}</vscode-data-grid-cell>
        </vscode-data-grid-row>
      </vscode-data-grid>
      `;

    const historyTab = `<h1>Display job log</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Timestamp</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Message ID</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Severity</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Description</b></vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.jobHistory?.map(history => {
        return /*html*/`
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${history.timestamp}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${history.messageId}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${history.severity}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${history.texte}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
      }).join("")}
      </vscode-data-grid>
      `;

    const objectsLockTab = `<h1>Objects lock</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Object</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Library</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Object type</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Lock state</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Lock status</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>Member locks ?</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>ASP</b></vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.jobObjectLockInfo?.map(objectLock => {
        return /*html*/`
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${objectLock.object}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${objectLock.library}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${objectLock.objectType}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${objectLock.lockState}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="5">${objectLock.lockStatus}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="6">${objectLock.memberLocks}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="7">${objectLock.asp}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
      }).join("")}
      </vscode-data-grid>
      `;

    const openFilesTab = `<h1>Open files</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Library</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>File name</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>File type</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Text</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Member</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>Device</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Record format</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Act. group name</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Act. group n°</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>Open option</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="11"><b>ASP</b></vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.jobOpenFiles?.map(openFile => {
        return /*html*/`
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${openFile.libraryName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${openFile.fileName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${openFile.fileType}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${openFile.objectText}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="5">${openFile.memberName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="6">${openFile.deviceName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="7">${openFile.recordFormat}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="8">${openFile.activationGroupName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="9">${openFile.activationGroupNumber}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="10">${openFile.openOption}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="11">${openFile.iaspName}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
      }).join("")}
      </vscode-data-grid>
      `;

    const programStackTab = `<h1>Call stack</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Type</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Program</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Library</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Statement</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Control Boundary</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>ASP</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Module</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Library</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Procedure</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>ACTGRP n°</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="11"><b>ACTGRP name</b></vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.programsStack?.map(programStack => {
        if (programStack.programName !== `SELECTED.`) {
          
          return /*html*/`
          <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${programStack.requestLevel}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${programStack.programName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${programStack.programLibraryName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${programStack.statementIdentifiers}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="5">${programStack.controlBoundary}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="6">${programStack.programAspName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="7">${programStack.moduleName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="8">${programStack.moduleLibraryName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="9">${programStack.procedureName}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="10">${programStack.activationGroupNumber}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="11">${programStack.activationGroupName}</vscode-data-grid-cell>
          </vscode-data-grid-row>`;
        }
      }).join("")}
      </vscode-data-grid>
      `;

    const commitmentControlTab = `<h1>Commitment control status</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Commitment definition</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Text</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Logical unit work ID</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Lock space ID</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Logical unit work state</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>State timestamp</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Resource location</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Default lock level</b></vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Changes pending</b></vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.commitmentsControlStatus?.map(commitmentControlStatus => {
          return /*html*/`
          <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${commitmentControlStatus.commitmentDefinition}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${commitmentControlStatus.commitmentDefinitionDescription}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${commitmentControlStatus.logicalUnitOfWorkId}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${commitmentControlStatus.lockSpaceId}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="5">${commitmentControlStatus.logicalUnitOfWorkState}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="6">${commitmentControlStatus.stateTimestamp}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="7">${commitmentControlStatus.resourceLocation}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="8">${commitmentControlStatus.defaultLockLevel}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="9">${commitmentControlStatus.localChangesPending}</vscode-data-grid-cell>
          </vscode-data-grid-row>`;
      }).join("")}
      </vscode-data-grid>
      `;

    const panels = /*html*/`
      <vscode-panels>
        <vscode-panel-tab id="tab-1">
          PROPERTIES
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-2">
          HISTORY
          <vscode-badge appearance="secondary">${this.jobHistory?.length ? this.jobHistory?.length : 0}</vscode-badge>
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-3">
          LOCK INFO
          <vscode-badge appearance="secondary">${this.jobObjectLockInfo?.length ? this.jobObjectLockInfo?.length : 0}</vscode-badge>
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-4">
          OPEN FILES
          <vscode-badge appearance="secondary">${this.jobOpenFiles?.length ? this.jobOpenFiles?.length : 0}</vscode-badge>
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-5">
          PROGRAM STACK
          <vscode-badge appearance="secondary">${this.programsStack?.length ? this.programsStack?.length : 0}</vscode-badge>
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-6">
          COMMITMENT CONTROL STATUS
          <vscode-badge appearance="secondary">${this.commitmentsControlStatus?.length ? this.commitmentsControlStatus?.length: 0}</vscode-badge>
        </vscode-panel-tab>
        <vscode-panel-view id="view-1">${propertieTab}</vscode-panel-view>
        <vscode-panel-view id="view-2">${historyTab}</vscode-panel-view>
        <vscode-panel-view id="view-3">${objectsLockTab}</vscode-panel-view>
        <vscode-panel-view id="view-4">${openFilesTab}</vscode-panel-view>
        <vscode-panel-view id="view-5">${programStackTab}</vscode-panel-view>
        <vscode-panel-view id="view-6">${commitmentControlTab}</vscode-panel-view>
      </vscode-panels>`; 

    return panels;
  }

  // We do the same action when use the button or Save document
  async handleAction(data: any): Promise<HandleActionResult> {
    // Nothing to do
    return {
      dirty: true
    };

  }

  async save(): Promise<void> {
    // Nothing to do
  }

}
