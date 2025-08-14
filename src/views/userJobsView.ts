
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import vscode, { l10n, TreeDataProvider } from 'vscode';
import { Code4i } from '../tools';
import { IBMiContentFS, sortObjectArrayByProperty } from "../api/IBMiContentfs";
import { IBMiContentJobs } from "../api/IBMiContentJobs";
import { IBMiUserJobsUsers, IBMiUserJobsFilter, IBMiUserJob, ObjAttributes, ObjLockState } from '../typings';
import { getUsrJobDetailFileUri } from '../filesystem/qsys/UsrJobFs';

//https://code.visualstudio.com/api/references/icons-in-labels
const objectIcons: Record<string, string> = {
  'user': 'person',
  'job': 'symbol-class',
  'msgw': 'question',
};

export default class UserJobBrowser implements TreeDataProvider<any> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void>;
  public onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void>;
  private _userFilters: IBMiUserJobsFilter[] = [];

  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  // Method to set data when your extension becomes connected
  public populateData(newData: IBMiUserJobsFilter[]): void {
    this._userFilters = newData;
    this._onDidChangeTreeData.fire(); // Notify VS Code to refresh
  }

  // Method to clear the tree view
  public clearTree(oldData?: IBMiUserJobsFilter): void {
    if (oldData) {
      const tempArray = this._userFilters.filter(obj => obj.user !== oldData.user);
      this._userFilters = tempArray;
    } else {
      this._userFilters = []; // Clear the data
    }
    this._onDidChangeTreeData.fire(); // Notify VS Code to refresh
  }

  refresh(target?: any): void {
    this._onDidChangeTreeData.fire(target);
  }

  async getTreeItem(element: any) {
    return element;
  }

  /**
   * @param {vscode.TreeItem} element
   * @returns {Promise<vscode.TreeItem[]>};
   */
  async getChildren(element: any): Promise<vscode.TreeItem[]> {
    const items = [];
    if (!element) {
      if (this._userFilters && this._userFilters.length > 0) {
        const filtereditems: IBMiUserJobsFilter[] = this._userFilters.filter((item: any) => item === item);
        const distinctNames: string[] = [...new Set(filtereditems.map(item => item.user))];
        const objAttributes = await IBMiContentFS.getObjectText(distinctNames, [], ['*USRPRF']);
        const users = this._userFilters.map((item) =>
        ({
          user: item.user,
          text: lookupItemText(item, objAttributes),
        } as IBMiUserJobsUsers));
        const mappedUsers: UserList[] = users.map((item) => new UserList(element, item));
        items.push(...mappedUsers);
      }
    } else {
      // the user job filter items.
      switch (element.contextValue.split(`_`)[0]) {
      case `userJobUser`:
        try {
          let userJobs = await IBMiContentJobs.getUserJobList(`UserJobBrowser.getChildren`
            , element.user, element.filter, element.msgwMode);
          userJobs = sortObjectArrayByProperty(userJobs
            , element.sort.order === 'date' ? `jobEnteredSystemTime` : element.sort.order === 'name' ? 'jobNameShort' : ''
            , element.sort.ascending ? 'asc' : 'desc');
          // NOTE: this section is about getting the message key for those jobs in MSGW status.
          //       We are going to wait to do this until the user decides to answer the message for the specfic job.
          //       Waiting reduces the load time. 
          // // const filtereditems: IBMiUserJob[] = userJobs.filter((item: any) => item.activeJobStatus === 'MSGW');
          // // const distinctNames: string[] = [...new Set(filtereditems.map(item => item.jobName||''))];
          // // const msgwJobs = await IBMiContentJobs.getJobMessageWaitMessages(`MSGQBrowser.getChildren`, distinctNames);
          items.push(...userJobs.map((userJob: IBMiUserJob) => {
            // // let index = 0;
            // // index = msgwJobs.findIndex(f => (f.jobName === userJob.jobName));
            // // if (index >= 0) {
            // //   userJob.jobMessageKey = msgwJobs[index].jobMessageKey; // Show which job has a message wait and what key(?)
            // // }
            const userJobItem = new UserJob(element, userJob);
            return userJobItem;
          })
          );
          element.setRecordCount(items.length);

        } catch (e: any) {
          console.log(e);
          vscode.window.showErrorMessage(e.message);
          items.push(new vscode.TreeItem(l10n.t(`Error loading user job for user {0}.`, element.user)));
        }
      }
    }
    return Promise.all(items);
  }
  /**
   * getParemt
   * required implementation for TreeDataProvider
   *
   */
  getParent(element: any): any {
    return element.parent;
  }
  /**
   * @param item Undefined properties of `item` should be set then `item` should be returned.
   * @param element The object associated with the TreeItem.
   * @param _token A cancellation token.
   * @return The resolved tree item or a thenable that resolves to such. It is OK to return the given
   * `item`. When no result is returned, the given `item` will be used.
   */
  async resolveTreeItem(item: UserList | UserJob, element: any, _token: vscode.CancellationToken): Promise<vscode.TreeItem> {
    if (item instanceof UserList) {
      let userJobNum = ``;
      if (!item.listCount || item.listCount === 0) {
        const treeFilter = { ...element };
        // caller: string, treeFilter: IBMiUserJobsFilter, searchWords?: string
        userJobNum = await IBMiContentJobs.getUserJobCount(`UserJobBrowser.resolveTreeItem`, treeFilter, element.filter, element.msgqwMode);
        item.listCount = Number(userJobNum);
        item.setRecordCount(item.listCount);
      }
      if (!item.text) {
        const objAttributes = await IBMiContentFS.getObjectText([element.messageQueue], [element.messageQueueLibrary], [`*USRPRF`]) || '';
        item.text = objAttributes[0].text;
        item.setDescription();
      }
      item.tooltip = new vscode.MarkdownString(`<table>`
        .concat(`<thead>${item.label}</thead><hr>`)
        // .concat(`<thead>${item.messageQueueLibrary}/${item.messageQueue}</thead><hr>`)
        .concat(`<tr><td>${l10n.t(`Text:`)} </td><td>&nbsp;${l10n.t(String(item.text === null ? '' : item.text))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Job Count:`)} </td><td>&nbsp;${l10n.t(String(item.listCount ? item.listCount : '0'))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Sorting:`)} </td><td>&nbsp;${l10n.t(String(item.sortDescription))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Filtering:`)} </td><td>&nbsp;${l10n.t(String(item.filterDescription))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Message Wait Mode:`)} </td><td>&nbsp;${l10n.t(String(item.msgwMode))}</td></tr>`)
      );
      item.tooltip.appendMarkdown(`<hr>`
        // .concat(`$(debug-alt) Debug Info: `${inDebugMode ? "${this.contextValueToDisplay}" : ""}`)
        .concat(`<tr><td>${l10n.t(`Context Value:`)} </td><td>&nbsp;${item.contextValue}</td></tr>`)
        .concat(`</table>`)
      );
      item.tooltip.supportHtml = true;

    } else if (item instanceof UserJob) {
      item.tooltip = new vscode.MarkdownString(`<table>`
        .concat(`<thead>${item.label}</thead><hr>`)
        .concat(`<tr><td>${l10n.t(`Active Job Subsystem:`)} </td><td>&nbsp;${l10n.t(String(`${item.activeJobSubsystem ? item.activeJobSubsystem : ''}`))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Job Status:`)} </td><td>&nbsp;${l10n.t(String(item.jobStatus))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Active Job Status:`)} </td><td>&nbsp;${l10n.t(String(item.activeJobStatus))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Job Queue:`)} </td><td>&nbsp;${l10n.t(String(item.jobQueueLibrary + '/' + item.jobQueueName))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Job CCSID:`)} </td><td>&nbsp;${l10n.t(String(item.jobCCSID))}</td></tr>`)
        // .concat(`<tr><td>${l10n.t(`Job Inquiry Message Key:`)} </td><td>&nbsp;${l10n.t(String(`${item.jobMessageKey?item.jobMessageKey:'...pending...'}`))}</td></tr>`)
      );
      item.tooltip.appendMarkdown(`<hr>`
        .concat(`<tr><td>${l10n.t(`Context Value:`)} </td><td>&nbsp;${item.contextValue}</td></tr>`)
        .concat(`</table>`)
      );
      item.tooltip.supportHtml = true;
    }
    return item;
  }
}

