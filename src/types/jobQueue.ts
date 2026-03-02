/**
 * Job Queue Management Module
 *
 * This module provides functionality for managing IBM i Job Queues (JOBQ) and their associated jobs.
 * It includes operations for holding, releasing, clearing job queues, and managing individual jobs.
 *
 * Key Features:
 * - Display job queue information and statistics
 * - List all jobs in a queue with their details
 * - Hold/Release/Clear job queues
 * - Hold/Release/End individual jobs
 * - Dynamic UI based on queue and job status
 *
 * @module jobqueue
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { generateDetailTable, getColumns, generateFastTable, FastTableColumn, getProtected, checkTableFunctionExists, checkViewExists, executeSqlIfExists } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

/**
 * Namespace containing actions for Job Queue objects
 */
export namespace JobQueueActions {
  /**
   * Register Job Queue commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.HldJobq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await hldJobq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return hldJobq(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.RlsJobq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await rlsJobq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return rlsJobq(item);
        }
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.ClrJobq", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await clrJobq({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return clrJobq(item);
        }
      })
    );
  };

  /**
   * Hold a Job Queue (prevent jobs from starting)
   * @param item - The Job Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const hldJobq = async (item: IBMiObject | Jobq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      //check if the jobq is already held
      let jobq = await executeSqlIfExists(
        connection,
        `SELECT JOB_QUEUE_STATUS
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${name}' AND JOB_QUEUE_LIBRARY = '${library}'
          Fetch first row only`,
        'QSYS2',
        'JOB_QUEUE_INFO',
        'VIEW'
      );

      if (jobq === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOB_QUEUE_INFO"));
        return false;
      }

      if(jobq[0].JOB_QUEUE_STATUS === "HELD") {
        vscode.window.showErrorMessage(vscode.l10n.t("Jobq {0}/{1} already held", library, name));
        return false;
      }

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to hold Job Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Hold JOBQ"))) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `HLDJOBQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Job Queue {0}/{1} held.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to hold Job Queue {0}/{1}:\n{2}", library, name, cmdrun.stderr));
          return false;
        }
      }
      else {
        return false;
      }
  } else {
    vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
    return false;
  }
  };

  /**
   * Release a Job Queue (allow jobs to start)
   * @param item - The Job Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const rlsJobq = async (item: IBMiObject | Jobq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if(getProtected(connection,item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      //check if the jobq is already released
      let jobq = await executeSqlIfExists(
        connection,
        `SELECT JOB_QUEUE_STATUS
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${name}' AND JOB_QUEUE_LIBRARY = '${library}'
          Fetch first row only`,
        'QSYS2',
        'JOB_QUEUE_INFO',
        'VIEW'
      );

      if (jobq === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOB_QUEUE_INFO"));
        return false;
      }

      if(jobq[0].JOB_QUEUE_STATUS !== "HELD") {
        vscode.window.showErrorMessage(vscode.l10n.t("Jobq {0}/{1} not held", library, name));
        return false;
      }
      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to release Job Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Release JOBQ"))) {
          const cmdrun: CommandResult = await connection.runCommand({
            command: `RLSJOBQ ${library}/${name}`,
            environment: `ile`
          });

          if (cmdrun.code === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t("Job Queue {0}/{1} released.", library, name));
            return true;
          } else {
            vscode.window.showErrorMessage(vscode.l10n.t("Unable to release Job Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
            return false;
          }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Clear all jobs from a Job Queue
   * @param item - The Job Queue object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const clrJobq = async (item: IBMiObject | Jobq): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection,library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to clear Job Queue {0}/{1}?", library, name), { modal: true }, vscode.l10n.t("Clear JOBQ"))) {
        const cmdrun: CommandResult = await connection.runCommand({
          command: `CLRJOBQ ${library}/${name}`,
          environment: `ile`
        });

        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Job Queue {0}/{1} cleared.", library, name));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to clear Job Queue {0}/{1}:\n{2}", library, name, String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Hold an individual job in the queue
   * Prevents the job from executing until it is released
   * @param item - The job entry to hold
   * @returns True if successful, false otherwise
   */
  export const hldJob = async (item: Entry): Promise<boolean> => {
    // Show confirmation dialog to prevent accidental holds
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to hold job {0} ?", item.job), { modal: true }, vscode.l10n.t("Hold job"))) {
        // Execute HLDJOB command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `HLDJOB JOB(${item.job})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Job held."));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to hold selected job:\n{0}", String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      } 
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Release an individual job in the queue
   * Allows a previously held job to execute
   * @param item - The job entry to release
   * @returns True if successful, false otherwise
   */
  export const rlsJob = async (item: Entry): Promise<boolean> => {
    // Show confirmation dialog
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to release job {0} ?", item.job), { modal: true }, vscode.l10n.t("Release job"))) {

          // Execute RLSJOB command on IBM i
          const cmdrun: CommandResult = await connection.runCommand({
            command: `RLSJOB JOB(${item.job})`,
            environment: `ile`
          });

          // Check command execution result
          if (cmdrun.code === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t("Job released."));
            return true;
          } else {
            vscode.window.showErrorMessage(vscode.l10n.t("Unable to release selected job:\n{0}", String(cmdrun.stderr)));
            return false;
          }
        } else {
          return false;
        }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * End (terminate) an individual job in the queue
   * This is a destructive operation that stops the job
   * @param item - The job entry to end
   * @returns True if successful, false otherwise
   */
  export const endJob = async (item: Entry): Promise<boolean> => {
    // Show confirmation dialog to prevent accidental termination
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to end job {0} ?", item.job), { modal: true }, vscode.l10n.t("End job"))) {

        // Execute ENDJOB command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `ENDJOB JOB(${item.job})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(vscode.l10n.t("Job ended."));
          return true;
        } else {
          vscode.window.showErrorMessage(vscode.l10n.t("Unable to end selected job:\n{0}", String(cmdrun.stderr)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;    
    }
  };
}

/**
 * Interface representing a job entry in the queue
 */
interface Entry {
  /** Job name */
  job: string
  /** Submitter job name */
  submitter: string
  /** Job entered system timestamp */
  jobts: string
  /** Job scheduled timestamp */
  jobscd: string
  /** Job status */
  jobsts: string
}

/**
 * Job Queue (JOBQ) object class
 * Handles display and management of IBM i Job Queues and their jobs
 */
export default class Jobq extends Base {
  /** Job queue information from database */
  private jobq?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Array of job entries in the queue */
  private _entries: Entry[] = [];

