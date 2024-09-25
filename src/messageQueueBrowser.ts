/* eslint-disable @typescript-eslint/naming-convention */
import { FocusOptions, IBMiMessages } from '@halcyontech/vscode-ibmi-types/';
import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import vscode, { l10n, } from 'vscode';
import { MsgFS, getUriFromPath_Msg, parseFSOptions } from "../src/filesystem/qsys/Msgfs";
import { IBMiContentMsgq } from "./api/IBMiContentMsgq";
import { Code4i, findExistingDocumentUri, getInstance, makeid } from "./tools";
import { IBMiMessageQueue, IBMiMessageQueueViewItem, IBMiMessageQueueMessage, MsgOpenOptions } from './typings';
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
    vscode.workspace.registerFileSystemProvider(`messageQueue`, new MsgFS(context), {
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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, (node) => msgqBrowserObj.refresh(node)),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.revealMSGQBrowser`, async (item: vscode.TreeItem, options?: FocusOptions) => {
      msgqBrowserViewer.reveal(item, options);
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.addMessageQueueFilter`, async (node) => {
      const config = getConfig();
      const connection = getConnection();

      let filter ;
      let newMsgq :IBMiMessageQueue;

      let messageQueues :IBMiMessageQueue[] = config[`messageQueues`] || [];
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
            newMsgq = { messageQueueLibrary: `*LIBL` , messageQueue: filter };
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
      /** @type {ConnectionConfiguration.Parameters} */
      const config = getConfig();

      let messageQueues = config.messageQueues;

      try {

        messageQueues.sort(function (a: string, b: string): number {
          let x = a.toLowerCase();
          let y = b.toLowerCase();
          if (x < y) { return -1; }
          if (x > y) { return 1; }
          return 0;
        });
        config.messageQueues = messageQueues;
        getInstance()!.setConfig(config);
        vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node);
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessageQueueFilter`, async (node) => {
      const config = getConfig();

      let removeMsgq: string | undefined;
      let messageQueues :IBMiMessageQueue[] = config.messageQueues;
      let msgBoxList :string[] = [``];

      if (node) {
        removeMsgq = node.queueLibrary+'/'+node.queue;
      } else {
        // TODO: messageQueues need to be a simple array
        msgBoxList = messageQueues.map(o => (o.messageQueueLibrary+'/'+ o.messageQueue));
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

                // const inx = messageQueues.indexOf(removeMsgq);

                // const index = messageQueues.findIndex(f => f.name === filter.name);
                const index = -5;

                // if (index > -1) {
                //   config.objectFilters.splice(index, 1);
                //   await ConnectionConfiguration.update(config);
            
                // }

                if (index > -1) {
                  messageQueues.splice(index, 1);
                  config.messageQueues = messageQueues;
                  getInstance()!.setConfig(config);
                  vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node);
                }
              }
            });
        }
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessagesAll`, async (node) => {
      if (node) {
        //Running from right click
        let message = l10n.t(`Are you sure you want to delete ALL spooled files for user {0}?`, node.messageQueue);
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

            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node);
          } catch (e: unknown) {
            if (e instanceof Error) {
              vscode.window.showErrorMessage(l10n.t(`Error deleting user spooled file! {0}.`, e));
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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessage`, async (node) => {
      if (node) {
        const config = getConfig();
        //Running from right click

        const message = l10n.t('Are you sure you want to delete {0}?', node.path);
        const detail = undefined;
        let result = await vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`Cancel`));

        if (result === `Yes`) {

          const connection = getConnection();

          try {
            await connection.runCommand({
              command: `DLTMSG FILE(${node.name}) JOB(${node.jobNumber}/${node.jobUser}/${node.jobName}) SPLNBR(${node.number})`
              , environment: `ile`
            });

            vscode.window.showInformationMessage(l10n.t(`Deleted {0}.`, node.path));

            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node.parent);
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
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessagesNamed`, async (node) => {
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
            objects = await IBMiContentMsgq.getMessageQueueMessageList(node.msg, node.msgl, node.sort, node.parent.filter, node.messageID);
          }
          try {
            let commands = objects.map((o: any) => (
              `cl:RMVMSG MSGQ(${o.messageQueueLibrary}/${o.messageQueue}) MSGKEY(${o.messageKey}) CLEAR(*BYKEY);`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = commands.join(`\n`);
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(asp, tempLib, TempFileName, TempMbrName, dltCmdSrc);
            let dltCommands = `SBMJOB CMD(RUNSQLSTM SRCFILE(${tempLib}/${TempFileName}) SRCMBR(${TempMbrName}) COMMIT(*NC) MARGINS(*SRCFILE) OPTION(*NOLIST)) JOB(DLTSPLFS) JOBQ(QUSRNOMAX) MSGQ(*NONE)`
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
            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node.parent);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} messages.`, deleteCount));
            await connection.runCommand({
              command: `DLTF FILE(${tempLib}/${TempFileName}) `
              , environment: `ile`
            });
          }

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.deleteMessagesFiltered`, async (node) => {
      if (node) {
        //Running from right click
        let deleteCount = 0;
        let message = l10n.t(`Are you sure you want to delete ALL messages filtered by value {1}?`, node.name, node.parent.filter);
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
            objects = await IBMiContentMsgq.getMessageQueueMessageList(node.msg, node.msgl, node.sort, node.parent.filter, node.messageID);
          }
          try {
            let commands = objects.map((o: any) => (
              `cl:RCVMSG MSGQ(${o.name}) MSGTYPE(*ANY) MSGKEY(${o.msgKey});`
            ));
            deleteCount = commands.length;
            let dltCmdSrc = commands.join(`\n`);
            await connection.runCommand({
              command: `CRTSRCPF FILE(${tempLib}/${TempFileName}) MBR(${TempMbrName}) RCDLEN(112)`
              , environment: `ile`
            });
            await content.uploadMemberContent(asp, tempLib, TempFileName, TempMbrName, dltCmdSrc);
            let dltCommands = `SBMJOB CMD(RUNSQLSTM SRCFILE(${tempLib}/${TempFileName}) SRCMBR(${TempMbrName}) COMMIT(*NC) MARGINS(*SRCFILE) OPTION(*NOLIST)) JOB(RMVMSGS) JOBQ(QUSRNOMAX) MSGQ(*NONE)`
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
              vscode.window.showErrorMessage(l10n.t(`Error deleting user spooled file! {0}.`, e));
            }
          }
          if (deleteCount > 0) {
            node.parent.setFilter(``);
            vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node.parent);
            vscode.window.showInformationMessage(l10n.t(`Deleted {0} spooled files.`, deleteCount));
            await connection.runCommand({
              command: `DLTF FILE(${tempLib}/${TempFileName}) `
              , environment: `ile`
            });
          }

        }
        else {
          vscode.window.showInformationMessage(l10n.t('Deletion canceled.'));
        }
      } else {
        //Running from command.
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.filterMessageQueues`, async (node) => {
      const content = getContent();

      let searchMsgq: any;
      let searchMsgql: any;
      let searchTerm: any;
      if (node) {
        searchMsgq = node.messageQueue;
        searchMsgql = node.messageQueueLibrary;
      }

      if (!searchMsgq) { return; }

      searchTerm = await vscode.window.showInputBox({
        prompt: l10n.t(`Filter {0}'s spooled files. Delete value to clear filter.`, searchMsgq),
        value: `${node.contextValue === `message` ? node.parent.filter : node.filter}`
      });

      if (searchTerm) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Filtering list of spooled files`),
          }, async progress => {
            progress.report({
              message: l10n.t(`Filtering messages for {0}, using these words, {1} messages.`, searchMsgq, searchTerm),
            });
            searchTerm = searchTerm.toLocaleUpperCase();
            const splfnum = await IBMiContentMsgq.getMessageQueueCount(searchMsgq, searchMsgql);
            if (Number(splfnum) > 0) {
              if (node.contextValue === `message`) {
                node.parent.setFilter(searchTerm);
                vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node.parent);
              } else {
                node.setFilter(searchTerm);
                vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`, node);
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
        node.setFilter('');
        vscode.commands.executeCommand(`vscode-ibmi-msgqbrowser.refreshMSGQBrowser`);
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

    })

  );
  getInstance()?.subscribe(context, `connected`, "Refresh message queue browser", run_on_connection);
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
async function run_on_connection(): Promise<void> {
  // Promise.all([vscode.commands.executeCommand("code-for-ibmi.refreshMSGQBrowser")
  // ]);
}