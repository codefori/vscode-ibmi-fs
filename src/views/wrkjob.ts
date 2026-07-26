/**
 * Work with Job (WRKJOB) Action Module
 *
 * This module provides functionality to display comprehensive job information.
 * It opens a webview with multiple tabs showing job details, statistics, and logs.
 *
 * Key Features:
 * - Display job information in a detailed table
 * - Show job statistics (call stack, locks, open files, spools)
 * - Display job log messages
 * - Job actions: hold, release, end
 *
 * @module wrkjob
 */

import * as vscode from 'vscode';
import { getInstance } from '../ibmi';
import { executeSqlIfExists } from "../tools";
import { FastTableColumn, generateFastTable, generateDetailTable } from "../ibmi";
import { generatePage, Components } from "../webviewToolkit";
import { JobOperations, SpoolOperations } from '../commonOperations';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import { generateFastTableUpdate } from "../ibmi";
import { getAutoRefreshInterval, getItemsPerPage } from '../config';

/**
 * Namespace containing actions for Work with Job
 */
export namespace WrkjobActions {
  /**
   * Map to store refresh functions and panels for each active wrkjob
   */
  const activePanels = new Map<string, {
    panel: vscode.WebviewPanel;
    refreshFn: () => Promise<void>;
  }>();

  /**
   * Currently active panel (last one that received focus)
   */
  let currentActivePanel: string | undefined;

  /**
   * Identifiers for the seven tables this view renders.
   *
   * Every table needs its own id: they share a page, so without one they would collide on
   * element ids and, worse, an update could not say which table it is meant for. They are
   * also what lets a refresh patch the rows in place rather than rebuild the page.
   */
  const TABLE_IDS = {
    libraries: 'wrkjob-libraries',
    activationGroups: 'wrkjob-activation-groups',
    callStack: 'wrkjob-call-stack',
    locks: 'wrkjob-locks',
    openFiles: 'wrkjob-open-files',
    spools: 'wrkjob-spools',
    joblog: 'joblog-table'
  } as const;

  // Column definitions live at namespace scope so the full render and the incremental
  // updates share them: if the two ever disagree, the patched rows stop lining up with the
  // header still on screen.

  const stackColumns = (): FastTableColumn<StackEntry>[] => [
    { title: vscode.l10n.t("Position"), width: "0.5fr", getValue: e => String(e.position) },
    { title: vscode.l10n.t("Program"), width: "2fr", getValue: e => e.program },
    { title: vscode.l10n.t("Statement"), width: "1fr", getValue: e => String(e.statement) },
    { title: vscode.l10n.t("Procedure"), width: "2fr", getValue: e => e.procedure }
  ];

  const libraryColumns = (): FastTableColumn<LibraryEntry>[] => [
    { title: vscode.l10n.t("Library"), width: "1.5fr", getValue: e => e.library },
    { title: vscode.l10n.t("Type"), width: "0.7fr", getValue: e => e.type },
    { title: vscode.l10n.t("ASP"), width: "1fr", getValue: e => e.asp },
    { title: vscode.l10n.t("Description"), width: "3fr", getValue: e => e.description }
  ];

  const lockColumns = (): FastTableColumn<LockEntry>[] => [
    { title: vscode.l10n.t("Object"), width: "2fr", getValue: e => e.object },
    { title: vscode.l10n.t("Type"), width: "1fr", getValue: e => e.type },
    { title: vscode.l10n.t("State"), width: "1fr", getValue: e => e.state },
    { title: vscode.l10n.t("Status"), width: "1fr", getValue: e => e.status },
    { title: vscode.l10n.t("Scope"), width: "1fr", getValue: e => e.scope },
    { title: vscode.l10n.t("Member Lock"), width: "1fr", getValue: e => e.memberLock }
  ];

  const fileColumns = (): FastTableColumn<OpenFileEntry>[] => [
    { title: vscode.l10n.t("File"), width: "2fr", getValue: e => e.file },
    { title: vscode.l10n.t("Member"), width: "1fr", getValue: e => e.member },
    { title: vscode.l10n.t("Type"), width: "1fr", getValue: e => e.type },
    { title: vscode.l10n.t("Option"), width: "1fr", getValue: e => e.option },
    { title: vscode.l10n.t("Shared"), width: "0.5fr", getValue: e => String(e.sharedOpens) },
    { title: vscode.l10n.t("Writes"), width: "0.5fr", getValue: e => String(e.writeCount) },
    { title: vscode.l10n.t("Reads"), width: "0.5fr", getValue: e => String(e.readCount) }
  ];

  const activationGroupColumns = (): FastTableColumn<ActivationGroupEntry>[] => [
    { title: vscode.l10n.t("Group"), width: "1.5fr", getValue: e => e.group },
    { title: vscode.l10n.t("Number"), width: "0.7fr", getValue: e => String(e.number) },
    { title: vscode.l10n.t("State"), width: "0.8fr", getValue: e => e.state },
    { title: vscode.l10n.t("Library"), width: "1fr", getValue: e => e.library },
    { title: vscode.l10n.t("Program"), width: "1fr", getValue: e => e.program },
    { title: vscode.l10n.t("Type"), width: "0.8fr", getValue: e => e.programType },
    { title: vscode.l10n.t("In Use"), width: "0.8fr", getValue: e => e.inUse }
  ];

  const spoolColumns = (): FastTableColumn<SpoolEntry>[] => [
    { title: vscode.l10n.t("Name"), width: "1fr", getValue: e => e.spoolname },
    { title: vscode.l10n.t("User Data"), width: "1fr", getValue: e => e.userdata },
    { title: vscode.l10n.t("Status"), width: "0.7fr", getValue: e => e.status },
    { title: vscode.l10n.t("Pages"), width: "0.5fr", getValue: e => String(e.pages) },
    { title: vscode.l10n.t("Timestamp"), width: "1.2fr", getValue: e => e.timestamp },
    {
      title: vscode.l10n.t("Actions"),
      width: "1.5fr",
      getValue: e => {
        const arg = encodeURIComponent(JSON.stringify(e));
        return `<vscode-button appearance="primary" href="action:openSpool?entry=${arg}">${vscode.l10n.t("Open")}</vscode-button>
                    <vscode-button appearance="primary" href="action:genPdf?entry=${arg}">${vscode.l10n.t("Download")}</vscode-button>
                    <vscode-button appearance="secondary" href="action:delSpool?entry=${arg}">${vscode.l10n.t("Delete")}</vscode-button>`;
      }
    }
  ];

