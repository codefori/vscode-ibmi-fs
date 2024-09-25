
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import vscode, { l10n, TreeDataProvider } from 'vscode';
import { IBMiContentMsgq } from "../api/IBMiContentMsgq";
// import { getSpooledFileUri } from '../filesystem/qsys/SplfFs';
import { Code4i } from '../tools';
import { IBMiMessageQueueViewItem, IBMiMessageQueue } from '../typings';


//https://code.visualstudio.com/api/references/icons-in-labels
const objectIcons: Record<string, string> = {
  'msgq': 'symbol-folder',
  'msg': 'mail',
  '': 'circle-large-outline'
};

export default class MSGQBrowser implements TreeDataProvider<any> {
  private emitter: vscode.EventEmitter<any>;
  public onDidChangeTreeData: vscode.Event<any>;

  constructor(private context: vscode.ExtensionContext) {
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
  }


  refresh(target?: any) {
    this.emitter.fire(target);
  }

  /**
   * @param {vscode.TreeItem} element
   * @returns {vscode.TreeItem};
   */
  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  /**
   * @param {vscode.TreeItem} element
   * @returns {Promise<vscode.TreeItem[]>};
   */
  async getChildren(element: any) {
    const items = [];
    const connection = getConnection();
    if (connection) {
      const config = getConfig();

      if (element) { //Chosen USER??
        // let filter;
        switch (element.contextValue.split(`_`)[0]) {
        case `msgq`:
          //Fetch spooled files
          try {
            const objects = await IBMiContentMsgq.getMessageQueueMessageList(element.queue, element.queueLibrary, element.sort, element.filter);
            items.push(...objects
              .map((object: IBMiMessageQueueViewItem) => new MessageQueueList( element, object)));

          } catch (e: any) {
            // console.log(e);
            vscode.window.showErrorMessage(e.message);
            items.push(new vscode.TreeItem(l10n.t(`Error loading user spooled files.`)));
          }
        case `MSG`:
          { }
          break;
        }

      } else if (config.messageQueues) { // no context exists in tree yet, get from settings if present
        items.push(...config.messageQueues.map( (aMsgq: any) => new MessageQueue(element, aMsgq) ));
      }
    }
    return items;
  }
  /**
   * getParemt
   * required implementation for TreeDataProvider
   *
   */
  getParent(element: any) {
    return element.parent;
  }
  /**
   * Called on hover to resolve the {@link TreeItem.tooltip TreeItem} property if it is undefined.
   * Called on tree item click/open to resolve the {@link TreeItem.command TreeItem} property if it is undefined.
   * Only properties that were undefined can be resolved in `resolveTreeItem`.
   * Functionality may be expanded later to include being called to resolve other missing
   * properties on selection and/or on open.
   *
   * Will only ever be called once per TreeItem.
   *
   * onDidChangeTreeData should not be triggered from within resolveTreeItem.
   *
   * *Note* that this function is called when tree items are already showing in the UI.
   * Because of that, no property that changes the presentation (label, description, etc.)
   * can be changed.
   *
   * @param item Undefined properties of `item` should be set then `item` should be returned.
   * @param element The object associated with the TreeItem.
   * @param token A cancellation token.
   * @return The resolved tree item or a thenable that resolves to such. It is OK to return the given
   * `item`. When no result is returned, the given `item` will be used.
   * @param {vscode.TreeItem} item
   * @param {vscode.TreeDataProvider<T>} element
   * @param {vscode.CancellationToken} token
   * @returns {ProviderResult<vscode.TreeItem>};
   */
  async resolveTreeItem(item: MessageQueue, element: any, token: vscode.CancellationToken): Promise<vscode.TreeItem> {
    if (element.contextValue === 'msgq') {
      const msgqNum = await IBMiContentMsgq.getMessageQueueCount(element.queue, element.queueLibrary);
      const msgqText = await IBMiContentMsgq.getObjectText(element.queue, element.queueLibrary, `*MSGQ`);
      item.tooltip = ``
      .concat(msgqText ? l10n.t(`Queue Text:\t  {0}`, msgqText) : ``)
      .concat(msgqNum  ? l10n.t(`\nMessage Count: {0}`, msgqNum) : ``);
    }
    else if (element.contextValue === 'message') { 
      const msgAttr = await IBMiContentMsgq.getMessageAttributes(element.messageQueue, element.messageQueueLibrary, element.messageKey);
      item.tooltip = ``
        // .concat(msgAttr.messageType          ? l10n.t(`....+....0....+....0`,msgAttr.messageType):``)
        .concat(msgAttr.messageType          ? l10n.t(`Message Type:\t{0}`,msgAttr.messageType):``)
        .concat(msgAttr.severity             ? l10n.t(`\nSeverity:\t\t\t{0}`,msgAttr.severity):``)
        .concat(msgAttr.messageTimestamp     ? l10n.t(`\nTime Arrived:\t\t{0}`,msgAttr.messageTimestamp):``)
        .concat(msgAttr.messageKey           ? l10n.t(`\nKey:\t\t\t\t{0}`,msgAttr.messageKey):``)
        .concat(msgAttr.fromUser             ? l10n.t(`\nFrom User:\t\t{0}`,msgAttr.fromUser):``)
        .concat(msgAttr.fromJob              ? l10n.t(`\nFrom Job:\t\t{0}`,msgAttr.fromJob):``)
        .concat(msgAttr.fromProgram          ? l10n.t(`\nFrom Program:\t{0}`,msgAttr.fromProgram):``)
      ;
    
    }
    return item;
  }
}

