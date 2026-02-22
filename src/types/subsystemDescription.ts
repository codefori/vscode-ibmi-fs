/**
 * Subsystem Description Management Module
 *
 * This module provides functionality for viewing and managing IBM i Subsystem Descriptions (*SBSD).
 * Subsystems are independent operating environments within IBM i that control how work enters
 * the system and how system resources are allocated to jobs.
 *
 * Key Features:
 * - Display subsystem description information and status
 * - View memory pools configuration
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
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, getProtected, checkViewExists, checkTableFunctionExists, executeSqlIfExists } from "../tools";
import ObjectProvider from '../objectProvider';
import { t } from '../l10n';

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
        vscode.window.showWarningMessage(t("Unable to perform object action because it is protected."));
        return false;
      }

      // Check if the subsystem is already active
      let sbsd = await executeSqlIfExists(
        connection,
        `SELECT STATUS
          FROM QSYS2.SUBSYSTEM_INFO
          WHERE SUBSYSTEM_DESCRIPTION = '${name}'
            AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${library}'`,
        'QSYS2',
        'SUBSYSTEM_INFO',
        'VIEW'
      );

      if (sbsd === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_INFO"));
        return false;
      }

      if(sbsd[0].STATUS === "ACTIVE") {
        vscode.window.showErrorMessage(t("Sbsd {0}/{1} already active", library, name));
        return false;
      }

      if (await vscode.window.showWarningMessage(t("Are you sure you want to start {0}/{1}?", library, name), { modal: true }, t("Start SBSD"))) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `STRSBS SBSD(${library}/${name})`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(t("Subsystem {0}/{1} activated.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(t("Unable to start subsystem {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
          return false;
        }
      }
      else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
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
        vscode.window.showWarningMessage(t("Unable to perform object action because it is protected."));
        return false;
      }

      // Check if the subsystem is already inactive
      let sbsd = await executeSqlIfExists(
        connection,
        `SELECT STATUS
          FROM QSYS2.SUBSYSTEM_INFO
          WHERE SUBSYSTEM_DESCRIPTION = '${name}'
            AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${library}'`,
        'QSYS2',
        'SUBSYSTEM_INFO',
        'VIEW'
      );

      if (sbsd === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_INFO"));
        return false;
      }

      if(sbsd[0].STATUS === "INACTIVE") {
        vscode.window.showErrorMessage(t("Sbsd {0}/{1} already inactive", library, name));
        return false;
      }

      // Ask user to choose end option
      const endOption = await vscode.window.showQuickPick(
        [
          { label: "*IMMED", description: t("End immediately"), value: "*IMMED" },
          { label: "*CNTRLD", description: t("Controlled end (default 30 sec delay)"), value: "*CNTRLD" }
        ],
        {
          placeHolder: t("Select how to end the subsystem"),
          title: t("End Subsystem {0}/{1}", library, name),
          canPickMany: false
        }
      );

      if (endOption) {
        if (await vscode.window.showWarningMessage(t("Are you sure you want to end {0}/{1} with option {2}?", library, name, endOption.label), { modal: true }, t("End SBSD"))) {
          const cmdrun: CommandResult = await connection.runCommand({
            command: `ENDSBS SBS(${name}) OPTION(${endOption.value})`,
            environment: `ile`
          });

          if (cmdrun.code === 0) {
            vscode.window.showInformationMessage(t("Subsystem {0}/{1} ended.", library, name));
            return true;
          } else {
            vscode.window.showErrorMessage(t("Unable to end subsystem {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
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
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
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
      if (await vscode.window.showWarningMessage(t("Are you sure you want to end job {0} ?", item.job), { modal: true }, t("End job"))) {

        // Execute ENDJOB command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `ENDJOB JOB(${item.job}) OPTION(*IMMED)`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(t("Job ended."));
          return true;
        } else {
          vscode.window.showErrorMessage(t("Unable to end selected job:\n{0}", String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
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
  /** List of memory pools */
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
      this.sbs = await executeSqlIfExists(
        connection,
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
          Fetch first row only`,
        'QSYS2',
        'SUBSYSTEM_INFO',
        'VIEW'
      );

      if (this.sbs === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Fetch all memory pools for the subsystem
   * Retrieves pool information from QSYS2.SUBSYSTEM_POOL_INFO catalog
   */
  private async fetchPools() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.pools.length = 0;
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT POOL_ID,
          POOL_NAME
        FROM QSYS2.SUBSYSTEM_POOL_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`,
        'QSYS2',
        'SUBSYSTEM_POOL_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_POOL_INFO"));
        return;
      }

      this.pools.push(...entryRows.map(toGenEntryPool));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT AUTOSTART_JOB_NAME,
          JOB_DESCRIPTION_LIBRARY CONCAT '/' CONCAT JOB_DESCRIPTION JOB_DESCRIPTION
        FROM QSYS2.AUTOSTART_JOB_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`,
        'QSYS2',
        'AUTOSTART_JOB_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "AUTOSTART_JOB_INFO"));
        return;
      }

      this.ajes.push(...entryRows.map(toGenEntryAje));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT WORKSTATION_NAME,
          WORKSTATION_TYPE,
          JOB_DESCRIPTION_LIBRARY concat '/' concat JOB_DESCRIPTION JOB_DESCRIPTION ,
          ALLOCATION,
          MAXIMUM_ACTIVE_JOBS
        FROM QSYS2.WORKSTATION_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`,
        'QSYS2',
        'WORKSTATION_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "WORKSTATION_INFO"));
        return;
      }
      this.wses.push(...entryRows.map(toWse));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT SEQUENCE_NUMBER,
          PROGRAM_LIBRARY concat '/' concat PROGRAM_NAME PROGRAM_NAME,
          CLASS_LIBRARY concat '/' concat CLASS CLASS,
          case when MAXIMUM_STEPS is null then 'NOMAX' else char(MAXIMUM_STEPS) end MAXIMUM_STEPS,
          POOL_ID,
          COMPARISON_DATA,
          COMPARISON_START
        FROM QSYS2.ROUTING_ENTRY_INFO
        WHERE SUBSYSTEM_DESCRIPTION = '${this.name}'
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`,
        'QSYS2',
        'ROUTING_ENTRY_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "ROUTING_ENTRY_INFO"));
        return;
      }
      this.rtges.push(...entryRows.map(toRtge));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT PRESTART_JOB_NAME,
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
          AND SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}'`,
        'QSYS2',
        'PRESTART_JOB_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "PRESTART_JOB_INFO"));
        return;
      }
      this.pjes.push(...entryRows.map(toPje));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT JOB_QUEUE_LIBRARY CONCAT '/' CONCAT JOB_QUEUE_NAME JOB_QUEUE_NAME,
          JOB_QUEUE_STATUS,
          SEQUENCE_NUMBER,
          CASE WHEN MAXIMUM_ACTIVE_JOBS =-1 THEN 'NOMAX' ELSE CHAR(MAXIMUM_ACTIVE_JOBS) END MAXIMUM_ACTIVE_JOBS,
          ACTIVE_JOBS,
          HELD_JOBS,
          RELEASED_JOBS,
          SCHEDULED_JOBS
        FROM QSYS2.JOB_QUEUE_INFO
        WHERE SUBSYSTEM_NAME = '${this.name}'
          AND SUBSYSTEM_LIBRARY_NAME = '${this.library}'`,
        'QSYS2',
        'JOB_QUEUE_INFO',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOB_QUEUE_INFO"));
        return;
      }
      this.jobqes.push(...entryRows.map(toJobqe));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
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
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT JOB_NAME,
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
        WHERE JOB_TYPE <> 'SBS'`,
        'QSYS2',
        'ACTIVE_JOB_INFO',
        'FUNCTION'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "ACTIVE_JOB_INFO"));
        return;
      }

      this.jobs.push(...entryRows.map(toJob));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the subsystem view with tabs
   * @returns HTML string containing tabbed interface with subsystem details and entries
   */
  generateHTML(): string {
    const panels: Components.Panel[] = [
      { title: t("Detail"), content: this.renderPgmPanel() },
      { title: t("Pools"), content: renderPools(this.pools), badge: this.pools.length }
    ];

    if (this.ajes.length > 0) {
      panels.push({ title: t("AJEs"), badge: this.ajes.length, content: renderAjes(this.ajes) })
    }

    if (this.wses.length > 0) {
      panels.push({ title: t("WSEs"), badge: this.wses.length, content: renderWses(this.wses) })
    }

    if (this.jobqes.length > 0) {
      panels.push({ title: t("JOBQEs"), badge: this.jobqes.length, content: renderJobqes(this.jobqes) })
    }

    if (this.rtges.length > 0) {
      panels.push({ title: t("RTGEs"), badge: this.rtges.length, content: renderRtges(this.rtges) })
    }

    if (this.pjes.length > 0) {
      panels.push({ title: t("PJEs"), badge: this.pjes.length, content: renderPjes(this.pjes) })
    }

    if (this.sbs[0].STATUS==='ACTIVE') {
      panels.push({ title: t("JOBs"), badge: this.jobs.length, content: renderJobs(this.jobs) })
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
      subtitle: t(`Subsystem Description Information`),
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
 * Render the pools panel showing memory pools
 * @param data - Array of pool entries
 * @returns HTML string for the pools panel
 */
function renderPools(data: GenEntry[]) {
  const columns: FastTableColumn<GenEntry>[] = [
    { title: t("Pool ID"), width: "1fr", getValue: e => e.value1 },
    { title: t("Pool Name"), width: "2fr", getValue: e => e.value2 },
  ];

  return generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No pools for this subsystem."),
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
    { title: t("Autostart job"), width: "1fr", getValue: e => e.value2 },
    { title: t("Job description"), width: "2fr", getValue: e => e.value1 },
  ];

  const customStyles = `
    .aje-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="aje-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No AJE for this subsystem."),
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
    { title: t("WS name"), width: "1fr", getValue: e => e.wsname },
    { title: t("WS type"), width: "1fr", getValue: e => e.wstype },
    { title: t("Jobd"), width: "2fr", getValue: e => e.jobd},
    { title: t("Allocation"), width: "1fr", getValue: e => e.alloc},
    { title: t("Max Active jobs"), width: "1fr", getValue: e => e.maxact},
  ];
  
  return generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No WSE for this subsystem."),
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
    { title: t("Jobq"), width: "1.5fr", getValue: e => e.name },
    { title: t("Status"), width: "0.7fr", getValue: e => e.status },
    { title: t("Sequence"), width: "0.5fr", getValue: e => String(e.seq) },
    { title: t("Max jobs"), width: "0.5fr", getValue: e => String(e.maxjobs) },
    { title: t("ACT jobs"), width: "0.5fr", getValue: e => String(e.act) },
    { title: t("HLD jobs"), width: "0.5fr", getValue: e => String(e.hold) },
    { title: t("RLS jobs"), width: "0.5fr", getValue: e => String(e.rel) },
    { title: t("SCD jobs"), width: "0.5fr", getValue: e => String(e.sched) },
  ];

  const customStyles = `
    .jobqe-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="jobqe-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No JOBQE for this subsystem."),
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
    { title: t("Sequence"), width: "0.5fr", getValue: e => String(e.seq) },
    { title: t("Program"), width: "1.5fr", getValue: e => e.pgm },
    { title: t("Class"), width: "1.5fr", getValue: e => e.class },
    { title: t("Step"), width: "0.5fr", getValue: e => String(e.steps) },
    { title: t("Pool"), width: "0.5fr", getValue: e => String(e.poolid) },
    { title: t("Comparison start"), width: "0.5fr", getValue: e => String(e.cmpstart) },
    { title: t("Comparison data"), width: "1fr", getValue: e => e.cmpdta },
  ];

  const customStyles = `
    .rtge-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="rtge-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No RTGES for this subsystem."),
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
    { title: t("Name"), width: "0.7fr", getValue: e => e.pjname },
    { title: t("Program"), width: "1.5fr", getValue: e => e.pgm },
    { title: t("Class"), width: "1.5fr", getValue: e => e.class },
    { title: t("Jobd"), width: "1.5fr", getValue: e => e.jobd },
    { title: t("User"), width: "0.7fr", getValue: e => e.user },
    { title: t("Start"), width: "0.3fr", getValue: e => String(e.start) },
    { title: t("Initial"), width: "0.3fr", getValue: e => String(e.inl) },
    { title: t("Threshold"), width: "0.3fr", getValue: e => String(e.threshold) },
    { title: t("Additional"), width: "0.3fr", getValue: e => String(e.add) },
    { title: t("Max"), width: "0.3fr", getValue: e => String(e.maxjobs) },
    { title: t("Reuse"), width: "0.3fr", getValue: e => String(e.maxuse) },
  ];

  const customStyles = `
    .pje-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="pje-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No PJES for this subsystem."),
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
    { title: t("Job"), width: "1.5fr", getValue: e => e.job },
    { title: t("User"), width: "0.7fr", getValue: e => e.user },
    { title: t("Type"), width: "0.5fr", getValue: e => e.type },
    { title: t("Function"), width: "0.7fr", getValue: e => e.function },
    { title: t("Status"), width: "0.5fr", getValue: e => e.status },
    { title: t("Temp. Stg."), width: "0.5fr", getValue: e => String(e.tmpstg) },
    { title: t("CPU"), width: "0.5fr", getValue: e => String(e.cpu) },
    { title: t("I/O"), width: "0.5fr", getValue: e => String(e.io) },
    {
      title: t("Actions"),
      width: "1fr",
      getValue: e => {
        // Encode job entry as URL parameter for action handlers
        const arg = encodeURIComponent(JSON.stringify(e));
        return `<vscode-button appearance="secondary" href="action:endJob?entry=${arg}">${t("End")} ❌</vscode-button>`;
      }
    }
  ];

  const customStyles = `
    .job-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="job-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: data,
    stickyHeader: true,
    emptyMessage: t("No running jobs for this subsystem."),
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
} 