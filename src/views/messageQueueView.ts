
import { SortOptions } from '@halcyontech/vscode-ibmi-types/api/IBMiContent';
import vscode, { l10n, TreeDataProvider } from 'vscode';
import { Code4i } from '../tools';
import { IBMiContentMsgq } from "../api/IBMiContentMsgq";
import { IBMiMessageQueue, IBMiMessageQueueMessage, ObjAttributes } from '../typings';
import { getMessageDetailFileUri } from '../filesystem/qsys/MsgQFs';

//https://code.visualstudio.com/api/references/icons-in-labels
const objectIcons: Record<string, string> = {
  'msgq': 'symbol-folder',
  'msg': 'mail',
  'inquiry': 'question',
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
  async getChildren(element: any) {
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
            const objects = await IBMiContentMsgq.getMessageQueueMessageList(element.messageQueue, element.messageQueueLibrary
              , element.sort, element.filter
              , undefined, element.inquiryMode);
            items.push(...objects
              .map((object: IBMiMessageQueueMessage) => new MessageQueueList(element, object)));

          } catch (e: any) {
            console.log(e);
            vscode.window.showErrorMessage(e.message);
            items.push(new vscode.TreeItem(l10n.t(`Error loading messages for message queue {0}.`, element.messageQueueLibrary + '/' + element.messageQueue)));
          }
        case `MSG`:
          { }
          break;
        }

      } else if (config.messageQueues) {
        let cfgMessageQueues: IBMiMessageQueue[] = config.messageQueues;
        const filtereditems: IBMiMessageQueue[] = cfgMessageQueues.filter((item:any) => item.messageQueueLibrary !== `` || item.messageQueue !== ``);
        const distinctNames: string[] = [...new Set(filtereditems.map(item => item.messageQueue))];
        const distinctLibraries: string[] = [...new Set(filtereditems.map(item => item.messageQueueLibrary))];
        // const modifiedEntries: ObjAttributes[] = [];
        const objAttributes = await IBMiContentMsgq.getObjectText(distinctNames, distinctLibraries, ['*MSGQ']);
        const objLockStates = await IBMiContentMsgq.getObjectLocks(distinctNames, distinctLibraries,[ '*MSGQ']);
        const mappedMessageQueues: MessageQueue[] = cfgMessageQueues.map(
          (aMsgq: IBMiMessageQueue) => {
            let index = 0;
            index = objAttributes.findIndex(f => f.library === aMsgq.messageQueueLibrary && f.name === aMsgq.messageQueue);
            if (index > 0){
              aMsgq.text = objAttributes[index].text;
            }
            index = objLockStates.findIndex(f => f.library === aMsgq.messageQueueLibrary && f.name === aMsgq.messageQueue);
            if (index > 0){
              aMsgq.protected = objLockStates[index].lockState === '*EXCL' ?true:false;
            }
            const newMsgqObj = new MessageQueue(element, aMsgq);
            return newMsgqObj;
          }
        );
        items.push(...mappedMessageQueues);
      }
    }
    return Promise.all(items);
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
  async resolveTreeItem(item: MessageQueue | MessageQueueList, element: any, token: vscode.CancellationToken): Promise<vscode.TreeItem> {
    if (item instanceof MessageQueue) {
      const msgqNum = await IBMiContentMsgq.getMessageQueueCount(element.messageQueue, element.messageQueueLibrary, element.filter
        , undefined, element.inquiryMode);
      if (!item.text) {
        const objAttributes = await IBMiContentMsgq.getObjectText([element.messageQueue], [element.messageQueueLibrary], [`*MSGQ`]) || '';
        item.text = objAttributes[0].text;
        item.setDescription(item.text);
      }
      item.tooltip = ``
        .concat(item.description ? l10n.t(`Queue Text:\t  {0}`, item.description) : ``)
        .concat(msgqNum ? l10n.t(`\nMessage Count: {0}`, msgqNum) : ``)
        .concat(item.protected ? l10n.t(`\n\nRead Only:\t  {0}`, item.protected) : ``)
        ;
    } else if (item instanceof MessageQueueList) {
      const msgAttr = await IBMiContentMsgq.getMessageAttributes(element.messageQueue, element.messageQueueLibrary, element.messageKey);
      // item.messageType = item.messageType||msgAttr.messageType||'';
      // item.messageSubType = item.messageSubType||msgAttr.messageSubType;
      // item.severity = item.severity||msgAttr.severity;
      // item.messageTimestamp = item.messageTimestamp||msgAttr.messageTimestamp;
      // item.messageKeyAssociated = item.messageKeyAssociated||msgAttr.messageKeyAssociated;
      // item.fromUser = item.fromUser||msgAttr.fromUser;
      // item.fromJob = item.fromJob||msgAttr.fromJob;
      // item.fromProgram = item.fromProgram||msgAttr.fromProgram;
      // item.messageFileLibrary = item.messageFileLibrary||msgAttr.messageFileLibrary;
      // item.messageFile = item.messageFile||msgAttr.messageFile;
      // item.messageTokens = item.messageTokens||msgAttr.messageTokens;
      // item.messageTextSecondLevel = item.messageTextSecondLevel||msgAttr.messageTextSecondLevel;
      item.messageReply = item.messageReply || msgAttr.messageReply;
      item.messageReplyUser = item.messageReplyUser || msgAttr.messageReplyUser;
      item.messageReplyJob = item.messageReplyJob || msgAttr.messageReplyJob;
      item.setIcon();
      item.setIconColor();
      item.updateIconPath();
      item.tooltip = ``
        // .concat(msgAttr.messageType  ? l10n.t(`....+....0....+....0`,msgAttr.messageType):``)
        .concat(item.messageType ? l10n.t(`Message Type:\t{0}`, item.messageType) : ``)
        .concat(item.severity ? l10n.t(`\nSeverity:\t\t\t{0}`, item.severity) : ``)
        .concat(item.messageTimestamp ? l10n.t(`\nTime Arrived:\t\t{0}`, item.messageTimestamp) : ``)
        .concat(item.messageKey ? l10n.t(`\nKey:\t\t\t\t{0}`, item.messageKey) : ``)
        .concat(item.fromUser ? l10n.t(`\nFrom User:\t\t{0}`, item.fromUser) : ``)
        .concat(item.fromJob ? l10n.t(`\nFrom Job:\t\t{0}`, item.fromJob) : ``)
        .concat(item.fromProgram ? l10n.t(`\nFrom Program:\t{0}`, item.fromProgram) : ``)
        .concat(item.messageReply ? l10n.t(`\nMessage Reply:\t\t{0}`, item.messageReply) : `<< Unanswered >>`)
        .concat(item.messageReplyUser ? l10n.t(`\nMessage Reply User:\t{0}`, item.messageReplyUser) : ``)
        .concat(item.messageReplyJob ? l10n.t(`\nMessage Reply Job:\t\t{0}`, item.messageReplyJob) : ``)
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
  text: string;
  filter: string | undefined; // reduces tree items to matching tokens
  inquiryMode: string;
  readonly sort: SortOptions = { order: "date", ascending: true };
  sortDescription: string;
  constructor(parent: vscode.TreeItem, theMsgq: IBMiMessageQueue) {
    super(theMsgq.messageQueueLibrary + `/` + theMsgq.messageQueue, vscode.TreeItemCollapsibleState.Collapsed);
    this.messageQueue = theMsgq.messageQueue;
    this.messageQueueLibrary = theMsgq.messageQueueLibrary;
    const icon = objectIcons[`msgq`] || objectIcons[``];
    this.protected = theMsgq.protected ? theMsgq.protected : false;
    this.contextValue = `msgq${this.protected ? `_readonly` : ``}`;
    this.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
    this.parent = parent;
    this.iconPath = new vscode.ThemeIcon(this.protected ? `lock-small` : icon
      , (this.protected ? new vscode.ThemeColor(`list.errorForeground`) : undefined));
    this.sortDescription = this.sortBy(this.sort);
    this.text = theMsgq.text || '';
    this.description = (theMsgq.text ? theMsgq.text : ``) + this.sortDescription;
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
    return ` (sort: ${this.sort.order} ${this.sort.ascending ? `🔼` : `🔽`})`;
  }
  setProtection(protect: boolean) { this.protected = protect; }
  setFilter(filter: string | undefined) { this.filter = filter; }
  setInquiryMode(inquiryMode: string) { this.inquiryMode = inquiryMode; }
  clearToolTip() { this.tooltip = undefined; }
  setDescription(value: string | undefined) { this.description = (value ? value : ``) + this.sortDescription; }
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
  messageSubType?: string;
  severity?: string;
  messageTimestamp?: string;
  messageKeyAssociated?: string;
  fromUser?: string;
  fromJob?: string;
  fromProgram?: string;
  messageFileLibrary?: string;
  messageFile?: string;
  messageTokens?: string;
  messageTextSecondLevel?: string;
  messageReply?: string;
  messageReplyUser?: string;
  messageReplyJob?: string;
  // icon: string;
  // iconColor: string;
  readonly sort: SortOptions = { order: "date", ascending: true };
  readonly sortBy: (sort: SortOptions) => void;

  constructor(parent: MessageQueue, object: IBMiMessageQueueMessage) {

    super(`${object.messageID} - ${object.messageText}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;

    this.parent = parent;
    this.name = object.messageID + ' - ' + object.messageText;
    this.resourceUri = getMessageDetailFileUri(object, parent.protected ? { readonly: true } : undefined);
    this.protected = parent.protected;
    this.contextValue = `message${this.protected ? `_readonly` : ``}`;
    this.messageQueueLibrary = object.messageQueueLibrary || parent.messageQueueLibrary;
    this.messageQueue = object.messageQueue || parent.messageQueue;
    this.messageID = object.messageID || '';
    this.messageKey = object.messageKey || '';
    this.messageText = object.messageText;
    this.messageType = object.messageType || '';
    this.messageSubType = object.messageSubType;
    this.severity = object.severity;
    this.messageTimestamp = object.messageTimestamp;
    this.messageKeyAssociated = object.messageKeyAssociated;
    this.fromUser = object.fromUser;
    this.fromJob = object.fromJob;
    this.fromProgram = object.fromProgram;
    this.messageFileLibrary = object.messageFileLibrary;
    this.messageFile = object.messageFile;
    this.messageTokens = object.messageTokens;
    this.messageTextSecondLevel = object.messageTextSecondLevel;
    this.messageReply = object.messageReply;
    this.messageReplyUser = object.messageReplyUser;
    this.messageReplyJob = object.messageReplyJob;
    this.command = {
      command: `vscode.open`,
      title: `Show Message Details`,
      arguments: [this.resourceUri]
    };
    // this.iconColor = ``;
    // this.icon = objectIcons[`${object.messageType === 'INQUIRY' ? 'inquiry' : 'msg'}`] || objectIcons[``];
    // this.setIcon();
    // this.setIconColor();
    this.updateIconPath();
    // this.iconPath = new vscode.ThemeIcon(this.protected ? `lock-small` : icon, new vscode.ThemeColor(this.iconColor));
    this.sortBy = (sort: SortOptions) => parent.sortBy(sort);
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
      choosenColor = `terminal.ansiRed`;
    }
    return choosenColor;
  }
  updateIconPath() { this.iconPath = new vscode.ThemeIcon(this.setIcon(), new vscode.ThemeColor(this.setIconColor())); }
}