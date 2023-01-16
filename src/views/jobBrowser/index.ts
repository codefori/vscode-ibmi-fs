import * as vscode from 'vscode';
import { JobLog, JobFilter, ActiveJobInfo, SubSystemInfo, JobInfo, JobChange } from '../../typings';
import { JobFilterUI } from "./filters";
import { EndJobUi, HoldJobUi, ReleaseJobUi, ChangeJobUi } from "./job";
import { Code4i } from '../../tools';
import { ConnectionConfiguration } from "../../api/Configuration";

const historyJobUI = require(`../history`);

export class JobBrowserView implements vscode.TreeDataProvider<any> {
  private readonly _emitter: vscode.EventEmitter<JobFilterItem | undefined | null | void> = new vscode.EventEmitter<JobFilterItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<JobFilterItem | undefined | null | void> = this._emitter.event;

  constructor(context: vscode.ExtensionContext) {

    context.subscriptions.push(
      vscode.commands.registerCommand(`vscode-ibmi-fs.createJobFilter`, async () => {
        await JobFilterUI.render(context.extensionUri);
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.maintainJobFilter`, async (node: JobFilter) => {
        await JobFilterUI.render(context.extensionUri, node);
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.deleteJobFilter`, async (node: JobFilter) => {
        if (node) {

          const config = Code4i.getConfig();
          const filterName = node.nameFilter;

          vscode.window.showInformationMessage(`Delete job filter ${filterName}?`, `Yes`, `No`).then(async (value) => {
            if (value === `Yes`) {
              const index = config.jobFilters.findIndex((filter: { nameFilter: string; }) => filter.nameFilter === filterName);

              if (index > -1) {
                config.jobFilters.splice(index, 1);
                await ConnectionConfiguration.update(config);
                // @TODO: No effect for this time
                this.refresh();
              }
            }
          });
        }
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.refreshJobBrowser`, async () => {
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.endJob`, async (node: JobInfo) => {
        if (node) {
          await EndJobUi.render(context.extensionUri, node);
        }
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.propertiesJob`, async (node: JobInfo) => {
        const uri = vscode.Uri.parse(node.jobName + '.job');
        vscode.commands.executeCommand("vscode.open", uri);
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.changeJob`, async (node: JobInfo) => {
        if (node) {
          await ChangeJobUi.render(context.extensionUri, node);
        }
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.holdJob`, async (node) => {
        if (node) {
          await HoldJobUi.render(context.extensionUri, node);
        }
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.releaseJob`, async (node) => {
        if (node) {
          await ReleaseJobUi.render(context.extensionUri, node);
        }
        // @TODO: No effect for this time
        this.refresh();
      }),
      vscode.commands.registerCommand(`vscode-ibmi-fs.historyJob`, async (node) => {
        const content = Code4i.getContent();
        let items = [];

        // const histories = await <JobLog[]>content.runSQL([`select message_timestamp "timestamp", ifnull(message_id, '') "messageId", severity "severity", trim(message_text) "texte" from table(qsys2.joblog_info('${node.jobName}')) a order by ordinal_position desc`].join(` `));
        const histories = await Code4i.getContent().runSQL([`select message_timestamp "timestamp", ifnull(message_id, '') "messageId", severity "severity", trim(message_text) "texte" from table(qsys2.joblog_info('${node.jobName}')) a order by ordinal_position desc`].join(` `));

        // items = histories.map(history => new JobLogItem(history.timestamp));

        // await historyJobUI.init(items);
      })
    );

  }

  refresh(): void {
    this._emitter.fire();
  }

  getTreeItem(element: any): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: any): Promise<vscode.TreeItem[]> {
    const content = Code4i.getContent();
    const connection = Code4i.getConnection();
    const config = Code4i.getConfig();

    let item, whereClause = ``, filterClause = ``;;

    if (element) {

      switch (element.contextValue) {
        case `jobFilter`:
          const jobFilter: JobFilter = element;

          if (jobFilter.jobNumberFilter !== `*` && jobFilter.jobNumberFilter.length > 0) {
            whereClause += ` AND JOB_NUMBER like '${jobFilter.jobNumberFilter}'`;
          }

          if (jobFilter.profileFilter !== `*` && jobFilter.profileFilter.length > 0) {
            whereClause += ` AND AUTHORIZATION_NAME like '${jobFilter.profileFilter}'`;
          }

          // Don't want to search all and not blank
          if (jobFilter.jobNameFilter !== `*` && jobFilter.jobNameFilter.length > 0) {
            if (jobFilter.jobNameFilter.search(`[*]`)) {
              // Joker
              whereClause += ` AND JOB_NAME_SHORT like '${jobFilter.jobNameFilter.replace(`*`, `%`)}'`;
            } else {
              // Exact search
              filterClause += ` , JOB_NAME_FILTER => '${jobFilter.jobNameFilter}'`;
            }
          }

          // Don't want to search all and not blank
          if (jobFilter.subsystemFilter !== `*` && jobFilter.subsystemFilter.length > 0) {
            if (jobFilter.subsystemFilter.search(`[*]`)) {
              // Joker
              whereClause += ` AND SUBSYSTEM like '${jobFilter.subsystemFilter.replace(`*`, `%`)}'`;
            } else {
              // Exact search
              filterClause += ` , SUBSYSTEM_LIST_FILTER => '${jobFilter.subsystemFilter}'`;
            }
          }

          // Don't want to search all and not blank
          if (jobFilter.jobUserFilter !== `*` && jobFilter.jobUserFilter.length > 0) {
            if (jobFilter.jobUserFilter.search(`[*]`)) {
              // Joker
              whereClause += ` AND JOB_USER like '${jobFilter.jobUserFilter.replace(`*`, `%`)}'`;
            } else {
              // Exact search
              whereClause += ` AND JOB_USER = '${jobFilter.jobUserFilter}'`;
            }
          }

          if (connection) {
            try {
              const subSystems = await Code4i.getContent().runSQL([`SELECT distinct a.SUBSYSTEM "subsystemName", A.SUBSYSTEM_LIBRARY_NAME "subsystemLibrary", IFNULL(s.TEXT_DESCRIPTION, '') "subsystemDescription" 
              FROM TABLE (QSYS2.ACTIVE_JOB_INFO(DETAILED_INFO => 'NONE' ${filterClause} )) A
              LEFT JOIN QSYS2.SUBSYSTEM_INFO s ON s.SUBSYSTEM_DESCRIPTION = A.SUBSYSTEM AND s.SUBSYSTEM_DESCRIPTION_LIBRARY = A.SUBSYSTEM_LIBRARY_NAME
              WHERE JOB_TYPE NOT IN ('SBS', 'SYS', 'RDR', 'WTR') ${whereClause} order by 1, 2, 3`].join(` `));

              if (subSystems && subSystems.length > 0) {
                return subSystems.map(subSystem => new SubSystem(String(subSystem.subsystemName), String(subSystem.subsystemLibrary), String(subSystem.subsystemDescription), jobFilter.nameFilter, jobFilter.jobNameFilter, jobFilter.jobUserFilter, jobFilter.jobNumberFilter, jobFilter.profileFilter, jobFilter.subsystemFilter));
              } else {
                item = new vscode.TreeItem(`No active job`);
                return [item];
              }


            } catch (e) {
              console.log(e);
              item = new vscode.TreeItem(`Error loading subsystems.`);
              return [item];
            }
          }

          break;

        case `subsystem`:
          const subSystem: SubSystemInfo = element;

          if (subSystem.jobNumberFilter !== `*` && subSystem.jobNumberFilter.length > 0) {
            whereClause += ` AND JOB_NUMBER like '${subSystem.jobNumberFilter}'`;
          }

          if (subSystem.profileFilter !== `*` && subSystem.profileFilter.length > 0) {
            whereClause += ` AND AUTHORIZATION_NAME like '${subSystem.profileFilter}'`;
          }

          // Don't want to search all and not blank
          if (subSystem.jobNameFilter !== `*` && subSystem.jobNameFilter.length > 0) {
            if (subSystem.jobNameFilter.search(`[*]`)) {
              // Joker
              whereClause += ` AND JOB_NAME_SHORT like '${subSystem.jobNameFilter.replace(`*`, `%`)}'`;
            } else {
              // Exact search
              filterClause += ` , JOB_NAME_FILTER => '${subSystem.jobNameFilter}'`;
            }
          }

          filterClause += ` , SUBSYSTEM_LIST_FILTER => '${subSystem.subsystemName}'`;

          // Don't want to search all and not blank
          if (subSystem.jobUserFilter !== `*` && subSystem.jobUserFilter.length > 0) {
            if (subSystem.jobUserFilter.search(`[*]`)) {
              // Joker
              whereClause += ` AND JOB_USER like '${subSystem.jobUserFilter.replace(`*`, `%`)}'`;
            } else {
              // Exact search
              whereClause += ` AND JOB_USER = '${subSystem.jobUserFilter}'`;
            }
          }

          if (connection) {
            try {
              const activeJobs = await Code4i.getContent().runSQL([`SELECT JOB_NAME "jobName", JOB_NAME_SHORT "jobNameShort", JOB_USER "jobUser", JOB_NUMBER "jobNumber", JOB_STATUS "jobStatus" FROM TABLE (QSYS2.ACTIVE_JOB_INFO(DETAILED_INFO => 'NONE' ${filterClause} )) A
              WHERE JOB_TYPE NOT IN ('SBS', 'SYS', 'RDR', 'WTR') ${whereClause} order by SUBSYSTEM, JOB_NAME_SHORT`].join(` `));

              if (activeJobs && activeJobs.length > 0) {
                return activeJobs.map(activeJob => new ActiveJob(String(activeJob.jobName), String(activeJob.jobNameShort), String(activeJob.jobUser), String(activeJob.jobNumber), String(activeJob.jobStatus)));
              } else {
                item = new vscode.TreeItem(`No active job`);
                return [item];
              }


            } catch (e) {
              console.log(e);
              item = new vscode.TreeItem(`Error loading jobs.`);
              return [item];
            }
          }

          break;

      }

    } else {

      if (connection) {
        const jobFilters = config.jobFilters || '';

        if (jobFilters && jobFilters.length > 0) {
          return jobFilters.map((filter: JobFilter) => new JobFilterItem(filter.nameFilter, filter.jobNameFilter, filter.jobUserFilter, filter.jobNumberFilter, filter.profileFilter, filter.subsystemFilter));
        } else {
          return [getNewFilter()];
        }
      }
    }

    return [];
  }
}

const getNewFilter = () => {
  const item = new vscode.TreeItem(`Create new job filter..`);

  item.iconPath = new vscode.ThemeIcon(`add`);
  item.command = {
    command: `vscode-ibmi-fs.createJobFilter`,
    title: `Create new job filter`
  };

  return item;
};

class JobFilterItem extends vscode.TreeItem implements JobFilter {
  constructor(
    public readonly nameFilter: string,
    public readonly jobNameFilter: string,
    public readonly jobUserFilter: string,
    public readonly jobNumberFilter: string,
    public readonly profileFilter: string,
    public readonly subsystemFilter: string
  ) {
    super(nameFilter, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = `jobFilter`;
    this.description = `${jobNumberFilter}/${jobUserFilter}/${jobNameFilter} (profil: ${profileFilter} - subsystem: ${subsystemFilter})`;
    this.iconPath = new vscode.ThemeIcon(`filter`);

  }
}

class JobLogItem implements JobLog {
  constructor(jobLog: JobLog) {

    this.timestamp = jobLog.timestamp;
    this.messageId = jobLog.messageId;
    this.severity = jobLog.severity;
    this.texte = jobLog.texte;

  }
  timestamp: string;
  messageId: string;
  severity: number;
  texte: string;
}


class SubSystem extends vscode.TreeItem implements SubSystemInfo {
  constructor(
    public readonly subsystemName: string,
    public readonly subsystemLibrary: string,
    public readonly subsystemDescription: string,
    public readonly nameFilter: string,
    public readonly jobNameFilter: string,
    public readonly jobUserFilter: string,
    public readonly jobNumberFilter: string,
    public readonly profileFilter: string,
    public readonly subsystemFilter: string
  ) {
    super(subsystemName, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = `subsystem`;
    this.description = subsystemDescription;
    this.iconPath = new vscode.ThemeIcon(`server-process`);
  }
}

class ActiveJob extends vscode.TreeItem implements ActiveJobInfo {
  constructor(
    public readonly jobName: string,
    public readonly jobNameShort: string,
    public readonly jobUser: string,
    public readonly jobNumber: string,
    public readonly jobStatus: string
  ) {
    super(jobName, vscode.TreeItemCollapsibleState.Collapsed);

    this.contextValue = `activeJob`;
    this.description = `(${jobStatus})`;
    this.resourceUri = vscode.Uri.from({
      scheme: `job`,
      path: `/${this.jobName}.job`
    });

    this.command = {
      command: `vscode.open`,
      title: `Open`,
      arguments: [this.resourceUri]
    };

    this.iconPath = new vscode.ThemeIcon(`feedback`);
    this.collapsibleState = 0;

  }
}