  const joblogColumns = (): FastTableColumn<JoblogEntry>[] => [
    { title: vscode.l10n.t("MSGID"), width: "0.7fr", getValue: e => e.msgid },
    { title: vscode.l10n.t("Message"), width: "2fr", getValue: e => e.msgtext },
    { title: vscode.l10n.t("Second Level"), width: "0.3fr", getValue: e => e.msgtext2.replaceAll('&N','\n').replaceAll('&B','\n\t').replaceAll('&P','\n\t'), collapsible: true },
    { title: vscode.l10n.t("Sev."), width: "0.3fr", getValue: e => String(e.severity) },
    { title: vscode.l10n.t("From Program"), width: "1.5fr", getValue: e => e.fromProgram },
    { title: vscode.l10n.t("Timestamp"), width: "1.2fr", getValue: e => e.timestamp }
  ];

  /**
   * Register Work with Job commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    // Register the static refresh command once
    context.subscriptions.push(
      vscode.commands.registerCommand('vscode-ibmi-fs.refreshWrkjob', async () => {
        if (currentActivePanel) {
          const panelInfo = activePanels.get(currentActivePanel);
          if (panelInfo) {
            await panelInfo.refreshFn();
            return;
          }
        }
        vscode.window.showWarningMessage(vscode.l10n.t("No active job view found to refresh"));
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrkjob", async (jobName?: string) => {
        if (!jobName) {
          const ibmi = getInstance();
          const connection = ibmi?.getConnection();
          if (!connection) {
            throw new Error(vscode.l10n.t("Not connected to IBM i"));
          }

          const thejob = await executeSqlIfExists(
            connection,
            `select JOB_NAME AS JOBNAME from table(qsys2.active_job_info(job_name_filter => '*', detailed_info => 'NONE'))`,
            'QSYS2',
            'ACTIVE_JOB_INFO',
            'FUNCTION'
          );

          if (thejob === null) {
            vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "ACTIVE_JOB_INFO"));
            return;
          }

          // Prompt user for job name if not provided
          jobName = await vscode.window.showInputBox({
            placeHolder: vscode.l10n.t("000000/USER/MYJOB"),
            title: vscode.l10n.t("Enter job name (number/user/name)"),
            value: thejob[0].JOBNAME,
            validateInput: (value) => {
              const parts = value.split('/');
              if (parts.length !== 3) {
                return vscode.l10n.t("Job name must be in format: number/user/name");
              }
            }
          });
        }
        
        if (jobName) {
          return openWrkjobWebview(jobName);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.showWrkjobActions", async () => {
        // Use the currentActivePanel to get the job name
        let jobName: string | undefined = currentActivePanel;
        
        if (!jobName) {
          vscode.window.showErrorMessage(vscode.l10n.t("No active job view found"));
          return;
        }
        
        // Fetch current job info to determine available actions
        const ibmi = getInstance();
        const connection = ibmi?.getConnection();
        
        if (!connection) {
          vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
          return;
        }
        
        try {
          const jobInfo = await fetchJobInfo(jobName);
          if (!jobInfo || jobInfo.length === 0) {
            vscode.window.showErrorMessage(vscode.l10n.t("Unable to retrieve job information"));
            return;
          }
          
          const jobStatus = jobInfo[0].JOB_STATUS;
          const activeStatus = jobInfo[0].ACTIVE_STATUS;
          
          // Build action list based on job status
          const actions: vscode.QuickPickItem[] = [];
          
          if (jobStatus === 'ACTIVE' && activeStatus==='HLD') {
            actions.push({
              label: vscode.l10n.t("$(play) Release Job"),
            });
          } else if (jobStatus === 'ACTIVE' && activeStatus!=='HLD') {
            actions.push({
              label: vscode.l10n.t("$(debug-pause) Hold Job"),
            });
          }
          
          if (jobStatus !== 'OUTQ') {
            actions.push({
              label: vscode.l10n.t("$(close) End Job"),
            });
          }
          
          // Add debug action for active jobs
          if (jobStatus === 'ACTIVE') {
            actions.push({
              label: vscode.l10n.t("$(debug-alt) Debug Job"),
            });
          }
          
          if (actions.length === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t("No actions available for job {0} (status: {1})", jobName, jobStatus));
            return;
          }
          
          // Show quick pick menu
          const selected = await vscode.window.showQuickPick(actions, {
            placeHolder: vscode.l10n.t("Select an action for job {0}", jobName),
            title: vscode.l10n.t("Job Actions")
          });
          
          if (!selected) {
            return;
          }
          
          // Execute the selected action
          let success = false;
          if (selected.label.includes("Hold")) {
            success = await JobOperations.holdJob({ job: jobName });
          } else if (selected.label.includes("Release")) {
            success = await JobOperations.releaseJob({ job: jobName });
          } else if (selected.label.includes("End")) {
            success = await JobOperations.endJob({ job: jobName });
          } else if (selected.label.includes("Debug")) {
            success = await JobOperations.debugJob({ job: jobName });
          }
          
          // Refresh the webview if action was successful (except for debug)
          if (success && !selected.label.includes("Debug")) {
            await vscode.commands.executeCommand('vscode-ibmi-fs.refreshWrkjob');
          }
        } catch (error) {
          vscode.window.showErrorMessage(vscode.l10n.t("Error executing job action: {0}", String(error)));
        }
      })
    );
  };

  /**
   * Interface representing a library list entry
   */
  interface LibraryEntry {
    /** Library name */
    library: string;
    /** Library type (SYS, CUR, USR) */
    type: string;
    /** ASP name (optional) */
    asp: string;
    /** Library description */
    description: string;
  }

