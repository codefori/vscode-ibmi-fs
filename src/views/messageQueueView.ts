
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import vscode, { l10n, TreeDataProvider } from 'vscode';
import { Code4i } from '../tools';
import { IBMiContentMsgq, sortObjectArrayByProperty } from "../api/IBMiContentMsgq";
import { IBMiMessageQueue, IBMiMessageQueueFilter, IBMiMessageQueueMessage, ObjAttributes, ObjLockState } from '../typings';
import { getMessageDetailFileUri } from '../filesystem/qsys/MsgqFs';

//https://code.visualstudio.com/api/references/icons-in-labels
const objectIcons: Record<string, string> = {
  'msgq': 'symbol-folder',
  'msg': 'mail',
  'inquiry': 'question',
  'usrprf': 'person',
  // eslint-disable-next-line @typescript-eslint/naming-convention
  '': 'circle-large-outline'
};

export default class MSGQBrowser implements TreeDataProvider<any> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void>;
  public onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void>;
  private _msgqFilters: IBMiMessageQueueFilter[] = [];

  constructor() {
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  // Method to set data when your extension becomes connected
  public populateData(newData: IBMiMessageQueueFilter[]): void {
    this._msgqFilters = newData;
    this._onDidChangeTreeData.fire(); // Notify VS Code to refresh
  }

  // Method to clear the tree view
  public clearTree(oldData?: IBMiMessageQueueFilter): void {
    if (oldData) {
      const tempArray = this._msgqFilters.filter(obj => obj.messageQueueLibrary !== oldData.messageQueueLibrary
        && obj.messageQueue !== oldData.messageQueue
        && obj.type !== oldData.type
      );
      this._msgqFilters = tempArray;
    } else {
      this._msgqFilters = []; // Clear the data
    }
    this._onDidChangeTreeData.fire(); // Notify VS Code to refresh
  }

  refresh(target?: any): void {
    this._onDidChangeTreeData.fire(target);
  }

  async getTreeItem(element: MessageQueue | MessageQueueList) {
    if (element instanceof MessageQueue) {
      if (!element.description) {
        element.setDescription();
      }
    } else if (element instanceof MessageQueueList) {
    }
    return element;
  }

  /**
   * @param {vscode.TreeItem} element
   * @returns {Promise<vscode.TreeItem[]>};
   */
  async getChildren(element: any): Promise<vscode.TreeItem[]> {
    const items = [];
    if (!element) {
      if (this._msgqFilters && this._msgqFilters.length > 0) {
        const filtereditems: IBMiMessageQueueFilter[] = this._msgqFilters.filter((item: any) => item.messageQueueLibrary !== `` || item.messageQueue !== ``);
        const distinctNames: string[] = [...new Set(filtereditems.map(item => item.messageQueue))];
        const distinctLibraries: string[] = [...new Set(filtereditems.map(item => item.messageQueueLibrary))];
        const distinctTypes: string[] = [...new Set(filtereditems.map(item => item.type || '*MSGQ'))];
        const objAttributes = await IBMiContentMsgq.getObjectText(distinctNames, distinctLibraries, distinctTypes);
        const objLockStates = await IBMiContentMsgq.getObjectLocks(distinctNames, distinctLibraries, distinctTypes);
        const mesageQueues = this._msgqFilters.map((aMsgq) =>
        ({
          messageQueueLibrary: lookupLibraryValue(aMsgq, objAttributes),
          messageQueue: aMsgq.messageQueue,
          protected: lookupItemLockState(aMsgq, objLockStates),
          text: lookupItemText(aMsgq, objAttributes),
          type: lookupFilterType(aMsgq)
        } as IBMiMessageQueue));
        const mappedMessageQueues: MessageQueue[] = mesageQueues.map((item) => new MessageQueue(element, item));
        items.push(...mappedMessageQueues);
      }
    } else {
      // the message queue filter items.
      switch (element.contextValue.split(`_`)[0]) {
      case `msgq`:
        //Fetch messages from message queue
        try {
          const treeFilter = { ...element };
          let messages = await IBMiContentMsgq.getMessageQueueMessageList(`MSGQBrowser.getChildren`
            , treeFilter, element.filter, undefined, element.inquiryMode);
          messages = sortObjectArrayByProperty(messages
            , element.sort.order === 'date' ? `messageTimestamp` : element.sort.order === 'name' ? 'messageText' : ''
            , element.sort.ascending ? 'asc' : 'desc');

          const distinctNames: string[] = [...new Set(messages.map(item => item.messageQueue || ''))];
          const distinctLibraries: string[] = [...new Set(messages.map(item => item.messageQueueLibrary || ''))];
          const msgReplies = await IBMiContentMsgq.getMessageReplies(`MSGQBrowser.getChildren`, distinctNames, distinctLibraries
            , undefined, undefined, element.inquiryMode
          );
          items.push(...messages.map((message: IBMiMessageQueueMessage) => {
            let index = 0;
            index = msgReplies.findIndex(f => (f.messageKeyAssociated === message.messageKey));
            if (index >= 0) {
              message.messageKeyAssociated = msgReplies[index].messageKey; // Associate to INQUIRY message its answer
              message.messageReply = msgReplies[index].messageReply;
              message.messageReplyUser = msgReplies[index].messageReplyUser;
              message.messageReplyJob = msgReplies[index].messageReplyJob;
            }
            const messageItem = new MessageQueueList(element, message);
            return messageItem;
          })
          );
          element.setRecordCount(items.length);

        } catch (e: any) {
          console.log(e);
          vscode.window.showErrorMessage(e.message);
          items.push(new vscode.TreeItem(l10n.t(`Error loading messages for message queue {0}.`, element.messageQueueLibrary + '/' + element.messageQueue)));
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
  async resolveTreeItem(item: MessageQueue | MessageQueueList, element: any, _token: vscode.CancellationToken): Promise<vscode.TreeItem> {
    if (item instanceof MessageQueue) {
      let msgqNum = ``;
      if (!item.messageCount || item.messageCount === 0) {
        const treeFilter = { ...element };
        msgqNum = await IBMiContentMsgq.getMessageQueueCount(`MSGQBrowser.resolveTreeItem`,
          treeFilter, element.filter, undefined, element.inquiryMode);
        item.messageCount = Number(msgqNum);
        item.setRecordCount(item.messageCount);
      }
      if (!item.text) {
        const objAttributes = await IBMiContentMsgq.getObjectText([element.messageQueue], [element.messageQueueLibrary], [`*MSGQ`]) || '';
        item.text = objAttributes[0].text;
        item.setDescription();
      }
      item.tooltip = new vscode.MarkdownString(`<table>`
        .concat(`<thead>${item.label}</thead><hr>`)
        // .concat(`<thead>${item.messageQueueLibrary}/${item.messageQueue}</thead><hr>`)
        .concat(`<tr><td>${l10n.t(`Message List Type:`)} </td><td>&nbsp;${l10n.t(String(item.type))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`List Text:`)} </td><td>&nbsp;${l10n.t(String(item.text === null ? '' : item.text))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Message Count:`)} </td><td>&nbsp;${l10n.t(String(item.messageCount ? item.messageCount : '0'))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Sorting:`)} </td><td>&nbsp;${l10n.t(String(item.sortDescription))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Filtering:`)} </td><td>&nbsp;${l10n.t(String(item.filterDescription))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Inquriy Mode:`)} </td><td>&nbsp;${l10n.t(String(item.inquiryMode))}</td></tr>`)
        .concat(`<tr><td>${l10n.t(`Read Only:`)} </td><td>&nbsp;${l10n.t(String(item.protected))}</td></tr>`)
      );
      item.tooltip.appendMarkdown(`<hr>`
        // .concat(`$(debug-alt) Debug Info: `${inDebugMode ? "${this.contextValueToDisplay}" : ""}`)
        .concat(`<tr><td>${l10n.t(`Context Value:`)} </td><td>&nbsp;${item.contextValue}</td></tr>`)
        .concat(`</table>`)
      );
      item.tooltip.supportHtml = true;

    } else if (item instanceof MessageQueueList) {
      if (item.messageType === 'INQUIRY' && !item.messageReply) {
        const msgReplies = await IBMiContentMsgq.getMessageReplies(`MSGQBrowser.resolveTreeItem`, [element.messageQueue], [element.messageQueueLibrary], element.messageKey);
        if (msgReplies.length > 0) {
          item.messageReply = msgReplies[0].messageReply;
          item.messageReplyUser = msgReplies[0].messageReplyUser;
          item.messageReplyJob = msgReplies[0].messageReplyJob;
          item.messageKeyAssociated = msgReplies[0].messageKey; // Keep message key of answer to message 
          item.updateIconPath();
        }
      }
      item.tooltip = new vscode.MarkdownString(`<table>`
        .concat(`<thead>${item.path.split(`/`)[2]}</thead><hr>`)
        .concat(item.messageQueue ? `<tr><td>${l10n.t(`Message Queue:`)} </td><td>&nbsp;${l10n.t(`${item.messageQueueLibrary}/${item.messageQueue}`)}</td></tr>` : ``)
        .concat(item.messageType ? `<tr><td>${l10n.t(`Message Type:`)} </td><td>&nbsp;${l10n.t(item.messageType)}</td></tr>` : ``)
        .concat(item.severity ? `<tr><td>${l10n.t(`Severity:`)} </td><td>&nbsp;${l10n.t(item.severity)}</td></tr>` : ``)
        .concat(item.messageTimestamp ? `<tr><td>${l10n.t(`Time Arrived:`)} </td><td>&nbsp;${l10n.t(item.messageTimestamp)}</td></tr>` : ``)
        .concat(item.messageKey ? `<tr><td>${l10n.t(`Key:`)} </td><td>&nbsp;${l10n.t(item.messageKey)}</td></tr>` : ``)
        .concat(item.fromUser ? `<tr><td>${l10n.t(`From User:`)} </td><td>&nbsp;${l10n.t(item.fromUser)}</td></tr>` : ``)
        .concat(item.fromJob ? `<tr><td>${l10n.t(`From Job:`)} </td><td>&nbsp;${l10n.t(item.fromJob)}</td></tr>` : ``)
        .concat(item.fromProgram ? `<tr><td>${l10n.t(`From Program:`)} </td><td>&nbsp;${l10n.t(item.fromProgram)}</td></tr>` : ``)
      );
      if (item.messageType === 'INQUIRY') {
        item.tooltip.appendMarkdown(``
          .concat(`<tr><td>${l10n.t(`Message Reply:`)} </td><td>&nbsp;${item.messageReply}</td></tr>`)
          .concat(`<tr><td>${l10n.t(`Message Reply User:`)} </td><td>&nbsp;${item.messageReplyUser}</td></tr>`)
          .concat(`<tr><td>${l10n.t(`Message Reply Job:`)} </td><td>&nbsp;${item.messageReplyJob}</td></tr>`)
        );
      }
      item.tooltip.appendMarkdown(`<hr>`
        .concat(`<tr><td>${l10n.t(`Context Value:`)} </td><td>&nbsp;${item.contextValue}</td></tr>`)
        .concat(`</table>`)
      );
      item.tooltip.supportHtml = true;
    }
    return item;
  }
}

export class MessageQueue extends vscode.TreeItem implements IBMiMessageQueue {
  protected: boolean;
  parent: vscode.TreeItem;
  messageQueue: string;
  messageQueueLibrary: string;
  text: string;
  type: string;
  filter: string | undefined; // reduces tree items to matching tokens
  filterDescription: string | undefined;
  inquiryMode: string;
  messageCount: number | undefined;
  readonly sort: SortOptions = { order: "date", ascending: true };
  sortDescription: string | undefined;
  constructor(parent: vscode.TreeItem, theMsgq: IBMiMessageQueue) {
    super(createNodeName(theMsgq), vscode.TreeItemCollapsibleState.Collapsed);
    this.messageQueue = theMsgq.messageQueue;
    this.messageQueueLibrary = theMsgq.messageQueueLibrary;
    this.type = theMsgq.type;
    const icon = this.setIcon(this.type);
    this.protected = theMsgq.protected ? theMsgq.protected : false;
    this.contextValue = `msgq${this.protected ? `_readonly` : ``}`;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.parent = parent;
    // this.iconPath = new vscode.ThemeIcon(this.protected ? `lock-small` : icon
    this.iconPath = new vscode.ThemeIcon(icon
      , (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));
    this.sortBy(this.sort);
    this.text = theMsgq.text || '';
    this.setDescription();
    this.setFilterDescription('');
    this.inquiryMode = '';
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
  getRecordCount() { return this.messageCount; }
  setFilter(filter: string | undefined) { this.filter = filter; }
  setInquiryMode(inquiryMode: string) { this.inquiryMode = inquiryMode; }
  setIcon(type: string): string {
    let choosenIcon = objectIcons[``];
    if (type === '*MSGQ') { choosenIcon = objectIcons[`msgq`]; }
    else if (type === '*USRPRF') { choosenIcon = objectIcons[`usrprf`]; }
    return choosenIcon;
  }
  setFilterDescription(value: string | undefined) { this.filterDescription = value; }
  setDescription() {
    this.description =
      (this.text ? this.text : '')
      + (this.filterDescription ? ` ` + this.filterDescription : ``)
      + (this.sortDescription ? ` ` + this.sortDescription : '');
  }
  setProtection(protect: boolean) { this.protected = protect; }
  setRecordCount(aNumber: number) { this.messageCount = aNumber; }
}
function createNodeName(theMsgq: IBMiMessageQueue) {
  let q = theMsgq.messageQueueLibrary + `/` + theMsgq.messageQueue;
  if (theMsgq.type === '*USRPRF') {
    q = theMsgq.type + '/' + q;
  }
  return q;
}

export class MessageQueueList extends vscode.TreeItem implements IBMiMessageQueueMessage {
  parent: MessageQueue;
  name: string;
  messageQueueLibrary: string;
  messageQueue: string;
  messageID: string;
  messageKey: string;
  messageText: string;
  messageType: string;
  protected: boolean;
  // messageSubType?: string;
  severity?: string;
  messageTimestamp?: string;
  messageKeyAssociated?: string;
  fromUser?: string;
  fromJob?: string;
  fromProgram?: string;
  // messageFileLibrary?: string;
  // messageFile?: string;
  // messageTokens?: string;
  // messageTextSecondLevel?: string;
  messageReply?: string;
  messageReplyUser?: string;
  messageReplyJob?: string;
  path: string;
  // icon: string;
  // iconColor: string;
  readonly sort: SortOptions = { order: "date", ascending: true };
  readonly sortBy: (sort: SortOptions) => void;
  readonly setDescription: () => void;
  private static nextId: number = 0; // Static and private counter
  private readonly myId: number; // Readonly ID for instances
  // public readonly id: string; 

  constructor(parent: MessageQueue, object: IBMiMessageQueueMessage) {

    super(`${object.messageID} - ${object.messageText}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    // this.myId = MessageQueueList.nextId++; // Assign and increment the ID
    this.myId = MessageQueueList.nextId++; // Assign and increment the ID
    this.parent = parent;
    if (object.messageID && object.messageID !== `null`) {
      this.messageID = object.messageID;
      this.name = this.messageID + ' - ' + object.messageText;
    } else {
      this.messageID = '';
      this.name = this.messageID + ' - ' + object.messageText;
    }
    this.resourceUri = getMessageDetailFileUri(parent.type, object, parent.protected ? { readonly: true } : undefined);
    this.protected = parent.protected;
    this.contextValue = `message${this.protected ? `_readonly` : ``}`;
    if (object.messageType === 'INQUIRY') {
      this.contextValue = this.contextValue.concat(`_INQUIRY`);
      if (!object.messageReply) {
        this.contextValue = this.contextValue.concat(`_UNANSWERED`);
      }
    }
    this.messageQueueLibrary = object.messageQueueLibrary || parent.messageQueueLibrary;
    this.messageQueue = object.messageQueue || parent.messageQueue;
    this.messageKey = object.messageKey || '';
    this.messageText = object.messageText;
    this.messageType = object.messageType || '';
    // this.messageSubType = object.messageSubType;
    this.severity = object.severity;
    this.messageTimestamp = object.messageTimestamp;
    this.messageKeyAssociated = object.messageKeyAssociated;
    this.fromUser = object.fromUser;
    this.fromJob = object.fromJob;
    this.fromProgram = object.fromProgram;
    // this.messageFileLibrary = object.messageFileLibrary;
    // this.messageFile = object.messageFile;
    // this.messageTokens = object.messageTokens;
    // this.messageTextSecondLevel = object.messageTextSecondLevel;
    this.messageReply = object.messageReply;
    this.messageReplyUser = object.messageReplyUser;
    this.messageReplyJob = object.messageReplyJob;
    this.path = this.resourceUri.path.substring(1); // removes leading slash for QSYS paths

    this.command = {
      command: `vscode-ibmi-fs.viewMessageDetails`,
      title: `Show Message Details`,
      arguments: [this]
    };
    this.updateIconPath();
    this.sortBy = (sort: SortOptions) => parent.sortBy(sort);
    this.setDescription = () => parent.setDescription();
  }
  setIcon(): string {
    let choosenIcon = '';
    if (this.messageType === 'INQUIRY') {
      if (this.messageReply) {
        choosenIcon = `pass-filled`;  // answered message (circle-filled-check)
      }
      else { choosenIcon = `question`; }
    }
    else {
      choosenIcon = this.protected ? `lock-small`
        : objectIcons[`${this.messageType === 'INQUIRY' ? 'inquiry' : 'msg'}`] || objectIcons[``];
    }
    return choosenIcon;
  }
  setIconColor(): string {
    let choosenColor = ``;
    if (!this.protected) {
      if (this.messageType === 'INQUIRY' && !this.messageReply) {
        choosenColor = `terminal.ansiYellow`;  // Unanswered message
      } else if (this.messageType === 'INQUIRY' && !this.messageReply) {
        choosenColor = `terminal.ansiGreen`;  // answered message
      } else {
        choosenColor = ``;
      }
    }
    else {
      choosenColor = ``;
    }
    return choosenColor;
  }
  updateIconPath() { this.iconPath = new vscode.ThemeIcon(this.setIcon(), new vscode.ThemeColor(this.setIconColor())); }
}
function lookupItemText(aMsgq: IBMiMessageQueueFilter, objAttributes: ObjAttributes[]): string {
  let index = 0;
  let theText = '';
  if (aMsgq.type === '*USRPRF') {
    index = objAttributes.findIndex(f => f.name === aMsgq.messageQueue);
    if (index >= 0) {
      theText = objAttributes[index].text;
    }
  } else {
    index = objAttributes.findIndex(f => (f.library === aMsgq.messageQueueLibrary || aMsgq.messageQueueLibrary === '*LIBL')
      && f.name === aMsgq.messageQueue);
    if (index >= 0) {
      theText = objAttributes[index].text;
      if (aMsgq.messageQueueLibrary === '*LIBL') { aMsgq.messageQueueLibrary = objAttributes[index].library; }
    }
  }
  return theText;
}
function lookupItemLockState(aMsgq: IBMiMessageQueueFilter, objLockStates: ObjLockState[]): boolean {
  let index = 0;
  let theLockState = true;
  if (aMsgq.type === '*USRPRF') {
    index = objLockStates.findIndex(f => f.objectType === aMsgq.type && f.name === aMsgq.messageQueue);
    if (index >= 0) {
      theLockState = objLockStates[index].lockState === '*EXCL' ? true : false;
    }
  } else {
    index = objLockStates.findIndex(f => (f.objectType === aMsgq.type
      && f.name === aMsgq.messageQueue
      && f.library === aMsgq.messageQueueLibrary || aMsgq.messageQueueLibrary === '*LIBL')
    );
    if (index >= 0) {
      theLockState = objLockStates[index].lockState === '*EXCL' ? true : false;
    }
  }
  return theLockState;
}
const lookupFilterType = (aMsgq: IBMiMessageQueueFilter): string => {
  if (!aMsgq.type || aMsgq.type === '') { aMsgq.type = '*MSGQ'; }
  return aMsgq.type;
};
const lookupLibraryValue = (aMsgq: IBMiMessageQueueFilter, objAttributes: ObjAttributes[]): string => {
  let theRealLibrary = aMsgq.messageQueueLibrary;
  if (aMsgq.type === '*MSGQ') {
    const index = objAttributes.findIndex(f => (f.library === aMsgq.messageQueueLibrary || aMsgq.messageQueueLibrary === '*LIBL')
      && f.name === aMsgq.messageQueue);
    if (index >= 0 && aMsgq.messageQueueLibrary === '*LIBL') { theRealLibrary = objAttributes[index].library; }
  }
  return theRealLibrary;
};