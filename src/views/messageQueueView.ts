
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
            const distinctNames: string[] = [...new Set(objects.map(item => item.messageQueue || ''))];
            const distinctLibraries: string[] = [...new Set(objects.map(item => item.messageQueueLibrary || ''))];
            const msgReplies = await IBMiContentMsgq.getMessageReplies(distinctNames, distinctLibraries);
            items.push(...objects.map((object: IBMiMessageQueueMessage) => {
              let index = 0;
              index = msgReplies.findIndex(f => (f.messageKeyAssociated === object.messageKey));
              if (index >= 0) {
                object.messageKeyAssociated = msgReplies[index].messageKey; // Associate to INQUIRY message its answer
                object.messageReply = msgReplies[index].messageReply;
                object.messageReplyUser = msgReplies[index].messageReplyUser;
                object.messageReplyJob = msgReplies[index].messageReplyJob;
              }
              const messageItem = new MessageQueueList(element, object);
              return messageItem;
            })
            );

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
        const filtereditems: IBMiMessageQueue[] = cfgMessageQueues.filter((item: any) => item.messageQueueLibrary !== `` || item.messageQueue !== ``);
        const distinctNames: string[] = [...new Set(filtereditems.map(item => item.messageQueue))];
        const distinctLibraries: string[] = [...new Set(filtereditems.map(item => item.messageQueueLibrary))];
        const objAttributes = await IBMiContentMsgq.getObjectText(distinctNames, distinctLibraries, ['*MSGQ']);
        const objLockStates = await IBMiContentMsgq.getObjectLocks(distinctNames, distinctLibraries, ['*MSGQ']);
        const mappedMessageQueues: MessageQueue[] = cfgMessageQueues.map(
          (aMsgq: IBMiMessageQueue) => {
            let index = 0;
            index = objAttributes.findIndex(f => (f.library === aMsgq.messageQueueLibrary || aMsgq.messageQueueLibrary === '*LIBL')
              && f.name === aMsgq.messageQueue);
            if (index >= 0) {
              aMsgq.text = objAttributes[index].text;
            }
            index = objLockStates.findIndex(f => (f.library === aMsgq.messageQueueLibrary || aMsgq.messageQueueLibrary === '*LIBL')
              && f.name === aMsgq.messageQueue);
            if (index >= 0) {
              aMsgq.protected = objLockStates[index].lockState === '*EXCL' ? true : false;
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
      item.tooltip = ``
        .concat(item.description ? l10n.t(`Queue Text:\t  {0}`, item.description) : ``)
        .concat(msgqNum ? l10n.t(`\nMessage Count: {0}`, msgqNum) : ``)
        .concat(item.protected ? l10n.t(`\n\nRead Only:\t  {0}`, item.protected) : ``)
        ;
      if (!item.text) {
        const objAttributes = await IBMiContentMsgq.getObjectText([element.messageQueue], [element.messageQueueLibrary], [`*MSGQ`]) || '';
        item.text = objAttributes[0].text;
        item.setDescription(item.text);
      }
      item.tooltip = ``
        .concat(item.description ? l10n.t(`Queue Text:\t  {0}`, item.description) : ``)
        .concat(msgqNum ? l10n.t(`\nMessage Count: {0}`, msgqNum) : ``)
        .concat(l10n.t(`\n\nRead Only:\t  {0}`, item.protected))
        ;
    } else if (item instanceof MessageQueueList) {
      if (!item.messageReply) {
        const msgReplies = await IBMiContentMsgq.getMessageReplies([element.messageQueue], [element.messageQueueLibrary], element.messageKey);
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
        .concat(item.messageType      ? `<tr><td>${l10n.t(`Message Type:`)} </td><td>&nbsp;${item.messageType}</td></tr>` : ``)
        .concat(item.severity         ? `<tr><td>${l10n.t(`Severity:`    )} </td><td>&nbsp;${item.severity}</td></tr>` : ``)
        .concat(item.messageTimestamp ? `<tr><td>${l10n.t(`Time Arrived:`)} </td><td>&nbsp;${item.messageTimestamp}</td></tr>` : ``)
        .concat(item.messageKey       ? `<tr><td>${l10n.t(`Key:`         )} </td><td>&nbsp;${item.messageKey}</td></tr>` : ``)
        .concat(item.fromUser         ? `<tr><td>${l10n.t(`From User:`   )} </td><td>&nbsp;${item.fromUser}</td></tr>` : ``)
        .concat(item.fromJob          ? `<tr><td>${l10n.t(`From Job:`    )} </td><td>&nbsp;${item.fromJob}</td></tr>` : ``)
        .concat(item.fromProgram      ? `<tr><td>${l10n.t(`From Program:`)} </td><td>&nbsp;${item.fromProgram}</td></tr>` : ``)
      );
      if (item.messageType === 'INQUIRY') {
        item.tooltip.appendMarkdown(``
          .concat(`<tr><td>${l10n.t(`Message Reply:`     )} </td><td>&nbsp;${item.messageReply    }</td></tr>`)
          .concat(`<tr><td>${l10n.t(`Message Reply User:`)} </td><td>&nbsp;${item.messageReplyUser}</td></tr>`)
          .concat(`<tr><td>${l10n.t(`Message Reply Job:` )} </td><td>&nbsp;${item.messageReplyJob }</td></tr>`)
        );
      }
      item.tooltip.appendMarkdown(``
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
  private static nextId: number = 0; // Static and private counter
  private readonly myId: number; // Readonly ID for instances
  // public readonly id: string; 

  constructor(parent: MessageQueue, object: IBMiMessageQueueMessage) {

    super(`${object.messageID} - ${object.messageText}`, vscode.TreeItemCollapsibleState.Collapsed);
    this.collapsibleState = vscode.TreeItemCollapsibleState.None;
    // this.myId = MessageQueueList.nextId++; // Assign and increment the ID
    this.myId = MessageQueueList.nextId++; // Assign and increment the ID
    this.parent = parent;
    if (object.messageID === `null`) {
      this.messageID = object.messageID;
      this.name = this.messageID + ' - ' + object.messageText;
    } else {
      this.messageID = '';
      this.name = this.messageID + ' - ' + object.messageText;
    }
    this.resourceUri = getMessageDetailFileUri(object, parent.protected ? { readonly: true } : undefined);
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