  /**
   * Interface representing a call stack entry
   */
  interface StackEntry {
    /** Ordinal position in stack */
    position: number;
    /** Program name (library/program) */
    program: string;
    /** Statement identifier */
    statement: number;
    /** Procedure name */
    procedure: string;
  }

  /**
   * Interface representing a lock entry
   */
  interface LockEntry {
    /** Object name (library/object) */
    object: string;
    /** Object type */
    type: string;
    /** Lock state */
    state: string;
    /** Lock status */
    status: string;
    /** Lock scope */
    scope: string;
    /** Member lock type */
    memberLock: string;
  }

  /**
   * Interface representing an open file entry
   */
  interface OpenFileEntry {
    /** File name (library/file) */
    file: string;
    /** Member name */
    member: string;
    /** File type */
    type: string;
    /** Open option */
    option: string;
    /** Shared opens count */
    sharedOpens: number;
    /** Write count */
    writeCount: number;
    /** Read count */
    readCount: number;
    /** Write/Read count */
    writeReadCount: number;
    /** Other I/O count */
    otherIoCount: number;
    /** Relative record number */
    relativeRecord: number;
  }

  /**
   * Interface representing an activation group entry
   */
  interface ActivationGroupEntry {
    /** Activation group name */
    group: string;
    /** Activation group number */
    number: number;
    /** Group state */
    state: string;
    /** Program library */
    library: string;
    /** Program name */
    program: string;
    /** Program type */
    programType: string;
    /** In-use indicator */
    inUse: string;
  }

  /**
   * Interface representing a spool file entry
   */
  interface SpoolEntry {
    /** Creation timestamp */
    timestamp: string;
    /** Spooled file name */
    spoolname: string;
    /** User name */
    username: string;
    /** User data */
    userdata: string;
    /** Status */
    status: string;
    /** Size */
    size: number;
    /** Total pages */
    pages: number;
    /** Job name */
    job: string;
    /** File number */
    nbr: number;
  }

  /**
   * Interface representing a joblog message entry
   */
  interface JoblogEntry {
    /** Message ID */
    msgid: string;
    /** Message text */
    msgtext: string;
    /** Second level text */
    msgtext2: string;
    /** Severity */
    severity: number;
    /** From program (library/program) */
    fromProgram: string;
    /** Message file (library/file) */
    msgFile: string;
    /** Timestamp */
    timestamp: string;
  }

  /**
   * Fetch job information
   */
  const fetchJobInfo = async (jobName: string): Promise<any> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    // Parse job name
    const parts = jobName.split('/');
    const jobNumber = parts[0];
    const jobUser = parts[1];
    const jobNameOnly = parts[2];

    // Check if job exists
    const jobExists = await executeSqlIfExists(
      connection,
      `SELECT COUNT(*) as CNT
       FROM TABLE(QSYS2.JOB_INFO(JOB_STATUS_FILTER => '*ALL', 
                                   JOB_USER_FILTER => '${jobUser}', 
                                   JOB_NAME_FILTER => '${jobNameOnly}'))
       WHERE JOB_NAME = '${jobName}'`,
      'QSYS2',
      'JOB_INFO',
      'FUNCTION'
    );

    if (jobExists === null || jobExists.length === 0 || Number(jobExists[0].CNT) === 0) {
      vscode.window.showErrorMessage(vscode.l10n.t("Job {0} not found", jobName));
      return null;
    }

    // Fetch job info
    const jobInfo = await executeSqlIfExists(
      connection,
      `SELECT P.JOB_STATUS,
       X.JOB_STATUS AS ACTIVE_STATUS,
       X.FUNCTION_TYPE CONCAT '-' CONCAT X."FUNCTION" AS "FUNCTION",
       P.JOB_TYPE,
       P.JOB_SUBSYSTEM,
       P.JOB_DESCRIPTION_LIBRARY CONCAT '/' CONCAT P.JOB_DESCRIPTION AS JOB_DESCRIPTION,
       P.SUBMITTER_JOB_NAME,
       TO_CHAR(P.JOB_ENTERED_SYSTEM_TIME, 'yyyy-mm-dd HH24:mi') AS JOB_ENTERED_SYSTEM_TIME,
       TO_CHAR(P.JOB_SCHEDULED_TIME, 'yyyy-mm-dd HH24:mi') AS JOB_SCHEDULED_TIME,
       TO_CHAR(P.JOB_ACTIVE_TIME, 'yyyy-mm-dd HH24:mi') AS JOB_ACTIVE_TIME,
       TO_CHAR(P.JOB_END_TIME, 'yyyy-mm-dd HH24:mi') AS JOB_END_TIME,
       P.JOB_END_SEVERITY,
       P.COMPLETION_STATUS,
       P.JOB_QUEUE_LIBRARY CONCAT '/' CONCAT JOB_QUEUE_NAME AS JOB_QUEUE_NAME,
       P.ALLOW_MULTIPLE_THREADS,
       P.PEAK_TEMPORARY_STORAGE,
       P.DEFAULT_WAIT,
       P.MAXIMUM_PROCESSING_TIME_ALLOWED,
       P.MAXIMUM_TEMPORARY_STORAGE_ALLOWED,
       P."CCSID",
       P.CHARACTER_IDENTIFIER_CONTROL,
       P.DATE_FORMAT,
       P.DATE_SEPARATOR,
       P.TIME_SEPARATOR,
       P.DECIMAL_FORMAT,
       MESSAGE_LOGGING_LEVEL CONCAT ' ' CONCAT MESSAGE_LOGGING_SEVERITY CONCAT ' ' CONCAT MESSAGE_LOGGING_TEXT
           AS MESSAGE_LOGGING_LEVEL,
       INQUIRY_MESSAGE_REPLY,
       SPOOLED_FILE_ACTION,
       TEMPORARY_STORAGE,
        ELAPSED_CPU_PERCENTAGE,
        ELAPSED_TOTAL_DISK_IO_COUNT,
        CPU_TIME,
        TOTAL_DISK_IO_COUNT
       FROM TABLE(QSYS2.JOB_INFO(JOB_STATUS_FILTER => '*ALL', 
                                  JOB_USER_FILTER => '${jobUser}', 
                                  JOB_NAME_FILTER => '${jobNameOnly}')) p
       LEFT JOIN TABLE (
            QSYS2.ACTIVE_JOB_INFO(JOB_NAME_FILTER => '${jobNameOnly}', 
                                  CURRENT_USER_LIST_FILTER => '${jobUser}', 
                                  DETAILED_INFO => 'NONE', RESET_STATISTICS => 'NO')
             ) X
             ON X.JOB_NAME = P.JOB_NAME
       WHERE P.JOB_NAME = '${jobName}'`,
      'QSYS2',
      'JOB_INFO',
      'FUNCTION'
    );

