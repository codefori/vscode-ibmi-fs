/**
 * Subsystem Description Management Module
 *
 * This module provides functionality for viewing and managing IBM i Subsystem Descriptions (*SBSD).
 * Subsystems are independent operating environments within IBM i that control how work enters
 * the system and how system resources are allocated to jobs.
 *
 * Key Features:
 * - Display subsystem description information and status
 * - View storage pools configuration
 * - View autostart job entries (AJEs)
 * - View workstation entries (WSEs)
 * - View job queue entries (JOBQEs)
 * - View routing entries (RTGEs)
 * - View prestart job entries (PJEs)
 * - View active jobs in the subsystem (when active)
 * - Start/End subsystem with multiple options
 * - End individual jobs within the subsystem
 *
 * @module subsystemdescription
 */

import { CommandResult, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, getProtected } from "../tools";
import ObjectProvider from '../objectProvider';

export namespace SubsystemActions {
  /**
   * Register Subsystem Description commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.StrSbs", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await strSbs({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return strSbs(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.EndSbs", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await endSbs({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return endSbs(item);
        }
      })
    );
  };

  /**
   * Start a Subsystem
   * Activates an inactive subsystem, allowing it to process work
   * @param item - The Subsystem Description object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const strSbs = async (item: IBMiObject | Sbsd): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(`Unable to perform object action because it is protected.`);
        return false;
      }

      // Check if the subsystem is already active
      let sbsd = await connection.runSQL(
        `SELECT STATUS
          FROM QSYS2.SUBSYSTEM_INFO
          WHERE SUBSYSTEM_DESCRIPTION = '${name}'
            AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${library}'`)
      if(sbsd[0].STATUS === "ACTIVE") {
        vscode.window.showErrorMessage(`Sbsd ${library}/${name} already active`);
        return false;
      }

      if (await vscode.window.showWarningMessage(`Are you sure you want to start ${library}/${name}?`, { modal: true }, "Start SBSD")) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `STRSBS SBSD(${library}/${name})`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Subsystem ${library}/${name} activated.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to start subsystem ${library}/${name}:\n${cmdrun.stderr}`);
          return false;
        }
      }
      else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  };

  /**
   * End a Subsystem
   * Terminates an active subsystem with user-selected option (*IMMED or *CNTRLD)
   * @param item - The Subsystem Description object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const endSbs = async (item: IBMiObject | Sbsd): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(`Unable to perform object action because it is protected.`);
        return false;
      }

      // Check if the subsystem is already inactive
      let sbsd = await connection.runSQL(
        `SELECT STATUS
          FROM QSYS2.SUBSYSTEM_INFO
          WHERE SUBSYSTEM_DESCRIPTION = '${name}'
            AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${library}'`)
      if(sbsd[0].STATUS === "INACTIVE") {
        vscode.window.showErrorMessage(`Sbsd ${library}/${name} already inactive`);
        return false;
      }

      // Ask user to choose end option
      const endOption = await vscode.window.showQuickPick(
        [
          { label: "*IMMED", description: "End immediately", value: "*IMMED" },
          { label: "*CNTRLD", description: "Controlled end (default 30 sec delay)", value: "*CNTRLD" }
        ],
        {
          placeHolder: "Select how to end the subsystem",
          title: `End Subsystem ${library}/${name}`,
          canPickMany: false
        }
      );

      if (endOption) {
        if (await vscode.window.showWarningMessage(`Are you sure you want to end ${library}/${name} with option ${endOption.label}?`, { modal: true }, "End SBSD")) {
          const cmdrun: CommandResult = await connection.runCommand({
            command: `ENDSBS SBS(${name}) OPTION(${endOption.value})`,
            environment: `ile`
          });

          if (cmdrun.code === 0) {
            vscode.window.showInformationMessage(`Subsystem ${library}/${name} ended.`);
            return true;
          } else {
            vscode.window.showErrorMessage(`Unable to end subsystem ${library}/${name}:\n${cmdrun.stderr}`);
            return false;
          }
        } else {
          return false;
        }
      }
      else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  };

  /**
   * End (terminate) an individual job in the subsystem
   * This is a destructive operation that immediately stops the job
   * @param item - The job entry to end
   * @returns True if successful, false otherwise
   */
  export const endJob = async (item: Job): Promise<boolean> => {
    // Show confirmation dialog to prevent accidental termination
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if (await vscode.window.showWarningMessage(`Are you sure you want to end job ${item.job} ?`, { modal: true }, "End job")) {

        // Execute ENDJOB command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `ENDJOB JOB(${item.job}) OPTION(*IMMED)`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Job ended.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to end selected job:\n${cmdrun.stderr}`);
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;    
    }
  };
}