  /**
   * Fetch job queue information and jobs
   */
  async fetch() {
    await this.fetchInfo();
    await this.fetchJobs();
  }

  /**
   * Fetch only searchable data (jobs) without reloading queue info
   * This avoids reloading the Detail tab when searching/paginating in the Jobs tab
   */
  async fetchSearchData(): Promise<void> {
    await this.fetchJobs();
  }

  /**
   * Fetch job queue metadata from IBM i
   */
  async fetchInfo(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'JOB_QUEUE_INFO');

      this.jobq = await executeSqlIfExists(
        connection,
        `SELECT JOB_QUEUE_STATUS, NUMBER_OF_JOBS, SUBSYSTEM_LIBRARY_NAME CONCAT '/' CONCAT SUBSYSTEM_NAME AS SUBSYSTEM_NAME, MAXIMUM_ACTIVE_JOBS, ACTIVE_JOBS, HELD_JOBS,
            RELEASED_JOBS, SCHEDULED_JOBS, TEXT_DESCRIPTION
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'
          Fetch first row only`,
        'QSYS2',
        'JOB_QUEUE_INFO',
        'VIEW'
      );

      if (this.jobq === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOB_QUEUE_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch all jobs in the job queue
   * Supports server-side search and pagination
   */
  async fetchJobs(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (connection) {
      // Build WHERE clause with base conditions
      let whereClause = `JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'`;

      // Add search filter if present
      if (this.searchTerm && this.searchTerm.trim() !== '' && this.searchTerm.trim() !== '-') {
        const searchPattern = `%${this.searchTerm.trim().toUpperCase()}%`;
        whereClause += ` AND (
          UPPER(JOB_NAME) LIKE '${searchPattern}' OR
          UPPER(SUBMITTER_JOB_NAME) LIKE '${searchPattern}' OR
          UPPER(JOB_QUEUE_STATUS) LIKE '${searchPattern}'
        )`;
      }

      // Get total count for pagination
      const countRows = await executeSqlIfExists(
        connection,
        `SELECT COUNT(*) as TOTAL FROM SYSTOOLS.JOB_QUEUE_ENTRIES WHERE ${whereClause}`,
        'SYSTOOLS',
        'JOB_QUEUE_ENTRIES',
        'VIEW'
      );

      if (countRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "SYSTOOLS", "JOB_QUEUE_ENTRIES"));
        return;
      }

      this.totalItems = countRows.length > 0 ? Number(countRows[0].TOTAL) : 0;

      // Calculate OFFSET for pagination
      const offset = (this.currentPage - 1) * this.itemsPerPage;

      // Fetch paginated data
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT JOB_NAME,
                SUBMITTER_JOB_NAME,
                to_char(JOB_ENTERED_SYSTEM_TIME, 'yyyy-mm-dd HH24:mi') as JOB_ENTERED_SYSTEM_TIME,
                JOB_QUEUE_STATUS,
                case when JOB_SCHEDULED_TIME is not null then to_char(JOB_SCHEDULED_TIME, 'yyyy-mm-dd HH24:mi') else null end as JOB_SCHEDULED_TIME
            FROM SYSTOOLS.JOB_QUEUE_ENTRIES
            WHERE ${whereClause}
            ORDER BY JOB_ENTERED_SYSTEM_TIME DESC
            LIMIT ${this.itemsPerPage} OFFSET ${offset}`,
        'SYSTOOLS',
        'JOB_QUEUE_ENTRIES',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "SYSTOOLS", "JOB_QUEUE_ENTRIES"));
        return;
      }

      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the job queue view with tabs
   * @returns HTML string
   */
  generateHTML(): string {
    return Components.panels([
      { title: vscode.l10n.t("Detail"), content: this.renderJobQueuePanel() },
      { title: vscode.l10n.t("Jobs"), badge: this.totalItems, content: this.renderEntries(this._entries) }
    ]);
  }

  /**
   * Render the job queue information panel with dynamic actions
   * Actions are conditionally displayed based on the current queue status
   * @returns HTML string for the panel
   * @private
   */
  private renderJobQueuePanel(): string {
    // Generate the detail table with queue information and action buttons
    return generateDetailTable({
      title: `Job Queue: ${this.library}/${this.name}`,
      subtitle: vscode.l10n.t('Job Queue Information'),
      columns: this.columns,
      data: this.jobq
    });
  }

  /**
   * Convert a database row to an Entry object
   * @param row - Database row from SYSTOOLS.JOB_QUEUE_ENTRIES
   * @returns Entry object
   */
  private toEntry(row: Tools.DB2Row): Entry {
    return {
      job: String(row.JOB_NAME),
      submitter: String(row.SUBMITTER_JOB_NAME),
      jobts: String(row.JOB_ENTERED_SYSTEM_TIME),
      jobscd: String(row.JOB_SCHEDULED_TIME),
      jobsts: String(row.JOB_QUEUE_STATUS),
    };
  }

  /**
   * Render the jobs table
   * @param entries - Array of job entries
   * @returns HTML string for the table
   */
  /**
   * Render the jobs table with dynamic action buttons
   * Each job row displays contextual actions based on its current status
   * @param entries - Array of job entries to display
   * @returns HTML string for the table
   */
  renderEntries(entries: Entry[]) {
    // Define table columns with their properties
    const columns: FastTableColumn<Entry>[] = [
      { title: vscode.l10n.t("Job"), width: "1fr", getValue: e => e.job },
      { title: vscode.l10n.t("Submitter job"), width: "1fr", getValue: e => e.submitter },
      { title: vscode.l10n.t("Job entered time"), width: "1fr", getValue: e => e.jobts },
      { title: vscode.l10n.t("Job scheduled time"), width: "1fr", getValue: e => e.jobscd },
      { title: vscode.l10n.t("Job status"), width: "1fr", getValue: e => e.jobsts },
      {
        title: vscode.l10n.t("Actions"),
        width: "1fr",
        getValue: e => {
          // Encode job entry as URL parameter for action handlers
          const arg = encodeURIComponent(JSON.stringify(e));
          
          // Conditionally show Hold or Release button based on job status
          // If job is HELD, show Release button; otherwise show Hold button
          return `${e.jobsts!=='HELD'?`<vscode-button appearance="primary" href="action:hldJob?entry=${arg}">${vscode.l10n.t("Hold")} ⏸️</vscode-button>`:
            `<vscode-button appearance="primary" href="action:rlsJob?entry=${arg}">${vscode.l10n.t("Release")} ▶️</vscode-button>`}
            <vscode-button appearance="secondary" href="action:endJob?entry=${arg}">${vscode.l10n.t("End")} ❌</vscode-button>`;
        }
      }
    ];

    // Custom CSS styles for the job queue entries table
    const customStyles = `
      /* Highlight job names with link color for better visibility */
      .jobqueue-entries-table vscode-table-cell:first-child {
        color: var(--vscode-textLink-foreground);
      }
    `;

    // Generate and return the complete table HTML
    return `<div class="jobqueue-entries-table">` + generateFastTable({
      title: ``,
      subtitle: vscode.l10n.t("Total Jobs: {0}", String(this.totalItems)),
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t('No jobs found in this jobq.'),
      customStyles: customStyles,
      enableSearch: true,
      searchPlaceholder: vscode.l10n.t("Search jobs..."),
      enablePagination: true,
      itemsPerPage: this.itemsPerPage,
      totalItems: this.totalItems,
      currentPage: this.currentPage,
      searchTerm: this.searchTerm
    }) + `</div>`;
  }

  /**
   * Handle user actions from the webview
   * Routes action requests to appropriate handlers and manages UI refresh
   * @param data - Action data from the webview containing href with action type and parameters
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
      case "hldJob":
        // Hold a specific job in the queue
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if(await JobQueueActions.hldJob(entry)){
            refetch=true;
          }
        }
        break;

      case "rlsJob":
        // Release a specific job in the queue
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if(await JobQueueActions.rlsJob(entry)){
            refetch=true;
          }
        }
        break;

      case "endJob":
        // End (terminate) a specific job in the queue
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if(await JobQueueActions.endJob(entry)){
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
   * Save changes (not applicable for job queues)
   * Job queues are managed through IBM i commands, not direct editing
   */
  async save(): Promise<void> {
    // Job queues are read-only in this view
    // All modifications are done through IBM i commands (HLDJOBQ, RLSJOBQ, etc.)
  }
}