export class MessageQueue extends vscode.TreeItem {
  protected: boolean;
  parent: vscode.TreeItem;
  queue: string;
  queueLibrary: string;
  description: string;
  filter: string; // reduces tree items to matching tokens
  readonly sort: SortOptions = { order: "date", ascending: true };
  constructor(parent: vscode.TreeItem, theMsgq: IBMiMessageQueue) {
    super(theMsgq.messageQueueLibrary+`/`+theMsgq.messageQueue, vscode.TreeItemCollapsibleState.Collapsed);
    this.queue = theMsgq.messageQueue;
    this.queueLibrary = theMsgq.messageQueueLibrary;
    const icon = objectIcons[`msgq`] || objectIcons[``];
    // TODO: need to use a command to chekc authority to message queue object.  How to run that or get the result here??
    // this.protected = this.messageQueue.toLocaleUpperCase() !== currentUser.toLocaleUpperCase() ? true : false;
    this.protected = false;
    this.contextValue = `msgq${this.protected ? `_readonly` : ``}`;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.parent = parent;
    this.iconPath = new vscode.ThemeIcon(icon, (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));

    this.description = '';
    this.sortBy( this.sort );

    this.filter = '';
  }
  /** @type {import("../api/IBMiContent").SortOptions}*/
  sortBy(sort: SortOptions) {
    if (this.sort.order !== sort.order) {
      this.sort.order = sort.order;
      this.sort.ascending = true;
    }
    else {
      this.sort.ascending = !this.sort.ascending;
    }
    this.description = ` (sort: ${this.sort.order} ${this.sort.ascending ? `🔼` : `🔽`})`;
  }
  setFilter(filter: string) { this.filter = filter; }
}

export class MessageQueueList extends vscode.TreeItem implements IBMiMessageQueueViewItem {
  parent: MessageQueue;
  name: string;
  messageQueueLibrary: string;
  messageQueue: string;
  messageID: string;
  messageKey: string;
  messageText: string;
  protected: boolean;
  // path: string;
  readonly sort: SortOptions = { order: "date", ascending: true };
  readonly sortBy: (sort: SortOptions) => void;
  /**
   * @param {vscode.TreeItem} parent
   * @param {IBMiSpooledFile} object
   * @param {IBMiSplfUser} filter
   */
  constructor( parent: MessageQueue, object: IBMiMessageQueueViewItem) {

    const icon = objectIcons[`msg`] || objectIcons[``];
    super(`${object.messageID} - ${object.messageText}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.parent = parent;
    this.name = object.messageID+' - '+object.messageText;

    // this.description = l10n.t(`- {0} - Pages: {1}, Time: {2} `, this.status, this.totalPages, this.creationTimestamp.substring(11));
    this.iconPath = new vscode.ThemeIcon(icon);
    this.protected = parent.protected;
    this.contextValue = `message${this.protected ? `_readonly` : ``}`;
    this.messageQueueLibrary = object.messageQueueLibrary;
    this.messageQueue = object.messageQueue;
    this.messageID = object.messageID;
    this.messageKey = object.messageKey;
    this.messageText = object.messageText;
    // this.resourceUri = getMessageQueueMessageUri(object, parent.protected ? { readonly: this.protected } : undefined);
    // this.tooltip = ``
    //   .concat(this.messageID            ? l10n.t(`Message ID . . . .${0}`,this.messageID) :``)
    //   .concat(this.messageType          ? l10n.t(`Message Type . . .${0}`,this.messageType):``)
    //   .concat(this.severity             ? l10n.t(`Severity . . . . .${0}`,this.severity):``)
    //   .concat(this.messageTimestamp     ? l10n.t(`Time Arrived . . .${0}`,this.messageTimestamp):``)
    //   .concat(this.messageKey           ? l10n.t(`Key  . . . . . . .${0}`,this.messageKey):``)
    //   .concat(this.fromUser             ? l10n.t(`From User  . . . .${0}`,this.fromUser):``)
    //   .concat(this.fromJob              ? l10n.t(`From Job . . . . .${0}`,this.fromJob):``)
    //   .concat(this.fromProgram          ? l10n.t(`From Program . . .${0}`,this.fromProgram):``)
    // ;
    this.command = {
      command: `vscode.open`,
      title: `Show Message Details`,
      arguments: [this.resourceUri]
    };
    this.iconPath = new vscode.ThemeIcon(icon, (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));
    this.sortBy = (sort: SortOptions) => parent.sortBy(sort);
  }
}

function getConfig() {
  const config = Code4i.getConfig();
  if (config) {
    return config;
  }
  else {
    throw new Error(l10n.t('Not connected to an IBM i'));
  }
}

function getConnection() {
  const connection = Code4i.getConnection();
  if (connection) {
    return connection;
  }
  else {
    throw new Error(l10n.t('Not connected to an IBM i'));
  }
}

function getContent() {
  const content = Code4i.getContent();
  if (content) {
    return content;
  }
  else {
    throw new Error(l10n.t('Not connected to an IBM i'));
  }
}