/**
 * Interface representing a generic entry (used for pools and autostart jobs)
 */
interface GenEntry {
  /** First value (Pool ID or Job Description) */
  value1: string
  /** Second value (Pool Name or Autostart Job Name) */
  value2: string
}

/**
 * Interface representing a workstation entry
 */
interface Wse {
  /** Workstation name */
  wsname: string
  /** Workstation type */
  wstype: string
  /** Job description (library/name) */
  jobd: string
  /** Allocation type */
  alloc: string
  /** Maximum active jobs */
  maxact: string
}

/**
 * Interface representing a routing entry
 */
interface Rtge {
  /** Sequence number */
  seq: number
  /** Program name (library/name) */
  pgm: string
  /** Class (library/name) */
  class: string
  /** Maximum steps */
  steps: string
  /** Pool ID */
  poolid: number
  /** Comparison data */
  cmpdta: string
  /** Comparison start position */
  cmpstart: string
}

/**
 * Interface representing a prestart job entry
 */
interface Pje {
  /** Prestart job name */
  pjname: string
  /** Program (library/name) */
  pgm: string
  /** User profile */
  user: string
  /** Job description (library/name) */
  jobd: string
  /** Start jobs */
  start: number
  /** Initial jobs */
  inl: number
  /** Threshold */
  threshold: number
  /** Additional jobs */
  add: number
  /** Maximum jobs */
  maxjobs: string
  /** Maximum uses */
  maxuse: string
  /** Class (library/name) */
  class: string
}

/**
 * Interface representing a job queue entry
 */
interface Jobqe {
  /** Job queue name (library/name) */
  name: string
  /** Job queue status */
  status: string
  /** Sequence number */
  seq: number
  /** Maximum jobs */
  maxjobs: string
  /** Active jobs count */
  act: number
  /** Held jobs count */
  hold: number
  /** Released jobs count */
  rel: number
  /** Scheduled jobs count */
  sched: number
}

/**
 * Interface representing an active job in the subsystem
 */
interface Job {
  /** Job name */
  job: string
  /** User name */
  user: string
  /** Job type */
  type: string
  /** Function */
  function: string
  /** Job status */
  status: string
  /** Temporary storage */
  tmpstg: number
  /** CPU time */
  cpu: number
  /** I/O count */
  io: number
}

/**
 * Subsystem Description (*SBSD) object class
 * Handles display and management of IBM i Subsystem Description information
 */
export class Sbsd extends Base {
  /** List of storage pools */
  private readonly pools: GenEntry[] = [];
  /** List of autostart job entries */
  private readonly ajes: GenEntry[] = [];
  /** List of workstation entries */
  private readonly wses: Wse[] = [];
  /** List of routing entries */
  private readonly rtges: Rtge[] = [];
  /** List of prestart job entries */
  private readonly pjes: Pje[] = [];
  /** List of job queue entries */
  private readonly jobqes: Jobqe[] = [];
  /** List of active jobs (when subsystem is active) */
  private readonly jobs: Job[] = [];
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Subsystem information from database */
  private sbs?: any;


