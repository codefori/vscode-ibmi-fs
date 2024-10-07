/* eslint-disable @typescript-eslint/naming-convention */
import { FocusOptions, IBMiMessages } from '@halcyontech/vscode-ibmi-types/';
import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import vscode, { l10n, } from 'vscode';
import { MsgFS, getUriFromPath_Msg, parseFSOptions } from "./filesystem/qsys/MsgQFs";
import { IBMiContentMsgq } from "./api/IBMiContentMsgq";
import { Code4i, findExistingDocumentUri, getInstance, makeid } from "./tools";
import { IBMiMessageQueue, IBMiMessageQueueViewItem, MsgOpenOptions, SearchParms } from './typings';
import MSGQBrowser, { MessageQueue, MessageQueueList } from './views/messageQueueView';

const writeFileAsync = util.promisify(fs.writeFile);

export function initializeMessageQueueBrowser(context: vscode.ExtensionContext) {
  const msgqBrowserObj = new MSGQBrowser(context);
  const msgqBrowserViewer = vscode.window.createTreeView(
    `msgqBrowser`, {
    treeDataProvider: msgqBrowserObj,
    showCollapseAll: true,
    canSelectMany: true,
  });
  context.subscriptions.push(
    msgqBrowserViewer,
    vscode.workspace.registerFileSystemProvider(`message`, new MsgFS(context), {
      isCaseSensitive: false
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.sortMessagesByID`, (node: MessageQueue | MessageQueueList) => {
      node.sortBy({ order: "name" });
      if (node.contextValue === `message`) {
        msgqBrowserObj.refresh(node.parent);
      }
      else {
        msgqBrowserObj.refresh(node);
      }
      msgqBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.sortMessageQueueByDate`, (node) => {
      node.sortBy({ order: "date" });
      if (node.contextValue === `message`) {
        msgqBrowserObj.refresh(node.parent);
      }
      else {
        msgqBrowserObj.refresh(node);
      }
      msgqBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, () => msgqBrowserObj.refresh()),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, (node) => msgqBrowserObj.refresh(node)),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.revealMSGQBrowser`, async (item: vscode.TreeItem, options?: FocusOptions) => {
      msgqBrowserViewer.reveal(item, options);
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.addMessageQueueFilter`, async (node) => {
      const config = getConfig();
      const connection = getConnection();

      let filter;
      let newMsgq: IBMiMessageQueue;

      let messageQueues: IBMiMessageQueue[] = config[`messageQueues`] || [];
      if (config.messageQueues) {
        messageQueues = config.messageQueues;
      }

      filter = await vscode.window.showInputBox({
        prompt: l10n.t(`Enter name of Message Queue (library optional)`),
        value: connection.currentUser
      });

      try {
        if (filter) {
          filter = filter.trim().toUpperCase().toUpperCase();
          const x: string[] = filter.split('/');
          if (x.length === 1) {
            newMsgq = { messageQueueLibrary: `*LIBL`, messageQueue: filter };
          }
          else {
            newMsgq = { messageQueue: x[1], messageQueueLibrary: x[0] };
          }

          if (!messageQueues.includes(newMsgq)) {
            messageQueues.push(newMsgq);
            config.messageQueues = messageQueues;
            getInstance()!.setConfig(config);
            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.sortMessageQueueFilter`, node);
          }
        }
      } catch (e) {
        console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.sortMessageQueueFilter`, async (node) => {
      const config = getConfig();
      let messageQueues: IBMiMessageQueue[] = config.messageQueues;
      try {
        // config.objectFilters.sort((filter1, filter2) => filter1.name.toLowerCase().localeCompare(filter2.name.toLowerCase()));
        // await ConnectionConfiguration.update(config);
        messageQueues.sort((filter1, filter2) => filter1.messageQueue.toLowerCase().localeCompare(filter2.messageQueue.toLowerCase()));
        config.messageQueues = messageQueues;
        getInstance()!.setConfig(config);
        vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`);
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.removeMessageQueueFilter`, async (node) => {
      const config = getConfig();

      let removeMsgq: string | undefined;
      let messageQueues: IBMiMessageQueue[] = config.messageQueues;
      let msgBoxList: string[] = [``];

      if (node) {
        removeMsgq = node.messageQueueLibrary + '/' + node.messageQueue;
      } else {
        // TODO: messageQueues need to be a simple array
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

                // const index = -5;
                // const inx = messageQueues.indexOf(removeMsgq);
                const index = messageQueues.findIndex(f => f.messageQueueLibrary + '/' + f.messageQueue === removeMsgq);
                if (index > -1) {
                  messageQueues.splice(index, 1);
                  config.messageQueues = messageQueues;
                  getInstance()!.setConfig(config);
                  vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`);
                }
              }
            });
        }
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.removeMessageAll`, async (node: MessageQueue) => {
      if (node) {
        //Running from right click
        let message = l10n.t(`Are you sure you want to delete ALL mesages for queue {0}?`, String(node.label));
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {

          const connection = getConnection();

          try {
            //TODO: Needs to have write access to QUEUE to remove message
            const commandResult = await connection.runCommand({
              command: `CLRMSGQ MSGQ(${node.messageQueue}) CLEAR(*ALL)`
              , environment: `ile`
            });
            if (commandResult) {
              // vscode.window.showInformationMessage(` ${commandResult.stdout}.`);
              if (commandResult.code === 0 || commandResult.code === null) {
              } else {
              }
            }

            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting ALL message queue messages! {0}.`, e));
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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessage`, async (node: MessageQueueList) => {
      if (node) {
        const config = getConfig();
        //Running from right click

        const message = l10n.t('Are you sure you want to delete {0}?', node.messageID + '- "' + node.messageText+'"');
        const detail = undefined;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`Cancel`));

        if (result === `Yes`) {

          const connection = getConnection();
          // const x = (10-node.messageQueue.length);
          // const x = 10;
          // const str = node.messageQueue.padEnd(x);
          // console.log(`${str} ::${str.length} :::${x}`);
          let cmd = `call QMHRMVM ('${node.messageQueue.padEnd(10)}${node.messageQueueLibrary}' ${node.messageKey} '*BYKEY' x'00000000')`;
          // let cmd: `RMVMSG MSGQ(${node.messageQueueLibrary + '/' + node.messageQueue}) MSGKEY(${node.messageKey}) CLEAR(*BYKEY)`;
          try {
            await connection.runCommand({
              command: cmd
              , environment: `ile`
            });

            vscode.window.showInformationMessage(l10n.t(`Deleted {0}.`, node.messageID + '-' + node.messageText));

            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessagesNamed`, async (node: MessageQueueList) => {
      if (node) {
        //Running from right click
        let deleteCount = 0;
        let message = l10n.t(`Are you sure you want to delete ALL messages with this ID {0}?`, node.messageID);
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {
          const connection = getConnection();
          const content = getContent();
          const TempFileName = makeid();
          const TempMbrName = makeid();
          const asp = ``;
          const tempLib = Code4i.getTempLibrary();
          let objects: IBMiMessageQueueViewItem[] = [];

          if (result === `Yes`) {
            objects = await IBMiContentMsgq.getMessageQueueMessageList(node.messageQueue, node.messageQueueLibrary, node.sort, undefined, node.messageID);
          }
          try {
            let commands = objects.map((o: any) => (
              `call QMHRMVM ('${o.messageQueue.padEnd(10)}${o.messageQueueLibrary}' ${o.messageKey} '*BYKEY' x'00000000')`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = `PGM\n`+commands.join(`\n`)+`\nENDPGM`;
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(asp, tempLib, TempFileName, TempMbrName, dltCmdSrc);
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
              }
            }

          }
          catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting user message! {0}.`, e));
            }
          }
          if (deleteCount > 0) {
            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} messages.`, deleteCount));
            await connection.runCommand({ command: `DLTF FILE(${tempLib}/${TempFileName}) ` , environment: `ile` });
            await connection.runCommand({ command: `DLTPGM PGM(${tempLib}/${TempMbrName}) ` , environment: `ile` });
          }

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessagesFiltered`, async (node: MessageQueueList) => {
      if (node) {
        //Running from right click
        let deleteCount = 0;
        let message = l10n.t(`Are you sure you want to delete ALL messages in {0} filtered by value {1}?`, String(node.parent.label), node.parent.filter ? node.parent.filter : ``);
        let detail = ``;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`));

        if (result === `Yes`) {
          const connection = getConnection();
          const content = getContent();
          const TempFileName = makeid();
          const TempMbrName = makeid();
          const asp = ``;
          const tempLib = Code4i.getTempLibrary();
          let objects: IBMiMessageQueueViewItem[] = [];

          if (result === `Yes`) {
            objects = await IBMiContentMsgq.getMessageQueueMessageList(node.messageQueue, node.messageQueueLibrary, node.sort, node.parent.filter);
          }
          try {
            let commands = objects.map((o: any) => (
              `call QMHRMVM ('${o.messageQueue.padEnd(10)}${o.messageQueueLibrary}' ${o.messageKey} '*BYKEY' x'00000000')`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = `PGM\n`+commands.join(`\n`)+`\nENDPGM`;
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(asp, tempLib, TempFileName, TempMbrName, dltCmdSrc);
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
              }
            }

          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting Filtered message queue messages! {0}.`, e));
            }
          }
          if (deleteCount > 0) {
            node.parent.setFilter(undefined);
            node.parent.setDescription(``); // turn off item description
            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} messages.`, deleteCount));
            await connection.runCommand({ command: `DLTF FILE(${tempLib}/${TempFileName}) ` , environment: `ile` });
            await connection.runCommand({ command: `DLTPGM PGM(${tempLib}/${TempMbrName}) ` , environment: `ile` });
          }

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.filterMessageQueue`, async (node) => {

      let searchMsgq: any;
      let searchMsgql: any;
      let searchTerm: any;
      if (node) {
        searchMsgq = node.messageQueue;
        searchMsgql = node.messageQueueLibrary;
      }

      if (!searchMsgq) { return; }

      searchTerm = await vscode.window.showInputBox({
        prompt: l10n.t(`Filter {0}'s messages. Delete value to clear filter.`, searchMsgql + '/' + searchMsgq),
        value: `${node.contextValue === `message` ? node.parent.filter ? node.parent.filter : `` : node?.filter ? node?.filter : ``}`
      });

      if (searchTerm) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Filtering list of messages`),
          }, async progress => {
            progress.report({
              message: l10n.t(`Filtering messages for {0}, using these words, {1} messages.`, searchMsgq, searchTerm),
            });
            searchTerm = searchTerm.toLocaleUpperCase();
            const msgqMsgNum = await IBMiContentMsgq.getMessageQueueCount(searchMsgq, searchMsgql);
            if (Number(msgqMsgNum) > 0) {
              if (node.contextValue === `message`) {
                node.parent.setFilter(searchTerm);
                node.parent.clearToolTip();
                node.parent.setDescription(`Filtered by: ${searchTerm}`);
                vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node.parent);
              } else {
                node.setFilter(searchTerm);
                node.clearToolTip();
                node.setDescription(`Filtered by: ${searchTerm}`);
                vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
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
        node.setFilter(undefined);
        node.clearToolTip;
        vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQ`, node);
      }

    }),
    vscode.commands.registerCommand("vscode-ibmi-msgqbrowser.openMessage", async (item, overrideMode?: MsgOpenOptions) => {
      let options: MsgOpenOptions = {};
      options.readonly = item.parent.protected;
      const uri = getUriFromPath_Msg(item.path, options); //TODO: need???
      const existingUri = findExistingDocumentUri(uri);

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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.searchMessageQueueBrowser`, async () => {
      vscode.commands.executeCommand('MSGQBrowser.focus');
      vscode.commands.executeCommand('list.find');
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.updateMessageQueueDescription`, async (item :IBMiMessageQueue|IBMiMessageQueueViewItem) => {
        // Find the MSGQBrowser object 
        // Check the values of the tree, update description la
        // vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refresh MSGQ`);
    }),

  );
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