export class UserList extends vscode.TreeItem implements IBMiUserJobsUsers {
  parent: vscode.TreeItem;
  user: string;
  text: string;
  filter: string | undefined; // reduces tree items to matching tokens
  filterDescription: string | undefined;
  msgwMode?: string;
  listCount: number | undefined;
  readonly sort: SortOptions = { order: "date", ascending: true };
  sortDescription: string | undefined;
  protected: boolean;
  constructor(parent: vscode.TreeItem, theUser: IBMiUserJobsUsers) {
    super(createUserListNodeLabel(theUser), vscode.TreeItemCollapsibleState.Collapsed);
    this.protected = false;
    this.user = theUser.user;
    const icon = this.setIcon('user');
    this.contextValue = `userJobUser`;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.parent = parent;
    this.iconPath = new vscode.ThemeIcon(icon);
    this.sortBy(this.sort);
    this.text = theUser.text || '';
    this.setDescription();
    this.setFilterDescription('');
    this.setMsgwMode('');
  }
  sortBy(sort: SortOptions) {
    if (this.sort.order !== sort.order) {
      this.sort.order = sort.order;
      this.sort.ascending = true;
    }
    else {
      this.sort.ascending = !this.sort.ascending;
    }
    this.sortDescription = `( sort: ${this.sort.order} ${this.sort.ascending ? `🔺` : `🔻`})`;
  }
  clearToolTip() { this.tooltip = undefined; }
  clearDescription() { this.description = undefined; }
  getRecordCount() { return this.listCount; }
  setFilter(filter: string | undefined) { this.filter = filter; }
  setIcon(type: string): string {
    return objectIcons[type];
  }
  setFilterDescription(value: string | undefined) { this.filterDescription = this.filterDescription = `${value ? `Filtered by: ${value}` : ''}`; }
  setDescription() {
    this.description =
      (this.text ? this.text : '')
      + (this.filterDescription ? ` ` + this.filterDescription : ``)
      + (this.sortDescription ? ` ` + this.sortDescription : '');
  }
  setRecordCount(aNumber: number) { this.listCount = aNumber; }
  setMsgwMode(mw: string) { this.msgwMode = mw; }
}