  /**
   * Fetch subsystem information, pools, entries, and active jobs
   */
  async fetch() {
    await this.fetchInfo();
    await this.fetchPools();
    await this.fetchAjes();
    await this.fetchWses();
    await this.fetchPjes();
    await this.fetchRtges();
    
    this.jobqes.length=0;
    this.jobs.length=0;

    if(this.sbs[0].STATUS==='ACTIVE'){
      await this.fetchJobqes();
      await this.fetchJobs();
    }    
  }

  /**
   * Fetch subsystem metadata from IBM i
   * Retrieves comprehensive subsystem details from QSYS2.SUBSYSTEM_INFO catalog
   */
  async fetchInfo() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      this.columns = await getColumns(connection, 'SUBSYSTEM_INFO');

      // Query to get subsystem information
      this.sbs = await connection.runSQL(
        `SELECT STATUS,
            MAXIMUM_ACTIVE_JOBS,
            CURRENT_ACTIVE_JOBS,
            SUBSYSTEM_MONITOR_JOB,
            TEXT_DESCRIPTION,
            CONTROLLING_SUBSYSTEM,
            WORKLOAD_GROUP,
            SIGNON_DEVICE_FILE_LIBRARY,
            SIGNON_DEVICE_FILE,
            SECONDARY_LANGUAGE_LIBRARY,
            IASP_NAME
          FROM QSYS2.SUBSYSTEM_INFO
          WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
                AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'
          Fetch first row only`);
    }
  }

  /**
   * Fetch all storage pools for the subsystem
   * Retrieves pool information from QSYS2.SUBSYSTEM_POOL_INFO catalog
   */
  private async fetchPools() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.pools.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT POOL_ID,
          POOL_NAME
        FROM QSYS2.SUBSYSTEM_POOL_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`);

      this.pools.push(...entryRows.map(toGenEntryPool));
    }
  }

  /**
   * Fetch all autostart job entries for the subsystem
   * Retrieves autostart job information from QSYS2.AUTOSTART_JOB_INFO catalog
   */
  private async fetchAjes() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.ajes.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT AUTOSTART_JOB_NAME,
          JOB_DESCRIPTION_LIBRARY CONCAT '/' CONCAT JOB_DESCRIPTION JOB_DESCRIPTION 
        FROM QSYS2.AUTOSTART_JOB_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`);

      this.ajes.push(...entryRows.map(toGenEntryAje));
    }
  }

  /**
   * Fetch all workstation entries for the subsystem
   * Retrieves workstation information from QSYS2.WORKSTATION_INFO catalog
   */
  private async fetchWses() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.wses.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT WORKSTATION_NAME,
          WORKSTATION_TYPE,
          JOB_DESCRIPTION_LIBRARY concat '/' concat JOB_DESCRIPTION JOB_DESCRIPTION ,
          ALLOCATION,
          MAXIMUM_ACTIVE_JOBS
        FROM QSYS2.WORKSTATION_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`);
      this.wses.push(...entryRows.map(toWse));
    }
  }

  /**
   * Fetch all routing entries for the subsystem
   * Retrieves routing entry information from QSYS2.ROUTING_ENTRY_INFO catalog
   */
  private async fetchRtges() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.rtges.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT SEQUENCE_NUMBER,
          PROGRAM_LIBRARY concat '/' concat PROGRAM_NAME PROGRAM_NAME, 
          CLASS_LIBRARY concat '/' concat CLASS CLASS,
          case when MAXIMUM_STEPS is null then 'NOMAX' else char(MAXIMUM_STEPS) end MAXIMUM_STEPS,
          POOL_ID,
          COMPARISON_DATA,
          COMPARISON_START
        FROM QSYS2.ROUTING_ENTRY_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`);
      this.rtges.push(...entryRows.map(toRtge));
    }
  }

  /**
   * Fetch all prestart job entries for the subsystem
   * Retrieves prestart job information from QSYS2.PRESTART_JOB_INFO catalog
   */
  private async fetchPjes() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.pjes.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT PRESTART_JOB_NAME,
          PRESTART_JOB_PROGRAM_LIBRARY CONCAT '/' CONCAT PRESTART_JOB_PROGRAM PRESTART_JOB_PROGRAM,
          USER_PROFILE,
          JOB_DESCRIPTION_LIBRARY CONCAT '/' CONCAT JOB_DESCRIPTION JOB_DESCRIPTION,
          START_JOBS,
          INITIAL_JOBS,
          THRESHOLD,
          ADDITIONAL_JOBS,
          CASE
              WHEN MAXIMUM_JOBS = -1 THEN 'NOMAX'
              ELSE CHAR(MAXIMUM_JOBS)
          END MAXIMUM_JOBS,
          CASE
              WHEN MAXIMUM_USES = -1 THEN 'NOMAX'
              ELSE CHAR(MAXIMUM_USES)
          END MAXIMUM_USES,
          CLASS_LIBRARY CONCAT '/' CONCAT CLASS CLASS
        FROM QSYS2.PRESTART_JOB_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`);
      this.pjes.push(...entryRows.map(toPje));
    }
  }

  /**
   * Fetch all job queue entries for the subsystem
   * Retrieves job queue information from QSYS2.JOB_QUEUE_INFO catalog
   */
  private async fetchJobqes() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.jobqes.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT JOB_QUEUE_LIBRARY CONCAT '/' CONCAT JOB_QUEUE_NAME JOB_QUEUE_NAME,
          JOB_QUEUE_STATUS,
          SEQUENCE_NUMBER,
          CASE WHEN MAXIMUM_ACTIVE_JOBS =-1 THEN 'NOMAX' ELSE CHAR(MAXIMUM_ACTIVE_JOBS) END MAXIMUM_ACTIVE_JOBS,
          ACTIVE_JOBS,
          HELD_JOBS,
          RELEASED_JOBS,
          SCHEDULED_JOBS
        FROM QSYS2.JOB_QUEUE_INFO
        WHERE SUBSYSTEM_NAME = '${this.name}'
          AND SUBSYSTEM_LIBRARY_NAME = '${this.library}'`);
      this.jobqes.push(...entryRows.map(toJobqe));
    }
  }

  /**
   * Fetch all active jobs in the subsystem
   * Retrieves job information from QSYS2.ACTIVE_JOB_INFO table function
   */
  private async fetchJobs() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.jobs.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT JOB_NAME,
          AUTHORIZATION_NAME,
          JOB_TYPE,
          FUNCTION_TYPE CONCAT '-' CONCAT "FUNCTION" "FUNCTION",
          JOB_STATUS,
          TEMPORARY_STORAGE,
          CPU_TIME,
          TOTAL_DISK_IO_COUNT
        FROM TABLE (
                QSYS2.ACTIVE_JOB_INFO(SUBSYSTEM_LIST_FILTER => '${this.name}', DETAILED_INFO => 'NONE', RESET_STATISTICS => 'YES')
            )
        WHERE JOB_TYPE <> 'SBS'`);
      this.jobs.push(...entryRows.map(toJob));
    }
  }

  /**
   * Generate HTML for the subsystem view with tabs
   * @returns HTML string containing tabbed interface with subsystem details and entries
   */
  generateHTML(): string {
    const panels: Components.Panel[] = [
      { title: "Detail", content: this.renderPgmPanel() },
      { title: "Pools", content: renderPools(this.pools), badge: this.pools.length }
    ];

    if (this.ajes.length > 0) {
      panels.push({ title: "AJEs", badge: this.ajes.length, content: renderAjes(this.ajes) })
    }

    if (this.wses.length > 0) {
      panels.push({ title: "WSEs", badge: this.wses.length, content: renderWses(this.wses) })
    }

    if (this.jobqes.length > 0) {
      panels.push({ title: "JOBQEs", badge: this.jobqes.length, content: renderJobqes(this.jobqes) })
    }

    if (this.rtges.length > 0) {
      panels.push({ title: "RTGEs", badge: this.rtges.length, content: renderRtges(this.rtges) })
    }

    if (this.pjes.length > 0) {
      panels.push({ title: "PJEs", badge: this.pjes.length, content: renderPjes(this.pjes) })
    }

    if (this.sbs[0].STATUS==='ACTIVE') {
      panels.push({ title: "JOBs", badge: this.jobs.length, content: renderJobs(this.jobs) })
    }

    return Components.panels(panels);
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // Parse the action URL to extract action type and parameters
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;  // Flag to determine if data needs to be refetched
    let entryJson;
    const params = new URLSearchParams(uri.query);
    
    // Route to appropriate action handler based on action type
    switch (uri.path) {
      // Individual job actions

      case "endJob":
        // End (terminate) a specific job in the queue
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Job = JSON.parse(decodeURIComponent(entryJson));
          if(await SubsystemActions.endJob(entry)){
            refetch=true;
          }
        }
        break;
    }
    
    // If any action was successful, refetch data to update the UI
    if (refetch) {
      await this.fetch();
    }
    
    // Return result indicating whether the UI should be re-rendered
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for subsystems)
   */
  async save() {
    // Subsystems are read-only in this view
  }

  /**
   * Render the subsystem information panel
   * @returns HTML string for the detail panel
   */
  private renderPgmPanel(): string {
    return generateDetailTable({
      title: `Subsystem Description: ${this.library}/${this.name}`,
      subtitle: `Subsystem Description Information`,
      columns: this.columns,
      data: this.sbs,
      hideNullValues: true
    });
  }
}

/**
 * Convert a database row to a Pool entry object
 * @param row - Database row from QSYS2.SUBSYSTEM_POOL_INFO
 * @returns GenEntry object for pool
 */
function toGenEntryPool(row: Tools.DB2Row): GenEntry {
  return {
    value2: String(row.POOL_NAME),
    value1: String(row.POOL_ID),
  };
}

/**
 * Convert a database row to an Autostart Job Entry object
 * @param row - Database row from QSYS2.AUTOSTART_JOB_INFO
 * @returns GenEntry object for autostart job
 */
function toGenEntryAje(row: Tools.DB2Row): GenEntry {
  return {
    value2: String(row.AUTOSTART_JOB_NAME),
    value1: String(row.JOB_DESCRIPTION),
  };
}

/**
 * Convert a database row to a Workstation Entry object
 * @param row - Database row from QSYS2.WORKSTATION_INFO
 * @returns Wse object
 */
function toWse(row: Tools.DB2Row): Wse {
  return {
    wsname: String(row.WORKSTATION_NAME),
    wstype: String(row.WORKSTATION_TYPE),
    jobd: String(row.JOB_DESCRIPTION),
    alloc: String(row.ALLOCATION),
    maxact: String(row.MAXIMUM_ACTIVE_JOBS),
  };
}

/**
 * Convert a database row to a Routing Entry object
 * @param row - Database row from QSYS2.ROUTING_ENTRY_INFO
 * @returns Rtge object
 */
function toRtge(row: Tools.DB2Row): Rtge {
  return {
    seq: Number(row.SEQUENCE_NUMBER),
    pgm: String(row.PROGRAM_NAME),
    class: String(row.CLASS),
    steps: String(row.MAXIMUM_STEPS),
    poolid: Number(row.POOL_ID),
    cmpdta: String(row.COMPARISON_DATA),
    cmpstart: String(row.COMPARISON_START)
  };
}

/**
 * Convert a database row to a Prestart Job Entry object
 * @param row - Database row from QSYS2.PRESTART_JOB_INFO
 * @returns Pje object
 */
function toPje(row: Tools.DB2Row): Pje {
  return {
    pjname: String(row.PRESTART_JOB_NAME),
    pgm: String(row.PRESTART_JOB_PROGRAM),
    user: String(row.USER_PROFILE),
    jobd: String(row.JOB_DESCRIPTION),
    start: Number(row.START_JOBS),
    inl: Number(row.INITIAL_JOBS),
    threshold: Number(row.THRESHOLD),
    add: Number(row.THRESHOLD),
    maxjobs: String(row.MAXIMUM_JOBS),
    maxuse: String(row.MAXIMUM_USES),
    class: String(row.CLASS),
  };
}

/**
 * Convert a database row to a Job Queue Entry object
 * @param row - Database row from QSYS2.JOB_QUEUE_INFO
 * @returns Jobqe object
 */
function toJobqe(row: Tools.DB2Row): Jobqe {
  return {
    name: String(row.JOB_QUEUE_NAME),
    status: String(row.JOB_QUEUE_STATUS),
    seq: Number(row.SEQUENCE_NUMBER),
    act: Number(row.ACTIVE_JOBS),
    hold: Number(row.HELD_JOBS),
    rel: Number(row.RELEASED_JOBS),
    sched: Number(row.SCHEDULED_JOBS),
    maxjobs: String(row.MAXIMUM_ACTIVE_JOBS),
  };
}

/**
 * Convert a database row to a Job object
 * @param row - Database row from QSYS2.ACTIVE_JOB_INFO
 * @returns Job object
 */
function toJob(row: Tools.DB2Row): Job {
  return {
    job: String(row.JOB_NAME),
    user: String(row.AUTHORIZATION_NAME),
    type: String(row.JOB_TYPE),
    function: String(row.FUNCTION),
    status: String(row.JOB_STATUS),
    tmpstg: Number(row.TEMPORARY_STORAGE),
    cpu: Number(row.CPU_TIME),
    io: Number(row.CPU_TIME)
  };
}

/**
 * Render the pools panel showing storage pools
 * @param data - Array of pool entries
 * @returns HTML string for the pools panel
 */
function renderPools(data: GenEntry[]) {
  const columns: FastTableColumn<GenEntry>[] = [
    { title: "Pool ID", width: "1fr", getValue: e => e.value1 },
    { title: "Pool Name", width: "2fr", getValue: e => e.value2 },
  ];

  return generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No pools for this subsystem.',
    customScript: ""
  })
}

/**
 * Render the autostart job entries panel
 * @param data - Array of autostart job entries
 * @returns HTML string for the AJEs panel
 */
function renderAjes(data: GenEntry[]) {
  const columns: FastTableColumn<GenEntry>[] = [
    { title: "Autostart job", width: "1fr", getValue: e => e.value2 },
    { title: "Job description", width: "2fr", getValue: e => e.value1 },
  ];

  const customStyles = `
    .aje-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="aje-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No AJE for this subsystem.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
}

