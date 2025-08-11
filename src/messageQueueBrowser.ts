/* eslint-disable @typescript-eslint/naming-convention */
import { FocusOptions } from '@halcyontech/vscode-ibmi-types/';
import vscode, { l10n, } from 'vscode';
import { MsgqFS, getUriFromPathMsg, parseFSOptions } from './filesystem/qsys/MsgQFs';
import { IBMiContentMsgq, IBMiContentFS, sortObjectArrayByProperty } from "./api/IBMiContentfs";
import { Code4i, saveFilterValuesMessages } from './tools';
import { IBMiMessageQueue, IBMiMessageQueueFilter, IBMiMessageQueueMessage, MsgOpenOptions, SearchParms } from './typings';
import MSGQBrowser, { MessageQueue, MessageQueueList } from './views/messageQueueView';

const msgqBrowserObj = new MSGQBrowser();
const msgqBrowserViewer = vscode.window.createTreeView(
  `msgqBrowser`, {
  treeDataProvider: msgqBrowserObj,
  showCollapseAll: true,
  canSelectMany: true,
});
export function initializeMessageQueueBrowser(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    msgqBrowserViewer,
    vscode.workspace.registerFileSystemProvider(`message`, new MsgqFS(context), {
      isCaseSensitive: false
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortMessagesByID`, (node: MessageQueue | MessageQueueList) => {
      // NOTE: repeated calls will cause asc to desc change in order
      node.sortBy({ order: "name" });
      node.setDescription();
      if (node.contextValue === `message`) {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node.parent));
      }
      else {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node));
      }
      msgqBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortMessagesByDate`, (node) => {
      // NOTE: repeated calls will cause asc to desc change in order
      node.sortBy({ order: "date" });
      node.setDescription();
      if (node.contextValue === `message`) {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node.parent));
      }
      else {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node));
      }
      msgqBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.refreshMSGQBrowser`, () => msgqBrowserObj.refresh()),
    vscode.commands.registerCommand(`vscode-ibmi-fs.refreshMSGQ`, (node) => msgqBrowserObj.refresh(node)),
    vscode.commands.registerCommand(`vscode-ibmi-fs.revealMSGQBrowser`, async (item: vscode.TreeItem, options?: FocusOptions) => {
      msgqBrowserViewer.reveal(item, options);
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.addMessageQueueFilter`, async (node) => {

      let newEntry;
      let newFilter: IBMiMessageQueue;

      newEntry = await vscode.window.showInputBox({
        title: l10n.t(`MSGQ to show Messages`),
        prompt: l10n.t(`If no library given then assumed *LIBL.`),
        placeHolder: `Library/MSGQ`,
        value: Code4i.getConnection().currentUser
      });

      try {
        if (newEntry) {
          const newEntryParts = newEntry.trim().toLocaleUpperCase().split('/');
          if (newEntryParts.length === 1) {
            const objAttributes = await IBMiContentFS.getObjectText(newEntryParts, [`*LIBL`], ['*MSGQ']);
            newFilter = { messageQueueLibrary: objAttributes[0].library, messageQueue: newEntryParts[0], type: '*MSGQ' };
          }
          else {
            newFilter = { messageQueue: newEntryParts[1], messageQueueLibrary: newEntryParts[0], type: '*MSGQ' };
          }
          if (saveFilterValuesMessages(newFilter)) { vscode.commands.executeCommand(`vscode-ibmi-fs.sortMessageQueueFilter`, node); }
        }
      } catch (e) {
        console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.addUserMessageFilter`, async (node) => {

      let newEntry;
      let newFilter: IBMiMessageQueue;

      newEntry = await vscode.window.showInputBox({
        title: l10n.t(`Select User To Show Messages For.`),
        prompt: l10n.t(`If no library given then assumed *LIBL.`),
        placeHolder: `Library/USERPROFILE`,
        value: Code4i.getConnection().currentUser
      });

      try {
        if (newEntry) {
          const x: string[] = newEntry.trim().toLocaleUpperCase().split('/');
          if (x.length === 1) { // no library given
            const objAttributes = await IBMiContentFS.getObjectText([newEntry], [`*LIBL`], ['*USRPRF']);
            newFilter = { messageQueueLibrary: objAttributes[0].library, messageQueue: newEntry, type: '*USRPRF' };
          }
          else {
            newFilter = { messageQueue: x[1], messageQueueLibrary: x[0], type: '*USRPRF' };
          }
          if (saveFilterValuesMessages(newFilter)) { vscode.commands.executeCommand(`vscode-ibmi-fs.sortMessageQueueFilter`, node); }
        }
      } catch (e) {
        console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortMessageQueueFilter`, async (node) => {
      const config = Code4i.getConfig();
      let messageQueues: IBMiMessageQueueFilter[] = config[`messageQueues`] || [];
      try {
        messageQueues.sort((filter1, filter2) => {
          const primarySort = filter1.messageQueueLibrary.toLowerCase().localeCompare(filter2.messageQueueLibrary.toLowerCase());

          // If the primary sort results in a difference (not equal)
          if (primarySort !== 0) {
            return primarySort;
          }

          // If the primary sort is equal (primarySort === 0), then sort by the second condition
          // Assuming 'priority' is a number, for descending order
          return filter1.messageQueue.toLowerCase().localeCompare(filter2.messageQueue.toLowerCase());
        });
        config.messageQueues = messageQueues;
        Code4i.getInstance()!.setConfig(config);
        msgqBrowserObj.populateData(messageQueues);
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQBrowser`);
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.removeMessageQueueFilter`, async (node) => {
      const config = Code4i.getConfig();

      let removeMsgq: string | undefined;
      let messageQueues: IBMiMessageQueueFilter[] = config[`messageQueues`] || [];;
      let msgBoxList: string[] = [``];

      if (node) {
        removeMsgq = node.messageQueueLibrary + '/' + node.messageQueue;
      } else {
        msgBoxList = messageQueues.map(o => (o.messageQueueLibrary + '/' + o.messageQueue));
        removeMsgq = await vscode.window.showQuickPick(msgBoxList, {
          placeHolder: l10n.t('Type filter name to remove'),
        });
      }

      try {
        if (removeMsgq) {
          removeMsgq = removeMsgq.trim();
          let message = l10n.t(`Are you sure you want to delete the message queue filter,'{0}'?`, removeMsgq);
          let detail = ``;
          vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`))
            .then(async result => {
              if (result === l10n.t(`Yes`)) {

                const index = messageQueues.findIndex(f => f.messageQueueLibrary + '/' + f.messageQueue === removeMsgq);
                if (index > -1) {
                  const deletedItem = messageQueues.splice(index, 1);
                  config.messageQueues = messageQueues;
                  Code4i.getInstance()!.setConfig(config);
                  msgqBrowserObj.populateData(Code4i.getConfig().messageQueues);
                  vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQBrowser`);
                }
              }
            });
        }
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.deleteMessageAll`, async (node: MessageQueue) => {
      if (node) {
        if (node.protected) {
          vscode.window.showErrorMessage(l10n.t(`You dont have authority to remove messages from {0}.`, node.messageQueue));
          return;
        }
        //Running from right click
        let message = l10n.t(`Are you sure you want to delete ALL mesages for queue {0}?`, String(node.label));
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {

          const connection = Code4i.getConnection();

          try {
            //TODO: Needs to have write access to QUEUE to remove message
            const commandResult = await connection.runCommand({
              command: `CLRMSGQ MSGQ(${node.messageQueueLibrary}/${node.messageQueue}) CLEAR(*ALL)`
              , environment: `ile`
            });
            if (commandResult) {
              // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
              if (commandResult.code === 0 || commandResult.code === null) {
              } else {
              }
            }

            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node);
          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting ALL message queue messages! {0}.`, e));
            }
          }
          vscode.window.showInformationMessage(l10n.t(`All messsages for ${node.messageQueueLibrary}/${node.messageQueue}.`));
        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        vscode.window.showInformationMessage(l10n.t(`Remove All Messages, not performed! Use command from Message Queue Broswer.`));
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.deleteMessageAllButUnanswered`, async (node: MessageQueue) => {
      if (node) {
        if (node.protected) {
          vscode.window.showErrorMessage(l10n.t(`You dont have authority to remove messages from {0}.`, node.messageQueue));
          return;
        }
        //Running from right click
        let message = l10n.t(`Are you sure you want to delete ALL mesages except for unanswered for queue {0}?`, String(node.label));
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {

          const connection = Code4i.getConnection();

          try {
            //TODO: Needs to have write access to QUEUE to remove message
            const commandResult = await connection.runCommand({
              command: `CLRMSGQ MSGQ(${node.messageQueueLibrary}/${node.messageQueue}) CLEAR(*KEEPUNANS)`
              , environment: `ile`
            });
            if (commandResult) {
              // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
              if (commandResult.code === 0 || commandResult.code === null) {
              } else {
              }
            }

            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node);
          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting ALL message queue messages! {0}.`, e));
            }
          }

          vscode.window.showInformationMessage(l10n.t(`All messsages for ${node.messageQueueLibrary}/${node.messageQueue} remove exccept for unanswered messages.`));
        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        vscode.window.showInformationMessage(l10n.t(`Remove All Messages Except Unanswered, not performed! Use command from Message Queue Broswer.`));
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.deleteMessage`, async (node: MessageQueueList) => {
      if (node) {
        if (node.protected) {
          vscode.window.showErrorMessage(l10n.t(`You dont have authority to remove messages from {0}.`, node.messageQueue));
          return;
        }
        //Running from right click

        const message = l10n.t('Are you sure you want to delete message {0}?', node.messageID + '- "' + node.messageText + '"');
        const detail = undefined;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`Cancel`));

        if (result === `Yes`) {

          const connection = Code4i.getConnection();
          // const x = (10-node.messageQueue.length);
          // const x = 10;
          // const str = node.messageQueue.padEnd(x);
          // console.log(`${str} ::${str.length} :::${x}`);
          let cmd = `call QMHRMVM ('${node.messageQueue.padEnd(10)}${node.messageQueueLibrary}' x'${node.messageKey}' '*BYKEY' x'00000000')`;
          try {
            const cmdResults = await connection.runCommand({
              command: cmd
              , environment: `ile`
            });
            if (cmdResults.stderr.length > 0) {// report error
              vscode.window.showErrorMessage(l10n.t(`Error deleting message queue message! {0}.`, cmdResults.stderr));
            }
            else {
              vscode.window.showInformationMessage(l10n.t(`Deleted {0}.`, node.messageID + '-' + node.messageText));
              vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
            }
          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting message queue message! {0}.`, e));
            }
          }

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.deleteMessagesByID`, async (node: MessageQueueList) => {
      if (node) {
        if (node.protected) {
          vscode.window.showErrorMessage(l10n.t(`You dont have authority to remove messages from {0}.`, node.messageQueue));
          return;
        }
        //Running from right click
        let deleteCount = 0;
        let message = l10n.t(`Are you sure you want to delete ALL messages with this ID, {0}?`, node.messageID);
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {
          const connection = Code4i.getConnection();
          const content = Code4i.getContent();
          const TempFileName = Code4i.makeid();
          const TempMbrName = Code4i.makeid();
          const asp = ``;
          const tempLib = Code4i.getTempLibrary();
          let objects: IBMiMessageQueueMessage[] = [];
          const treeFilter = {
            messageQueueLibrary: node.messageQueueLibrary,
            messageQueue: node.messageQueue,
            type: node.parent.type,
            protected: node.parent.protected
          } as IBMiMessageQueue;

          if (result === `Yes`) {
            objects = await IBMiContentMsgq.getMessageQueueMessageList(`vscode-ibmi-fs.deleteMessagesByID`
              , treeFilter, undefined, node.messageID);
            objects = sortObjectArrayByProperty(objects, `messageTimestamp`, `asc`);
          }
          try {
            let commands = objects.map((o: any) => (
              `call QMHRMVM ('${o.messageQueue.padEnd(10)}${o.messageQueueLibrary}' x'${o.messageKey}' '*BYKEY' x'00000000')`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = `PGM\n` + commands.join(`\n`) + `\nENDPGM`;
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(tempLib, TempFileName, TempMbrName, dltCmdSrc);
            await connection.runCommand({
              command: `CRTCLPGM SRCFILE(${tempLib}/${TempFileName}) SRCMBR(${TempMbrName}) PGM(${tempLib}/${TempMbrName})`
              , environment: `ile`
            });
            let dltCommands = `CALL PGM(${tempLib}/${TempMbrName})`
              ;
            const commandResult = await connection.runCommand({
              command: dltCommands
              , environment: `ile`
            });
            if (commandResult) {
              if (commandResult.code === 0 || commandResult.code === null) {
                // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
              } else {
                vscode.window.showErrorMessage(` ${commandResult.stderr}.`);
                deleteCount = 0;
              }
            }

          }
          catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting user message! {0}.`, e));
            }
          }
          if (deleteCount > 0) {
            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} messages.`, deleteCount));
          }
          await connection.runCommand({ command: `DLTF FILE(${tempLib}/${TempFileName}) `, environment: `ile` });
          await connection.runCommand({ command: `DLTPGM PGM(${tempLib}/${TempMbrName}) `, environment: `ile` });

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.deleteMessagesFiltered`, async (node: MessageQueueList) => {
      if (node) {
        if (node.protected) {
          vscode.window.showErrorMessage(l10n.t(`You dont have authority to delete messages from {0}.`, node.messageQueue));
          return;
        }
        if (!(node.parent.filter||node.parent.inquiryMode)) {
          vscode.window.showErrorMessage(l10n.t(`No active filtering set messages for {0}. Unable to run command at this time.`, node.messageQueue));
          return;
        }
        //Running from right click
        let deleteCount = 0;
        let message = l10n.t(`Are you sure you want to delete ALL messages in {0} filtered by value {1}?`, String(node.parent.label), node.parent.filter ? node.parent.filter : `*N/A`);
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {
          const connection = Code4i.getConnection();
          const content = Code4i.getContent();
          const TempFileName = Code4i.makeid();
          const TempMbrName = Code4i.makeid();
          const tempLib = Code4i.getTempLibrary();
          let objects: IBMiMessageQueueMessage[] = [];
          const treeFilter = {
            messageQueueLibrary: node.messageQueueLibrary,
            messageQueue: node.messageQueue,
            type: node.parent.type,
            protected: node.parent.protected
          } as IBMiMessageQueue;

          if (result === `Yes`) {
            objects = await IBMiContentMsgq.getMessageQueueMessageList(`vscode-ibmi-fs.deleteMessagesFiltered`,
              treeFilter, node.parent.filter);
            objects = sortObjectArrayByProperty(objects, `messageTimestamp`, `asc`);
          }
          try {
            let commands = objects.map((o: any) => (
              `call QMHRMVM ('${o.messageQueue.padEnd(10)}${o.messageQueueLibrary}' x'${o.messageKey}' '*BYKEY' x'00000000')`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = `PGM\n` + commands.join(`\n`) + `\nENDPGM`;
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(tempLib, TempFileName, TempMbrName, dltCmdSrc);
            await connection.runCommand({
              command: `CRTCLPGM SRCFILE(${tempLib}/${TempFileName}) SRCMBR(${TempMbrName}) PGM(${tempLib}/${TempMbrName})`
              , environment: `ile`
            });
            let dltCommands = `CALL PGM(${tempLib}/${TempMbrName})`
              ;
            const commandResult = await connection.runCommand({
              command: dltCommands
              , environment: `ile`
            });
            if (commandResult) {
              // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
              if (commandResult.code === 0 || commandResult.code === null) {
              } else {
                vscode.window.showErrorMessage(` ${commandResult.stderr}.`);
                deleteCount = 0;
              }
            }

          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting Filtered message queue messages! {0}.`, e));
            }
          }
          if (deleteCount > 0) {
            node.parent.setFilter(undefined);
            node.parent.setDescription(); // turn off item description
            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} messages.`, deleteCount));
          }
          await connection.runCommand({ command: `DLTF FILE(${tempLib}/${TempFileName}) `, environment: `ile` });
          await connection.runCommand({ command: `DLTPGM PGM(${tempLib}/${TempMbrName}) `, environment: `ile` });

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.filterMessageQueueInquiry`, async (node: MessageQueue) => {
      if (node.inquiryMode === 'INQUIRY') {
        node.setInquiryMode(``);
        node.clearToolTip();
        node.setFilterDescription(node.filter);
        node.setDescription();
        vscode.commands.executeCommand(`vscode-ibmi-fs.revealMSGQBrowser`, node, { expand: false, focus: true, select: true });
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node);

      } else {
        vscode.commands.executeCommand('vscode-ibmi-fs.filterMessageQueue', node, 'INQUIRY');
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.filterMessageQueue`, async (node, inquiryMode?: string) => {

      let searchMsgq: any;
      let searchMsgqLibrary: any;
      let searchTerm: any;
      let searchSource: any;
      if (node instanceof MessageQueue) {
        searchMsgq = node.messageQueue;
        searchMsgqLibrary = node.messageQueueLibrary;
        searchSource = node.label;
      }
      if (node instanceof MessageQueueList) {
        searchMsgq = node.parent.messageQueue;
        searchMsgqLibrary = node.parent.messageQueueLibrary;
        searchSource = node.parent.label;
      }

      if (!searchMsgq) { return; }

      if (!searchTerm && !inquiryMode) {
        searchTerm = await vscode.window.showInputBox({
          prompt: l10n.t(`Filter {0}'s messages. Delete value to clear filter.`, searchSource),
          value: `${/^message/.test(node.contextValue) ? node.parent.filter ? node.parent.filter : `` : node?.filter ? node?.filter : ``}`
        });
      }
      let msgqMsgNum = 0;
      if (node && (/^message/.test(node.contextValue))) {
        msgqMsgNum = node.parent.messageCount;
      } else if (node && (/^msgq/.test(node.contextValue))) {
        msgqMsgNum = node.messageCount;
      }
      else {/* Do I even bother SQL counting? */

      }

      if (searchTerm || inquiryMode) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Filtering list of messages`),
          }, async progress => {
            progress.report({
              message: l10n.t(`Filtering messages for {0}, using these words, {1} messages.`, searchMsgq, searchTerm || inquiryMode),
            });
            // searchTerm = searchTerm?.toLocaleUpperCase();

            if (!msgqMsgNum || msgqMsgNum === 0) {
              const treeFilter = { ...node };
              const msgqMsgNumAnswer = await IBMiContentMsgq.getMessageQueueCount(`vscode-ibmi-fs.filterMessageQueue`, treeFilter, searchTerm, undefined, inquiryMode);
              if (Number.isFinite(Number(msgqMsgNumAnswer))) { msgqMsgNum = Number(msgqMsgNumAnswer); }
            }
            if (msgqMsgNum > 0) {
              if (node.contextValue === `message`) {
                node.parent.setFilter(searchTerm);
                node.parent.setInquiryMode(inquiryMode);
                node.parent.clearToolTip();
                node.parent.setFilterDescription(searchTerm ? searchTerm : inquiryMode);
                node.parent.setDescription();
                vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
              } else {
                node.setFilter(searchTerm);
                node.setInquiryMode(inquiryMode);
                node.clearToolTip();
                node.setFilterDescription(searchTerm ? searchTerm : inquiryMode);
                node.setDescription();
                // await msgqBrowserObj.getChildren(node);
                vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node);
                vscode.commands.executeCommand(`vscode-ibmi-fs.revealMSGQBrowser`, node, { expand: true, focus: true, select: true });
              }
            } else {
              vscode.window.showErrorMessage(l10n.t(`No messages to filter.`));
            }
          });

        } catch (e) {
          console.log(e);
          vscode.window.showErrorMessage(l10n.t(`Error filtering messages.`));
        }
      }
      else {
        if (node.filter) {
          node.setFilter(undefined);
          node.clearToolTip;
          vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node);
        }
        if (node.parent.filter) {
          node.parent.setFilter(undefined);
          node.parent.clearToolTip;
          vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
        }
      }

    }),
    vscode.commands.registerCommand("vscode-ibmi-fs.viewMessageDetails", async (item: MessageQueueList, overrideMode?: MsgOpenOptions) => {
      let options: MsgOpenOptions = {};
      options.readonly = item.parent.protected;
      const uri = getUriFromPathMsg(item.path, options);
      const existingUri = Code4i.findExistingDocumentUri(uri);

      if (existingUri) {
        const existingOptions = parseFSOptions(existingUri);
        if (existingOptions.readonly !== options.readonly) {
          vscode.window.showWarningMessage(`The file is already opened in another mode.`);
          vscode.window.showTextDocument(existingUri);
          return false;
        }
      }

      try {
        await vscode.commands.executeCommand(`vscode.open`, uri);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }

    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.searchMessageQueueBrowser`, async () => {
      vscode.commands.executeCommand('MSGQBrowser.focus');
      vscode.commands.executeCommand('list.find');
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.ReplyToUnansweredMessage`, async (node) => {
      const item = node as IBMiMessageQueueMessage;
      try {
        if (!item.messageReply && item.messageType === 'INQUIRY') {
          const userReply = await vscode.window.showInputBox({
            title: l10n.t(`What is your answer?`),
            prompt: l10n.t(`If no answer given then the reply *DFT is assumed.`),
            placeHolder: `${item.messageText}`
          });

          if (userReply) {
            if (!await IBMiContentMsgq.answerMessage(item, userReply)) {

            }
            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
          }
        } else {
          vscode.window.showInformationMessage(l10n.t(`Message not in a state to reply with an answer.`));
        }
      } catch (e: any) {
        console.log(e);
        vscode.window.showErrorMessage(l10n.t(`Error answering message! {0}.`, e));
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sendMessage`, async (node, inquiry: boolean = false) => {
      const item = node as IBMiMessageQueue;
      try {
        const userReply = await vscode.window.showInputBox({
          title: l10n.t(`Sending Messages to Others`),
          prompt: l10n.t(`Type your message to {0}`, item.messageQueue),
          placeHolder: `What's on your mind?`
        });

        if (userReply) {
          if (!await IBMiContentMsgq.sendMessage(item, userReply, inquiry)) {

          }
          if (node.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
            vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, node.parent);
          }
        }
      } catch (e: any) {
        console.log(e);
        vscode.window.showErrorMessage(l10n.t(`Error answering message! {0}.`, e));
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sendInquiryMessage`, async (node) => {
      vscode.commands.executeCommand(`vscode-ibmi-fs.sendMessage`, node, true);
    }),

  );
  Code4i.getInstance().subscribe(context, `connected`, "Refresh message queue browser", run_on_connection);
  Code4i.getInstance().subscribe(context, `disconnected`, "clear message queue browser", run_on_disconnection);
}
function run_on_connection() {
  msgqBrowserObj.populateData(Code4i.getConfig().messageQueues);
}
async function run_on_disconnection() {
  msgqBrowserObj.clearTree();
  vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQBrowser`);
}