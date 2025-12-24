import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { generateDetailTable, getColumns, generateFastTable, FastTableColumn } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_HLD = "hld";
const ACTION_RLS = "rls";
const ACTION_CLR = "clr";

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
      vscode.commands.registerCommand("vscode-ibmi-fs.HldJobq", hldJobq),
      vscode.commands.registerCommand("vscode-ibmi-fs.RlsJobq", rlsJobq),
      vscode.commands.registerCommand("vscode-ibmi-fs.ClrJobq", clrJobq),
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
    if (await vscode.window.showWarningMessage(`Are you sure you want to hold Job Queue ${library}/${name}?`, { modal: true }, "Hold JOBQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const hldjobq: CommandResult = await connection.runCommand({
          command: `HLDJOBQ ${library}/${name}`,
          environment: `ile`
        });

        if (hldjobq.code === 0) {
          vscode.window.showInformationMessage(`Job Queue ${library}/${name} held.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to hold Job Queue ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
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
    if (await vscode.window.showWarningMessage(`Are you sure you want to release Job Queue ${library}/${name}?`, { modal: true }, "Release JOBQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const rlsjobq: CommandResult = await connection.runCommand({
          command: `RLSJOBQ ${library}/${name}`,
          environment: `ile`
        });

        if (rlsjobq.code === 0) {
          vscode.window.showInformationMessage(`Job Queue ${library}/${name} released.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to release Job Queue ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
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
    if (await vscode.window.showWarningMessage(`Are you sure you want to clear Job Queue ${library}/${name}?`, { modal: true }, "Clear JOBQ")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        const clrjobq: CommandResult = await connection.runCommand({
          command: `CLRJOBQ ${library}/${name}`,
          environment: `ile`
        });

        if (clrjobq.code === 0) {
          vscode.window.showInformationMessage(`Job Queue ${library}/${name} cleared.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to clear Job Queue ${library}/${name}`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
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
   * Fetch job queue metadata from IBM i
   */
  async fetchInfo(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection, 'JOB_QUEUE_INFO');

      this.jobq = await connection.runSQL(
        `SELECT JOB_QUEUE_STATUS, NUMBER_OF_JOBS, SUBSYSTEM_NAME, SUBSYSTEM_LIBRARY_NAME, MAXIMUM_ACTIVE_JOBS, ACTIVE_JOBS, HELD_JOBS,
            RELEASED_JOBS, SCHEDULED_JOBS, TEXT_DESCRIPTION
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'
          Fetch first row only`)
    }
  }

  /**
   * Fetch all jobs in the job queue
   */
  async fetchJobs(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      const entryRows = await connection.runSQL(
        `SELECT JOB_NAME,
                SUBMITTER_JOB_NAME,
                to_char(JOB_ENTERED_SYSTEM_TIME, 'yyyy-mm-dd HH24:mi') as JOB_ENTERED_SYSTEM_TIME,
                case when JOB_SCHEDULED_TIME is not null then to_char(JOB_SCHEDULED_TIME, 'yyyy-mm-dd HH24:mi') else null end as JOB_SCHEDULED_TIME
            FROM SYSTOOLS.JOB_QUEUE_ENTRIES
            WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'`)
      this._entries = [];
      this._entries.push(...entryRows.map(this.toEntry));
    }
  }

  /**
   * Generate HTML for the job queue view with tabs
   * @returns HTML string
   */
  generateHTML(): string {
    return Components.panels([
      { title: "Job Queue", content: this.renderJobQueuePanel() },
      { title: "Jobs", badge: this._entries.length, content: this.renderEntries(this._entries) }
    ]);
  }

  /**
   * Render the job queue information panel
   * @returns HTML string for the panel
   */
  private renderJobQueuePanel(): string {
    return generateDetailTable({
      title: `Job Queue: ${this.library}/${this.name}`,
      subtitle: 'Job Queue Information',
      columns: this.columns,
      data: this.jobq,
      actions: [
        {
          label: 'Hold ⏸️',
          action: ACTION_HLD,
          appearance: 'primary',
          style: 'width: 100%; text-align: center;'
        },
        {
          label: 'Release ▶️',
          action: ACTION_RLS,
          appearance: 'primary',
          style: 'width: 100%; text-align: center;'
        },
        {
          label: 'Clear 🧹',
          action: ACTION_CLR,
          appearance: 'secondary',
          style: 'width: 100%; text-align: center;'
        }
      ]
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
    };
  }

  /**
   * Render the jobs table
   * @param entries - Array of job entries
   * @returns HTML string for the table
   */
  renderEntries(entries: Entry[]) {
    const columns: FastTableColumn<Entry>[] = [
      { title: "Job", width: "1fr", getValue: e => e.job },
      { title: "Submitter job", width: "1fr", getValue: e => e.submitter },
      { title: "Job entered time", width: "1fr", getValue: e => e.jobts },
      { title: "Job scheduled time", width: "1fr", getValue: e => e.jobscd },
    ];

    const customStyles = `
      /* Custom styles for cells - specific to jobqueue entries table */
      .jobqueue-entries-table vscode-data-grid-cell[grid-column="1"] {
        color: var(--vscode-textLink-foreground);
      }
    `;

    return `<div class="jobqueue-entries-table">` + generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: this._entries,
      stickyHeader: true,
      emptyMessage: 'No jobs found in this jobq.',
      customStyles: customStyles,
      customScript: ""
    }) + `</div>`;
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;
    switch (uri.path) {
      case ACTION_HLD:
        if (await JobQueueActions.hldJobq(this)) {
          refetch = true;
        }
        break;

      case ACTION_RLS:
        if (await JobQueueActions.rlsJobq(this)) {
          refetch = true;
        }
        break;

      case ACTION_CLR:
        if (await JobQueueActions.clrJobq(this)) {
          refetch = true;
        }
        break;
    }
    if (refetch) {
      await this.fetch();
    }
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for job queues)
   */
  async save(): Promise<void> {
    // Job queues are read-only in this view
  }
}