/**
 * Render the workstation entries panel
 * @param data - Array of workstation entries
 * @returns HTML string for the WSEs panel
 */
function renderWses(data: Wse[]) {
  const columns: FastTableColumn<Wse>[] = [
    { title: "WS name", width: "1fr", getValue: e => e.wsname },
    { title: "WS type", width: "1fr", getValue: e => e.wstype },
    { title: "Jobd", width: "2fr", getValue: e => e.jobd},
    { title: "Allocation", width: "1fr", getValue: e => e.alloc},
    { title: "Max Active jobs", width: "1fr", getValue: e => e.maxact},
  ];
  
  return generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No WSE for this subsystem.',
    customScript: ""
  });
}

/**
 * Render the job queue entries panel
 * @param data - Array of job queue entries
 * @returns HTML string for the JOBQEs panel
 */
function renderJobqes(data: Jobqe[]) {
  const columns: FastTableColumn<Jobqe>[] = [
    { title: "Jobq", width: "1.5fr", getValue: e => e.name },
    { title: "Status", width: "0.7fr", getValue: e => e.status },
    { title: "Sequence", width: "0.5fr", getValue: e => e.seq },
    { title: "Max jobs", width: "0.5fr", getValue: e => e.maxjobs },
    { title: "ACT jobs", width: "0.5fr", getValue: e => e.act },
    { title: "HLD jobs", width: "0.5fr", getValue: e => e.hold },
    { title: "RLS jobs", width: "0.5fr", getValue: e => e.rel },
    { title: "SCD jobs", width: "0.5fr", getValue: e => e.sched },
  ];

  const customStyles = `
    .jobqe-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="jobqe-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No JOBQE for this subsystem.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
}

/**
 * Render the routing entries panel
 * @param data - Array of routing entries
 * @returns HTML string for the RTGEs panel
 */
function renderRtges(data: Rtge[]) {
  const columns: FastTableColumn<Rtge>[] = [
    { title: "Sequence", width: "0.5fr", getValue: e => e.seq },
    { title: "Program", width: "1.5fr", getValue: e => e.pgm },
    { title: "Class", width: "1.5fr", getValue: e => e.class },
    { title: "Step", width: "0.5fr", getValue: e => e.steps },
    { title: "Pool", width: "0.5fr", getValue: e => e.poolid },
    { title: "Comparison start", width: "0.5fr", getValue: e => e.cmpstart },
    { title: "Comparison data", width: "1fr", getValue: e => e.cmpdta },
  ];

  const customStyles = `
    .rtge-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="rtge-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No RTGES for this subsystem.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
}