    if (jobInfo === null) {
      vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "JOB_INFO"));
      return null;
    }

    return jobInfo;
  };

  /**
   * Fetch call stack
   */
  const fetchCallStack = async (jobName: string): Promise<StackEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      return [];
    }

    const stackRows = await executeSqlIfExists(
      connection,
      `SELECT ORDINAL_POSITION,
         PROGRAM_LIBRARY_NAME CONCAT '/' CONCAT PROGRAM_NAME AS PROGRAM_NAME,
         INT(STATEMENT_IDENTIFIERS) AS STATEMENT_IDENTIFIERS,
         PROCEDURE_NAME
       FROM TABLE(QSYS2.STACK_INFO('${jobName}'))
       WHERE ENTRY_TYPE <> 'LIC'`,
      'QSYS2',
      'STACK_INFO',
      'FUNCTION'
    );

    if (stackRows === null) {
      return [];
    }

    return stackRows.map((row: Tools.DB2Row): StackEntry => ({
      position: Number(row.ORDINAL_POSITION),
      program: String(row.PROGRAM_NAME),
      statement: Number(row.STATEMENT_IDENTIFIERS),
      procedure: String(row.PROCEDURE_NAME)
    }));
  };

  /**
   * Fetch library list
   */
  const fetchLibl = async (jobName: string): Promise<LibraryEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      return [];
    }

    const liblspl = await connection.runCommand({
      command: `QSYS/DSPJOB JOB(${jobName}) OPTION(*LIBL)`,
      environment: `ile`,
      getSpooledFiles:true,
    });

    if (!liblspl || !liblspl.stdout) {
      return [];
    }

    // Parse library list from spool output
    // The output has fixed-width columns, so we parse by position
    const lines = liblspl.stdout.split('\n');
    const libraries: LibraryEntry[] = [];
    
  for (const line of lines) {
      
      // Extract fields by position (fixed-width columns)
      const library = line.substring(3, 13).trim();
      const type = line.substring(15, 18).trim();
      const asp = line.substring(26, 36).trim();
      const description = line.substring(38, 90).trim();
      
      // Skip if library name is empty or starts with * (separator lines)
      if (!library || library.startsWith('*')) {
        continue;
      }
      
      // Only include valid library types
      if (type === 'SYS' || type === 'CUR' || type === 'USR') {
        libraries.push({
          library: library,
          type: type,
          asp: asp,
          description: description
        });
      }
    }

    return libraries;
  };

  /**
   * Fetch locks
   */
  const fetchLocks = async (jobName: string): Promise<LockEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      return [];
    }

    const lockRows = await executeSqlIfExists(
      connection,
      `SELECT OBJECT_LIBRARY CONCAT '/' CONCAT OBJECT_NAME AS OBJECT_NAME,
         OBJECT_TYPE,
         LOCK_STATE,
         LOCK_STATUS,
         LOCK_SCOPE,
         MEMBER_LOCK_TYPE
       FROM TABLE(QSYS2.JOB_LOCK_INFO('${jobName}'))`,
      'QSYS2',
      'JOB_LOCK_INFO',
      'FUNCTION'
    );

    if (lockRows === null) {
      return [];
    }

    return lockRows.map((row: Tools.DB2Row): LockEntry => ({
      object: String(row.OBJECT_NAME),
      type: String(row.OBJECT_TYPE),
      state: String(row.LOCK_STATE),
      status: String(row.LOCK_STATUS),
      scope: String(row.LOCK_SCOPE),
      memberLock: String(row.MEMBER_LOCK_TYPE)
    }));
  };

  /**
   * Fetch open files
   */
  const fetchOpenFiles = async (jobName: string): Promise<OpenFileEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      return [];
    }

    const fileRows = await executeSqlIfExists(
      connection,
      `SELECT LIBRARY_NAME CONCAT '/' CONCAT FILE_NAME AS FILE_NAME,
         MEMBER_NAME,
         FILE_TYPE,
         OPEN_OPTION,
         SHARED_OPENS,
         WRITE_COUNT,
         READ_COUNT,
         WRITE_READ_COUNT,
         OTHER_IO_COUNT,
         RELATIVE_RECORD_NUMBER
       FROM TABLE(QSYS2.OPEN_FILES('${jobName}'))`,
      'QSYS2',
      'OPEN_FILES',
      'FUNCTION'
    );

    if (fileRows === null) {
      return [];
    }

    return fileRows.map((row: Tools.DB2Row): OpenFileEntry => ({
      file: String(row.FILE_NAME),
      member: String(row.MEMBER_NAME),
      type: String(row.FILE_TYPE),
      option: String(row.OPEN_OPTION),
      sharedOpens: Number(row.SHARED_OPENS),
      writeCount: Number(row.WRITE_COUNT),
      readCount: Number(row.READ_COUNT),
      writeReadCount: Number(row.WRITE_READ_COUNT),
      otherIoCount: Number(row.OTHER_IO_COUNT),
      relativeRecord: Number(row.RELATIVE_RECORD_NUMBER)
    }));
  };

  /**
   * Fetch activation groups
   */
  const fetchActivationGroups = async (jobName: string): Promise<ActivationGroupEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (!connection) {
      return [];
    }

    const activationGroupRows = await executeSqlIfExists(
      connection,
      `SELECT ACTIVATION_GROUP_NAME AS GROUP_NAME,
         ACTIVATION_GROUP_NUMBER AS GROUP_NUMBER,
         STATE,
         PROGRAM_LIBRARY,
         PROGRAM,
         PROGRAM_TYPE,
         IN_USE
       FROM TABLE(QSYS2.ACTIVATION_GROUP_INFO('${jobName}'))`,
      'QSYS2',
      'ACTIVATION_GROUP_INFO',
      'FUNCTION'
    );

    if (activationGroupRows === null) {
      return [];
    }

    return activationGroupRows.map((row: Tools.DB2Row): ActivationGroupEntry => ({
      group: String(row.GROUP_NAME),
      number: Number(row.GROUP_NUMBER),
      state: String(row.STATE),
      library: String(row.PROGRAM_LIBRARY),
      program: String(row.PROGRAM),
      programType: String(row.PROGRAM_TYPE),
      inUse: String(row.IN_USE)
    }));
  };

  /**
   * Fetch spools
   */
  const fetchSpools = async (jobName: string): Promise<SpoolEntry[]> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      return [];
    }

    const spoolRows = await executeSqlIfExists(
      connection,
      `SELECT TO_CHAR(CREATION_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS CREATE_TIMESTAMP,
         SPOOLED_FILE_NAME,
         JOB_USER AS USER_NAME,
         USER_DATA,
         STATUS,
         SIZE,
         TOTAL_PAGES,
         QUALIFIED_JOB_NAME AS JOB_NAME,
         SPOOLED_FILE_NUMBER AS FILE_NUMBER
       FROM TABLE(QSYS2.SPOOLED_FILE_INFO(JOB_NAME => '${jobName}', USER_NAME => '*ALL'))`,
      'QSYS2',
      'SPOOLED_FILE_INFO',
      'FUNCTION'
    );

    if (spoolRows === null) {
      return [];
    }

    return spoolRows.map((row: Tools.DB2Row): SpoolEntry => ({
      timestamp: String(row.CREATE_TIMESTAMP),
      spoolname: String(row.SPOOLED_FILE_NAME),
      username: String(row.USER_NAME),
      userdata: String(row.USER_DATA),
      status: String(row.STATUS),
      size: Number(row.SIZE),
      pages: Number(row.TOTAL_PAGES),
      job: String(row.JOB_NAME),
      nbr: Number(row.FILE_NUMBER)
    }));
  };

  /**
   * Fetch joblog with server-side search and pagination
   * @param jobName - The job to read the log from
   * @param searchTerm - Optional search filter
   * @param page - Page number (1-based)
   * @param itemsPerPage - Number of messages per page
   * @returns The page of entries plus the total count matching the search
   */
  const fetchJoblog = async (jobName: string, searchTerm: string = '', page: number = 1, itemsPerPage: number = getItemsPerPage()): Promise<{ entries: JoblogEntry[]; total: number }> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (!connection) {
      return { entries: [], total: 0 };
    }

    // Build the search filter (shared between the count and the data query)
    let whereClause = '';
    if (searchTerm && searchTerm.trim() !== '' && searchTerm.trim() !== '-') {
      const searchPattern = `%${searchTerm.trim().toUpperCase()}%`;
      whereClause = ` WHERE (
        UPPER(MESSAGE_ID) LIKE '${searchPattern}' OR
        UPPER(MESSAGE_TEXT) LIKE '${searchPattern}' OR
        UPPER(MESSAGE_SECOND_LEVEL_TEXT) LIKE '${searchPattern}' OR
        UPPER(FROM_LIBRARY CONCAT '/' CONCAT FROM_PROGRAM) LIKE '${searchPattern}'
      )`;
    }

    // Total count for pagination
    const countRows = await executeSqlIfExists(
      connection,
      `SELECT COUNT(*) AS TOTAL FROM TABLE(QSYS2.JOBLOG_INFO('${jobName}'))${whereClause}`,
      'QSYS2',
      'JOBLOG_INFO',
      'FUNCTION'
    );

    if (countRows === null) {
      return { entries: [], total: 0 };
    }

    const total = countRows.length > 0 ? Number(countRows[0].TOTAL) : 0;
    const offset = (page - 1) * itemsPerPage;

    const joblogRows = await executeSqlIfExists(
      connection,
      `SELECT MESSAGE_ID,
         MESSAGE_TEXT,
         MESSAGE_SECOND_LEVEL_TEXT,
         SEVERITY,
         FROM_LIBRARY CONCAT '/' CONCAT FROM_PROGRAM AS FROM_PROGRAM,
         MESSAGE_LIBRARY CONCAT '/' CONCAT MESSAGE_FILE AS MESSAGE_FILE,
         TO_CHAR(MESSAGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS MESSAGE_TIMESTAMP
       FROM TABLE(QSYS2.JOBLOG_INFO('${jobName}'))${whereClause}
       ORDER BY ORDINAL_POSITION DESC
       LIMIT ${itemsPerPage} OFFSET ${offset}`,
      'QSYS2',
      'JOBLOG_INFO',
      'FUNCTION'
    );

    if (joblogRows === null) {
      return { entries: [], total };
    }

    const entries = joblogRows.map((row: Tools.DB2Row): JoblogEntry => ({
      msgid: String(row.MESSAGE_ID),
      msgtext: String(row.MESSAGE_TEXT),
      msgtext2: String(row.MESSAGE_SECOND_LEVEL_TEXT),
      severity: Number(row.SEVERITY),
      fromProgram: String(row.FROM_PROGRAM),
      msgFile: String(row.MESSAGE_FILE),
      timestamp: String(row.MESSAGE_TIMESTAMP)
    }));

    return { entries, total };
  };

  /**
   * Open the Work with Job webview
   */
  const openWrkjobWebview = async (jobName: string): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // Server-side search/pagination state for the Job Log tab
      let joblogSearchTerm = '';
      let joblogPage = 1;
      const joblogItemsPerPage = getItemsPerPage();
      let joblogTotal = 0;

      // Fetch all data
      let jobInfo = await fetchJobInfo(jobName);
      if (!jobInfo || jobInfo.length === 0) {
        return false;
      }

      let [callStack, locks, openFiles, spools, joblogResult, libraries, activationGroups] = await Promise.all([
        fetchCallStack(jobName),
        fetchLocks(jobName),
        fetchOpenFiles(jobName),
        fetchSpools(jobName),
        fetchJoblog(jobName, joblogSearchTerm, joblogPage, joblogItemsPerPage),
        fetchLibl(jobName),
        fetchActivationGroups(jobName)
      ]);

      let joblog = joblogResult.entries;
      joblogTotal = joblogResult.total;

      // Define columns for job info manually
      const columns = new Map<string, string>([
        ['JOB_STATUS', vscode.l10n.t('Job Status')],
        ['ACTIVE_STATUS', vscode.l10n.t('Active Status')],
        ['FUNCTION', vscode.l10n.t('Function')],
        ['JOB_TYPE', vscode.l10n.t('Job Type')],
        ['JOB_SUBSYSTEM', vscode.l10n.t('Subsystem')],
        ['JOB_DESCRIPTION', vscode.l10n.t('Job Description')],
        ['SUBMITTER_JOB_NAME', vscode.l10n.t('Submitter Job')],
        ['JOB_ENTERED_SYSTEM_TIME', vscode.l10n.t('Entered System Time')],
        ['JOB_SCHEDULED_TIME', vscode.l10n.t('Scheduled Time')],
        ['JOB_ACTIVE_TIME', vscode.l10n.t('Active Time')],
        ['JOB_END_TIME', vscode.l10n.t('End Time')],
        ['JOB_END_SEVERITY', vscode.l10n.t('End Severity')],
        ['COMPLETION_STATUS', vscode.l10n.t('Completion Status')],
        ['JOB_QUEUE_NAME', vscode.l10n.t('Job Queue')],
        ['ALLOW_MULTIPLE_THREADS', vscode.l10n.t('Allow Multiple Threads')],
        ['PEAK_TEMPORARY_STORAGE', vscode.l10n.t('Peak Temporary Storage')],
        ['DEFAULT_WAIT', vscode.l10n.t('Default Wait')],
        ['MAXIMUM_PROCESSING_TIME_ALLOWED', vscode.l10n.t('Max Processing Time')],
        ['MAXIMUM_TEMPORARY_STORAGE_ALLOWED', vscode.l10n.t('Max Temporary Storage')],
        ['CCSID', vscode.l10n.t('CCSID')],
        ['CHARACTER_IDENTIFIER_CONTROL', vscode.l10n.t('Character ID Control')],
        ['DATE_FORMAT', vscode.l10n.t('Date Format')],
        ['DATE_SEPARATOR', vscode.l10n.t('Date Separator')],
        ['TIME_SEPARATOR', vscode.l10n.t('Time Separator')],
        ['DECIMAL_FORMAT', vscode.l10n.t('Decimal Format')],
        ['MESSAGE_LOGGING_LEVEL', vscode.l10n.t('Message Logging')],
        ['INQUIRY_MESSAGE_REPLY', vscode.l10n.t('Inquiry Message Reply')],
        ['SPOOLED_FILE_ACTION', vscode.l10n.t('Spooled File Action')],
        ['TEMPORARY_STORAGE', vscode.l10n.t('Temp. Stg.')],
        ['ELAPSED_CPU_PERCENTAGE', vscode.l10n.t('Elapsed CPU %')],
        ['ELAPSED_TOTAL_DISK_IO_COUNT', vscode.l10n.t('Elapsed I/O')],
        ['CPU_TIME', vscode.l10n.t('CPU Time')],
        ['TOTAL_DISK_IO_COUNT', vscode.l10n.t('Total I/O')]
      ]);

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrkjobView',
        vscode.l10n.t("Work with Job: {0}", jobName),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Auto-refresh configuration, from `code-for-ibmi.views.autoRefreshInterval`
      const autoRefreshInterval = getAutoRefreshInterval();
      let autoRefreshTimer: NodeJS.Timeout | undefined;

      /**
       * Subtitle text for each table, in one place so a render and an update never disagree
       * on the wording or the counts.
       */
      const subtitles = {
        callStack: () => vscode.l10n.t("Total entries: {0}", String(callStack.length)),
        libraries: () => vscode.l10n.t("Total libraries: {0}", String(libraries.length)),
        locks: () => vscode.l10n.t("Total locks: {0}", String(locks.length)),
        openFiles: () => vscode.l10n.t("Total files: {0}", String(openFiles.length)),
        activationGroups: () => vscode.l10n.t("Total groups: {0}", String(activationGroups.length)),
        spools: () => vscode.l10n.t("Total spools: {0}", String(spools.length)),
        joblog: () => vscode.l10n.t("Total messages: {0}", String(joblogTotal))
      };

      /**
       * Push the freshly fetched rows into the page already on screen, one message per table.
       *
       * Reassigning `webview.html` instead would recreate the search box (taking keyboard
       * focus away mid-typing) and reset the active tab under the user — which on a timer
       * would happen every interval. The Job Info panel is deliberately not part of this:
       * it isn't a table, so it only changes on a full rebuild.
       */
      const postTableUpdates = async () => {
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: libraryColumns(), data: libraries,
          totalItems: libraries.length, currentPage: 1,
          subtitle: subtitles.libraries(), tableId: TABLE_IDS.libraries
        }));
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: activationGroupColumns(), data: activationGroups,
          totalItems: activationGroups.length, currentPage: 1,
          subtitle: subtitles.activationGroups(), tableId: TABLE_IDS.activationGroups
        }));
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: stackColumns(), data: callStack,
          totalItems: callStack.length, currentPage: 1,
          subtitle: subtitles.callStack(), tableId: TABLE_IDS.callStack
        }));
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: lockColumns(), data: locks,
          totalItems: locks.length, currentPage: 1,
          subtitle: subtitles.locks(), tableId: TABLE_IDS.locks
        }));
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: fileColumns(), data: openFiles,
          totalItems: openFiles.length, currentPage: 1,
          subtitle: subtitles.openFiles(), tableId: TABLE_IDS.openFiles
        }));
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: spoolColumns(), data: spools,
          totalItems: spools.length, currentPage: 1,
          subtitle: subtitles.spools(), tableId: TABLE_IDS.spools
        }));
        await postJoblogUpdate();
      };

      /** Patch just the Job Log table — the only one that searches and paginates. */
      const postJoblogUpdate = async () => {
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: joblogColumns(),
          data: joblog,
          totalItems: joblogTotal,
          currentPage: joblogPage,
          subtitle: subtitles.joblog(),
          tableId: TABLE_IDS.joblog
        }));
      };

      // Define refresh function for this panel
      const refreshFunction = async (isAutoRefresh: boolean = false) => {
        const newJobInfo = await fetchJobInfo(jobName);
        const newCallStack = await fetchCallStack(jobName);
        const newLocks = await fetchLocks(jobName);
        const newOpenFiles = await fetchOpenFiles(jobName);
        const newSpools = await fetchSpools(jobName);
        const newJoblog = await fetchJoblog(jobName, joblogSearchTerm, joblogPage, joblogItemsPerPage);
        const newLibraries = await fetchLibl(jobName);
        const newActivationGroups = await fetchActivationGroups(jobName);

        if (newJobInfo && newCallStack && newLocks && newOpenFiles && newSpools && newJoblog) {
          jobInfo = newJobInfo;
          callStack = newCallStack;
          locks = newLocks;
          openFiles = newOpenFiles;
          spools = newSpools;
          joblog = newJoblog.entries;
          joblogTotal = newJoblog.total;
          libraries = newLibraries;
          activationGroups = newActivationGroups;
          await postTableUpdates();
          // Show success message only for manual refresh
          if (!isAutoRefresh) {
            vscode.window.showInformationMessage(vscode.l10n.t('Job information refreshed successfully'));
          }
        }
      };

      // Store the panel and refresh function
      activePanels.set(jobName, { panel, refreshFn: refreshFunction });
      
      // Track when this panel becomes active
      panel.onDidChangeViewState(e => {
        if (e.webviewPanel.active) {
          currentActivePanel = jobName;
        }
      });

      // Set as current active panel immediately
      currentActivePanel = jobName;

      // Start auto-refresh timer
      const startAutoRefresh = () => {
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
        }
        if (autoRefreshInterval <= 0) {
          return;
        }
        autoRefreshTimer = setInterval(async () => {
          try {
            // Check current job status before auto-refresh
            const currentJobInfo = await fetchJobInfo(jobName);
            if (currentJobInfo && currentJobInfo.length > 0) {
              const jobStatus = String(currentJobInfo[0].JOB_STATUS);
              // Only auto-refresh if job status is not OUTQ
              if (jobStatus !== 'OUTQ') {
                await refreshFunction(true);
              }
            }
          } catch (error) {
            console.error('Auto-refresh error:', error);
          }
        }, autoRefreshInterval);
      };

      // Start auto-refresh
      startAutoRefresh();

      // Clean up when panel is disposed
      panel.onDidDispose(() => {
        // Clear auto-refresh timer
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = undefined;
        }
        activePanels.delete(jobName);
        if (currentActivePanel === jobName) {
          currentActivePanel = undefined;
        }
      });

      // Generate HTML content
      const generateContent = () => {
        // Job Info tab with action buttons
        const jobStatus = jobInfo && jobInfo.length > 0 ? String(jobInfo[0].JOB_STATUS) : '';
        
        // Create action buttons based on job status
        let actionButtons = '';
        if (jobStatus === 'HELD') {
          // If job is held, show Release and End buttons
          actionButtons = `
            <div style="margin-top: 16px; display: flex; gap: 8px;">
              <vscode-button appearance="primary" href="action:releaseJob">
                ${vscode.l10n.t("Release Job")}
              </vscode-button>
              <vscode-button appearance="secondary" href="action:endJob">
                ${vscode.l10n.t("End Job")}
              </vscode-button>
            </div>
          `;
        }
        
        const jobInfoHtml = generateDetailTable({
          title: vscode.l10n.t("Job: {0}", jobName),
          subtitle: vscode.l10n.t("Job Information"),
          columns: columns,
          data: jobInfo,
          hideNullValues: true
        }) + actionButtons;

        // Call Stack tab
        const stackHtml = generateFastTable({
          title: vscode.l10n.t("Call Stack"),
          subtitle: subtitles.callStack(),
          columns: stackColumns(),
          data: callStack,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No call stack entries found."),
          tableId: TABLE_IDS.callStack
        });

        // Library List tab
        const libraryHtml = generateFastTable({
          title: vscode.l10n.t("Library List"),
          subtitle: subtitles.libraries(),
          columns: libraryColumns(),
          data: libraries,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No libraries found."),
          tableId: TABLE_IDS.libraries
        });

        // Locks tab
        const lockHtml = generateFastTable({
          title: vscode.l10n.t("Locks"),
          subtitle: subtitles.locks(),
          columns: lockColumns(),
          data: locks,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No locks found."),
          tableId: TABLE_IDS.locks
        });

        // Open Files tab
        const fileHtml = generateFastTable({
          title: vscode.l10n.t("Open Files"),
          subtitle: subtitles.openFiles(),
          columns: fileColumns(),
          data: openFiles,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No open files found."),
          tableId: TABLE_IDS.openFiles
        });

        // Activation groups tab section
        const activationGroupHtml = generateFastTable({
          title: vscode.l10n.t("Activation Groups"),
          subtitle: subtitles.activationGroups(),
          columns: activationGroupColumns(),
          data: activationGroups,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No activation groups found."),
          tableId: TABLE_IDS.activationGroups
        });

        // Spools tab
        const spoolHtml = generateFastTable({
          title: vscode.l10n.t("Spooled Files"),
          subtitle: subtitles.spools(),
          columns: spoolColumns(),
          data: spools,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No spooled files found."),
          tableId: TABLE_IDS.spools
        });

        // Joblog tab
        const joblogHtml = generateFastTable({
          title: vscode.l10n.t("Job Log"),
          subtitle: subtitles.joblog(),
          columns: joblogColumns(),
          data: joblog,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No job log messages found."),
          tableId: TABLE_IDS.joblog,
          enableSearch: true,
          searchPlaceholder: vscode.l10n.t("Search messages..."),
          enablePagination: true,
          itemsPerPage: joblogItemsPerPage,
          totalItems: joblogTotal,
          currentPage: joblogPage,
          searchTerm: joblogSearchTerm
        });

        // Statistics tab (combines library list, call stack, locks, open files, spools)
        const statisticsHtml = `
          ${libraryHtml}
          ${Components.divider()}
          ${activationGroupHtml}
          ${Components.divider()}
          ${stackHtml}
          ${Components.divider()}
          ${lockHtml}
          ${Components.divider()}
          ${fileHtml}
          ${Components.divider()}
          ${spoolHtml}
        `;

        // Create panels
        return Components.panels([
          { title: vscode.l10n.t("Job Info"), content: jobInfoHtml },
          { title: vscode.l10n.t("Job Statistics"), content: statisticsHtml },
          { title: vscode.l10n.t("Job Log"), content: joblogHtml, badge: joblogTotal }
        ]);
      };

      panel.webview.html = generatePage(generateContent());

      // Handle messages from webview
      panel.webview.onDidReceiveMessage(async (message) => {
        // Handle Job Log search / pagination (server-side)
        if (message.command === 'search' || message.command === 'paginate') {
          if (message.searchTerm !== undefined) {
            joblogSearchTerm = message.searchTerm;
          }
          if (message.command === 'search') {
            joblogPage = 1;
          } else if (message.page !== undefined) {
            joblogPage = Number(message.page);
          }

          // The page size deliberately isn't taken from the message: the webview echoes back
          // the value baked into it when it was rendered, so honouring it would undo a change
          // to `code-for-ibmi.tables.itemsPerPage` made while the tab was open.
          try {
            const result = await fetchJoblog(jobName, joblogSearchTerm, joblogPage, joblogItemsPerPage);
            joblog = result.entries;
            joblogTotal = result.total;
            await postJoblogUpdate();
          } catch (error) {
            // The webview spins its busy indicator until an answer arrives, so a failed query
            // must still be answered — otherwise it spins until its own safety timeout.
            console.error(`Job log ${message.command} error:`, error);
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to load job log: {0}", String(error)));
            await panel.webview.postMessage({ command: 'updateTableFailed', tableId: TABLE_IDS.joblog });
          }
          return;
        }

        const href = message.href;
        if (!href) {
          return;
        }

        const uri = vscode.Uri.parse(href);
        const params = new URLSearchParams(uri.query);
        
        let refetch = false;
        // Acting on the job itself changes the Job Info panel too — its status fields and the
        // Hold/Release buttons that are drawn from that status. That panel isn't a table, so
        // patching rows can't update it and the page has to be rebuilt.
        let jobStateChanged = false;

        switch (uri.path) {
          // Job actions
          case "holdJob":
            if (await JobOperations.holdJob({ job: jobName })) {
              refetch = true;
              jobStateChanged = true;
            }
            break;

          case "releaseJob":
            if (await JobOperations.releaseJob({ job: jobName })) {
              refetch = true;
              jobStateChanged = true;
            }
            break;

          case "endJob":
            if (await JobOperations.endJob({ job: jobName })) {
              refetch = true;
              jobStateChanged = true;
            }
            break;

          // Spool actions
          case "openSpool":
          case "genPdf":
          case "delSpool":
            const entryJson = params.get("entry");
            if (!entryJson) {
              return;
            }

            const entry: SpoolEntry = JSON.parse(decodeURIComponent(entryJson));

            if (uri.path === "openSpool") {
              await SpoolOperations.openSpool({
                spoolname: entry.spoolname,
                nbr: entry.nbr,
                job: entry.job
              });
            } else if (uri.path === "genPdf") {
              await SpoolOperations.downloadSpoolAsPdf({
                spoolname: entry.spoolname,
                nbr: entry.nbr,
                job: entry.job
              }, 'generatedPDF');
            } else if (uri.path === "delSpool") {
              const deleted = await SpoolOperations.deleteSpool({
                spoolname: entry.spoolname,
                nbr: entry.nbr,
                job: entry.job
              });
              
              if (deleted) {
                refetch = true;
              }
            }
            break;
        }

        // Refresh the view if needed
        if (refetch) {
          const newJobInfo = await fetchJobInfo(jobName);
          const newCallStack = await fetchCallStack(jobName);
          const newLocks = await fetchLocks(jobName);
          const newOpenFiles = await fetchOpenFiles(jobName);
          const newSpools = await fetchSpools(jobName);
          const newJoblog = await fetchJoblog(jobName, joblogSearchTerm, joblogPage, joblogItemsPerPage);
          const newLibraries = await fetchLibl(jobName);
          const newActivationGroups = await fetchActivationGroups(jobName);

          if (newJobInfo && newCallStack && newLocks && newOpenFiles && newSpools && newJoblog) {
            jobInfo = newJobInfo;
            callStack = newCallStack;
            locks = newLocks;
            openFiles = newOpenFiles;
            spools = newSpools;
            joblog = newJoblog.entries;
            joblogTotal = newJoblog.total;
            libraries = newLibraries;
            activationGroups = newActivationGroups;

            if (jobStateChanged) {
              await panel.webview.postMessage({ command: 'saveStateForRestore' });
              await new Promise(resolve => setTimeout(resolve, 100));
              panel.webview.html = generatePage(generateContent());
            } else {
              // Only rows changed (a spooled file was deleted), so patch them in place.
              await postTableUpdates();
            }
          }
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error opening WRKJOB: {0}", String(error)));
      return false;
    }
  };
}