export class UserJob extends vscode.TreeItem implements IBMiUserJob {
  parent: UserList;
  path: string;
  jobName?: string;
  jobStatus?: string;
  jobType?: string;
  jobNameShort?: string;
  jobUser?: string;
  jobNumber?: string;
  jobQueueLibrary?: string;
  jobQueueName?: string;
  jobCCSID?: string;
  activeJobSubsystem?: string;
  activeJobStatus?: string;
  // jobMessageKey?: string;
  // jobMessageQueueLibrary?: string;
  // jobMessageQueueName?: string;
  jobEnteredSystemTime?: string;
  readonly sort: SortOptions = { order: "date", ascending: true };
  readonly sortBy: (sort: SortOptions) => void;
  readonly setDescription: () => void;

  constructor(parent: UserList, object: IBMiUserJob) {

    super(createUserJobNodeLabel(object), vscode.TreeItemCollapsibleState.Collapsed);
    // super(`${object.jobName} - (${object.jobType}) ${object.activeJobSubsystem?object.activeJobSubsystem:object.jobStatus} `, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    this.parent = parent;
    this.resourceUri = getUsrJobDetailFileUri(object, { readonly: false });
    // this.contextValue = `userJobJob`;
    this.setContextValue(object);
    this.path = this.resourceUri.path.substring(1); // removes leading slash for QSYS paths
    this.jobName = object.jobName;
    this.jobStatus = object.jobStatus;
    this.jobType = object.jobType;
    this.jobNameShort = object.jobNameShort;
    this.jobUser = object.jobUser;
    this.jobNumber = object.jobNumber;
    this.jobQueueLibrary = object.jobQueueLibrary;
    this.jobQueueName = object.jobQueueName;
    this.jobCCSID = object.jobCCSID;
    this.activeJobSubsystem = object.activeJobSubsystem;
    this.activeJobStatus = object.activeJobStatus;
    this.jobEnteredSystemTime = object.jobEnteredSystemTime;
    this.command = {
      command: `vscode-ibmi-fs.viewUserJobDetails`,
      title: `Show Job Details`,
      arguments: [this]
    };
    this.updateIconPath();
    this.sortBy = (sort: SortOptions) => parent.sortBy(sort);
    this.setDescription = () => parent.setDescription();
  }
  getContextValue() { return this.contextValue; }
  setIcon(): string { return objectIcons['job']; }
  setIconColor(): string { return ''; }
  updateIconPath() { this.iconPath = new vscode.ThemeIcon(this.setIcon(), new vscode.ThemeColor(this.setIconColor())); }
  // setjobMessageKey(mKey: string | undefined) { return this.jobMessageKey = mKey; }
  // setjobMessageQueueLibrary(item: string | undefined) { return this.jobMessageQueueLibrary = item; }
  // setjobMessageQueueName(item: string | undefined) { return this.jobMessageQueueName = item; }
  updateContextValue(newContextValue: string) { this.contextValue = newContextValue; }
  setContextValue(item: IBMiUserJob) { 
    this.contextValue = `userJobJob_` +item.jobType+'_'+item.jobStatus;
    if (item.activeJobStatus && item.activeJobStatus !== 'DSPW') {
      this.contextValue +='_'+item.activeJobStatus;
    } else if (item.jobQueueStatus && item.jobQueueStatus !== 'RELEASED') {
      this.contextValue += '_'+item.jobQueueStatus;
    }
  }
}
function createUserListNodeLabel(theValue: IBMiUserJobsUsers) {
  let q = '';
  q = theValue.user;
  return q;
}
function createUserJobNodeLabel(object: IBMiUserJob) {
  let q = `${object.jobName} - (${object.jobType}) ${object.jobStatus}`;
  if (object.activeJobStatus) { q += ' - ' + object.activeJobStatus; 

  } else if (object.jobQueueStatus) 
    { q += ' - ' + object.jobQueueStatus; }
  return q;
}
function lookupItemText(aFilter: IBMiUserJobsFilter, objAttributes: ObjAttributes[]): string {
  let index = 0;
  let theText = '';
  index = objAttributes.findIndex(f => f.name === aFilter.user);
  if (index >= 0) {
    theText = objAttributes[index].text;
  }
  return theText;
}