/**
 * Render the prestart job entries panel
 * @param data - Array of prestart job entries
 * @returns HTML string for the PJEs panel
 */
function renderPjes(data: Pje[]) {
  const columns: FastTableColumn<Pje>[] = [
    { title: "Name", width: "0.7fr", getValue: e => e.pjname },
    { title: "Program", width: "1.5fr", getValue: e => e.pgm },
    { title: "Class", width: "1.5fr", getValue: e => e.class },
    { title: "Jobd", width: "1.5fr", getValue: e => e.jobd },
    { title: "User", width: "0.7fr", getValue: e => e.user },
    { title: "Start", width: "0.3fr", getValue: e => e.start },
    { title: "Initial", width: "0.3fr", getValue: e => e.inl },
    { title: "Threshold", width: "0.3fr", getValue: e => e.threshold },
    { title: "Additional", width: "0.3fr", getValue: e => e.add },
    { title: "Max", width: "0.3fr", getValue: e => e.maxjobs },
    { title: "Reuse", width: "0.3fr", getValue: e => e.maxuse },
  ];

  const customStyles = `
    .pje-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="pje-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No PJES for this subsystem.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
} 

/**
 * Render the active jobs panel
 * @param data - Array of active jobs
 * @returns HTML string for the JOBs panel
 */
function renderJobs(data: Job[]) {
  const columns: FastTableColumn<Job>[] = [
    { title: "Job", width: "1.5fr", getValue: e => e.job },
    { title: "User", width: "0.7fr", getValue: e => e.user },
    { title: "Type", width: "0.5fr", getValue: e => e.type },
    { title: "Function", width: "0.7fr", getValue: e => e.function },
    { title: "Status", width: "0.5fr", getValue: e => e.status },
    { title: "Temp. Stg.", width: "0.5fr", getValue: e => e.tmpstg },
    { title: "CPU", width: "0.5fr", getValue: e => e.cpu },
    { title: "I/O", width: "0.5fr", getValue: e => e.io },
    {
      title: "Actions",
      width: "1fr",
      getValue: e => {
        // Encode job entry as URL parameter for action handlers
        const arg = encodeURIComponent(JSON.stringify(e));
        return `<vscode-button appearance="secondary" href="action:endJob?entry=${arg}">End ❌</vscode-button>`;
      }
    }
  ];

  const customStyles = `
    .job-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="job-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: 'No running jobs for this subsystem.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
} 