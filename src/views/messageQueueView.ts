
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import vscode, { l10n, TreeDataProvider } from 'vscode';
import { Code4i } from '../tools';
import { IBMiContentMsgq } from "../api/IBMiContentMsgq";
import { IBMiMessageQueueViewItem, IBMiMessageQueue, IBMiMessageQueueMessage } from '../typings';
import { getMessageDetailFileUri } from '../filesystem/qsys/MsgQFs';

//https://code.visualstudio.com/api/references/icons-in-labels
const objectIcons: Record<string, string> = {
  'msgq': 'symbol-folder',
  'msg': 'mail',
  // eslint-disable-next-line @typescript-eslint/naming-convention
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

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  /**
   * @param {vscode.TreeItem} element
   * @returns {Promise<vscode.TreeItem[]>};
   */
  async getChildren(element :any) {
    const items = [];
    const connection = Code4i.getConnection();
    if (connection) {
      const config = Code4i.getConfig();

      if (element) { //Chosen USER??
        // let filter;
        switch (element.contextValue.split(`_`)[0]) {
        case `msgq`:
          //Fetch messages from message queue
          try {
            const objects = await IBMiContentMsgq.getMessageQueueMessageList(element.messageQueue, element.messageQueueLibrary, element.sort, element.filter);
            items.push(...objects
              .map((object: IBMiMessageQueueViewItem) => new MessageQueueList(element, object)));

          } catch (e: any) {
            // console.log(e);
            vscode.window.showErrorMessage(e.message);
            items.push(new vscode.TreeItem(l10n.t(`Error loading messages for message queue {0}.`, element.messageQueueLibrary + '/' + element.messageQueue)));
          }
        case `MSG`:
          { }
          break;
        }

      } else if (config.messageQueues) {
        let cfgMessageQueues = config.messageQueues;
        items.push(...cfgMessageQueues.map(
          (aMsgq: IBMiMessageQueue) => new MessageQueue(aMsgq.text, element, aMsgq)
        ));
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
   * @param item Undefined properties of `item` should be set then `item` should be returned.
   * @param element The object associated with the TreeItem.
   * @param token A cancellation token.
   * @return The resolved tree item or a thenable that resolves to such. It is OK to return the given
   * `item`. When no result is returned, the given `item` will be used.
   */
  async resolveTreeItem(item: MessageQueue, element: any, token: vscode.CancellationToken): Promise<vscode.TreeItem> {
    if (element.contextValue === 'msgq') {
      const msgqNum = await IBMiContentMsgq.getMessageQueueCount(element.messageQueue, element.messageQueueLibrary, element.filter);
      let msgqText = await IBMiContentMsgq.getObjectText(element.messageQueue, element.messageQueueLibrary, `*MSGQ`);
      msgqText = msgqText === 'null' ?'*BLANKS' : msgqText;
      item.tooltip = ``
        .concat(msgqText ? l10n.t(`Queue Text:\t  {0}`, msgqText) : ``)
        .concat(msgqNum ? l10n.t(`\nMessage Count: {0}`, msgqNum) : ``);
    }
    else if (element.contextValue === 'message') {
      const msgAttr = await IBMiContentMsgq.getMessageAttributes(element.messageQueue, element.messageQueueLibrary, element.messageKey);
      item.tooltip = ``
        // .concat(msgAttr.messageType          ? l10n.t(`....+....0....+....0`,msgAttr.messageType):``)
        .concat(msgAttr.messageType ? l10n.t(`Message Type:\t{0}`, msgAttr.messageType) : ``)
        .concat(msgAttr.severity ? l10n.t(`\nSeverity:\t\t\t{0}`, msgAttr.severity) : ``)
        .concat(msgAttr.messageTimestamp ? l10n.t(`\nTime Arrived:\t\t{0}`, msgAttr.messageTimestamp) : ``)
        .concat(msgAttr.messageKey ? l10n.t(`\nKey:\t\t\t\t{0}`, msgAttr.messageKey) : ``)
        .concat(msgAttr.fromUser ? l10n.t(`\nFrom User:\t\t{0}`, msgAttr.fromUser) : ``)
        .concat(msgAttr.fromJob ? l10n.t(`\nFrom Job:\t\t{0}`, msgAttr.fromJob) : ``)
        .concat(msgAttr.fromProgram ? l10n.t(`\nFrom Program:\t{0}`, msgAttr.fromProgram) : ``)
        ;

    }
    return item;
  }
}

export class MessageQueue extends vscode.TreeItem implements IBMiMessageQueue {
  protected: boolean;
  parent: vscode.TreeItem;
  messageQueue: string;
  messageQueueLibrary: string;
  description: string;
  filter: string | undefined; // reduces tree items to matching tokens
  readonly sort: SortOptions = { order: "date", ascending: true };
  sortDescription :string;
  constructor(_description: string | undefined, parent: vscode.TreeItem, theMsgq: IBMiMessageQueue) {
    super(theMsgq.messageQueueLibrary + `/` + theMsgq.messageQueue, vscode.TreeItemCollapsibleState.Collapsed);
    this.messageQueue = theMsgq.messageQueue;
    this.messageQueueLibrary = theMsgq.messageQueueLibrary;
    const icon = objectIcons[`msgq`] || objectIcons[``];
    // TODO: need to use a command to check authority to message queue object.  How to run that or get the result here??
    // this.protected = this.messageQueue.toLocaleUpperCase() !== currentUser.toLocaleUpperCase() ? true : false;
    this.protected = false;
    this.contextValue = `msgq${this.protected ? `_readonly` : ``}`;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.parent = parent;
    this.iconPath = new vscode.ThemeIcon(icon, (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));
    this.sortDescription = this.sortBy(this.sort);
    this.description = (_description ? _description :``) + this.sortDescription;
  }
  sortBy(sort: SortOptions) {
    if (this.sort.order !== sort.order) {
      this.sort.order = sort.order;
      this.sort.ascending = true;
    }
    else {
      this.sort.ascending = !this.sort.ascending;
    }
    return ` (sort: ${this.sort.order} ${this.sort.ascending ? `🔼` : `🔽`})`;
  }
  setFilter(filter: string | undefined) { this.filter = filter; }
  clearToolTip() { this.tooltip = undefined; }
  setDescription(value: string | boolean) { this.description = (value?value:``)+this.sortDescription; }
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
  readonly sort: SortOptions = { order: "date", ascending: true };
  readonly sortBy: (sort: SortOptions) => void;

  constructor(parent: MessageQueue, object: IBMiMessageQueueViewItem) {

    const icon = objectIcons[`msg`] || objectIcons[``];
    super(`${object.messageID} - ${object.messageText}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.parent = parent;
    this.name = object.messageID + ' - ' + object.messageText;
    this.resourceUri = getMessageDetailFileUri(object, parent.protected ? { readonly: true } : undefined);
    // this.path = this.resourceUri.path.substring(1); // removes leading slash for QSYS paths
    this.iconPath = new vscode.ThemeIcon(icon);
    this.protected = parent.protected;
    this.contextValue = `message${this.protected ? `_readonly` : ``}`;
    this.messageQueueLibrary = object.messageQueueLibrary;
    this.messageQueue = object.messageQueue;
    this.messageID = object.messageID;
    this.messageKey = object.messageKey;
    this.messageText = object.messageText;
    this.command = {
      command: `vscode.open`,
      title: `Show Message Details`,
      arguments: [this.resourceUri]
    };
    this.iconPath = new vscode.ThemeIcon(icon, (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));
    this.sortBy = (sort: SortOptions) => parent.sortBy(sort);
  }
}