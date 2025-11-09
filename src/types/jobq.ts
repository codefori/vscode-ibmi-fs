import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { getColumns } from "../tools";
import { generateTableHtml } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

const ACTION_HLD = "hld";
const ACTION_RLS = "rls";
const ACTION_CLR = "clr";

export namespace JobQueueActions {
    export const register = (context: vscode.ExtensionContext) => {
        context.subscriptions.push(
            vscode.commands.registerCommand("vscode-ibmi-fs.HldJobq", hldJobq),
            vscode.commands.registerCommand("vscode-ibmi-fs.RlsJobq", rlsJobq),
            vscode.commands.registerCommand("vscode-ibmi-fs.ClrJobq", clrJobq),
        );
    };

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

interface Entry {
    job: string
    submitter: string
    jobts: string
    jobscd: string
}

export default class Jobq extends Base {
  private jobq?:any;
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  private _entries: Entry[] = [];

  async fetch() {
    await this.fetchInfo();
    await this.fetchJobs();
  }

  async fetchInfo(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection,'JOB_QUEUE_INFO');

      this.jobq = await connection. runSQL(
        `SELECT JOB_QUEUE_NAME, JOB_QUEUE_LIBRARY, JOB_QUEUE_STATUS, NUMBER_OF_JOBS, SUBSYSTEM_NAME, SUBSYSTEM_LIBRARY_NAME, MAXIMUM_ACTIVE_JOBS, ACTIVE_JOBS, HELD_JOBS,
            RELEASED_JOBS, SCHEDULED_JOBS, TEXT_DESCRIPTION
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'
          Fetch first row only`)
    }
  }

  async fetchJobs(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
        const entryRows = await connection. runSQL(
            `SELECT JOB_NAME, SUBMITTER_JOB_NAME, JOB_ENTERED_SYSTEM_TIME, JOB_SCHEDULED_TIME 
            FROM SYSTOOLS.JOB_QUEUE_ENTRIES
            WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'`)
        this._entries=[];
        this._entries.push(...entryRows.map(this.toEntry));
    }
  }

  generateHTML(): string {
      return Components.panels([
          { title: "Job Queue", content: this.renderJobQueuePanel() },
          { title: "Jobs", badge: this._entries.length, content: this.renderEntries(this._entries) }
      ], { style: "height:100vh" });
  }

  private renderJobQueuePanel(): string {

      let html=generateTableHtml(this.columns,this.jobq);
      html=html.trim()+`
          ${Components.divider()}
          </br>
          ${Components.button("Hold ⏸️", { action: ACTION_HLD, style:"width:100%; text-align: center"  })}
          </br>
          ${Components.button("Release ▶️", { action: ACTION_RLS, style:"width:100%; text-align: center"  })}
          </br>
          ${Components.button("Clear 🧹", { action: ACTION_CLR, appearance: "secondary", style:"width:100%; text-align: center" })}`;

      return html;
  }

  private toEntry(row: Tools.DB2Row): Entry {
      return {
          job: String(row.JOB_NAME),
          submitter: String(row.SUBMITTER_JOB_NAME),
          jobts: String(row.JOB_ENTERED_SYSTEM_TIME),
          jobscd: String(row.JOB_SCHEDULED_TIME),
      };
  }

  renderEntries(entries: Entry[]) {
      const columns: Components.Column<Entry>[] = [];
  
      columns.push(
          { title: "Job", size: "1fr", cellValue: e => e.job },
          { title: "Submitter job", size: "1fr", cellValue: e => e.submitter },
          { title: "Job entered time", size: "1fr", cellValue: e => e.jobts },
          { title: "Job scheduled time", size: "1fr", cellValue: e => e.jobscd },
      );
  
      return Components.dataGrid<Entry>({ stickyHeader: true, columns: columns }, entries);
  }

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

  async save(): Promise<void> {
    //Nothing to save
  }
}
