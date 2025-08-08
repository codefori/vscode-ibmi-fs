/* eslint-disable @typescript-eslint/naming-convention */
import { FocusOptions } from '@halcyontech/vscode-ibmi-types/';
import vscode, { l10n, } from 'vscode';
import { UsrJobFS, getUriFromPathMsg, parseFSOptions } from "./filesystem/qsys/UsrJobFs";
import { IBMiContentJobs } from "./api/IBMiContentJobs";
import { Code4i, saveFilterValuesUserJobs } from "./tools";
import { IBMiUserJobsFilter, DspJobOpenOptions, IBMiUserJob } from './typings';
import UsrJobBrowser, { UserJob, UserList } from './views/userJobsView';

const userjobBrowserObj = new UsrJobBrowser();
const userjobBrowserViewer = vscode.window.createTreeView(
  `userJobBrowser`, {
  treeDataProvider: userjobBrowserObj,
  showCollapseAll: true,
  canSelectMany: true,
});
export function initializeUserJobBrowser(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    userjobBrowserViewer,
    vscode.workspace.registerFileSystemProvider(`usrjob`, new UsrJobFS(context), {
      isCaseSensitive: false
    }),
    // vscode.commands.registerCommand('vscode-ibmi-fs.');
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortUserJobsByID`, (node: UserList | UserJob) => {
      // NOTE: repeated calls will cause asc to desc change in order
      node.sortBy({ order: "name" });
      node.setDescription();
      if (node.contextValue === `message`) {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node.parent));
      }
      else {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node));
      }
      userjobBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortUserJobsByDate`, (node) => {
      // NOTE: repeated calls will cause asc to desc change in order
      node.sortBy({ order: "date" });
      node.setDescription();
      if (node.contextValue === `message`) {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node.parent));
      }
      else {
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQ`, (node));
      }
      userjobBrowserViewer.reveal(node, { expand: true });
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.refreshUserJobBrowser`, () => userjobBrowserObj.refresh()),
    vscode.commands.registerCommand(`vscode-ibmi-fs.refreshUserJobs`, (node) => userjobBrowserObj.refresh(node)),
    vscode.commands.registerCommand(`vscode-ibmi-fs.revealUserJobBrowser`, async (item: vscode.TreeItem, options?: FocusOptions) => {
      userjobBrowserViewer.reveal(item, options);
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.addUserJobFilter`, async (node) => {

      const newEntry = await vscode.window.showInputBox({
        title: l10n.t(`Select User To Show Jobs For.`),
        prompt: l10n.t(`Type only the user profile name`),
        placeHolder: `USERPROFILE`,
        value: Code4i.getConnection().currentUser
      });

      try {
        if (newEntry) {
          if (saveFilterValuesUserJobs({ user: newEntry })) { vscode.commands.executeCommand(`vscode-ibmi-fs.sortUserJobFilter`, node); }
        }
      } catch (e) {
        console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.sortUserJobFilter`, async (node) => {
      const config = Code4i.getConfig();
      let userJobs: IBMiUserJobsFilter[] = config[`userJobs`] || [];
      try {
        userJobs.sort((filter1, filter2) => {
          // const primarySort = filter1.user.toLowerCase().localeCompare(filter2.user.toLowerCase());

          // // If the primary sort results in a difference (not equal)
          // if (primarySort !== 0) {
          //   return primarySort;
          // }

          // // If the primary sort is equal (primarySort === 0), then sort by the second condition
          // // Assuming 'priority' is a number, for descending order
          return filter1.user.toLowerCase().localeCompare(filter2.user.toLowerCase());
        });
        config.userJobs = userJobs;
        Code4i.getInstance()!.setConfig(config);
        userjobBrowserObj.populateData(userJobs);
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobBrowser`);
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.removeUserJobFilter`, async (node) => {
      const config = Code4i.getConfig();

      let removeUserEntry: string | undefined;
      let userJobs: IBMiUserJobsFilter[] = config[`userJobs`] || [];
      let msgBoxList: string[] = [``];

      if (node) {
        removeUserEntry = node.user;
      } else {
        msgBoxList = userJobs.map(o => (o.user));
        removeUserEntry = await vscode.window.showQuickPick(msgBoxList, {
          placeHolder: l10n.t('Type filter name to remove'),
        });
      }

      try {
        if (removeUserEntry) {
          removeUserEntry = removeUserEntry.trim();
          let message = l10n.t(`Are you sure you want to delete the user jobs filter,'{0}'?`, removeUserEntry);
          let detail = ``;
          vscode.window.showWarningMessage(message, { modal: true, detail }, l10n.t(`Yes`), l10n.t(`No`))
            .then(async result => {
              if (result === l10n.t(`Yes`)) {

                const index = userJobs.findIndex(f => f.user === removeUserEntry);
                if (index > -1) {
                  const deletedItem = userJobs.splice(index, 1);
                  config.userJobs = userJobs;
                  Code4i.getInstance()!.setConfig(config);
                  userjobBrowserObj.populateData(Code4i.getConfig().userJobs);
                  vscode.commands.executeCommand(`vscode-ibmi-fs.refreshMSGQBrowser`);
                }
              }
            });
        }
      } catch (e) {
        // console.log(e);
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.filterUserJobsMSGW`, async (node: UserList) => {
      if (node.msgwMode === 'MSGW') {
        // node.setFilter(searchTerm);
        node.setMsgwMode(``);
        node.clearToolTip();
        node.setDescription();
        vscode.commands.executeCommand(`vscode-ibmi-fs.revealUserJobBrowser`, node, { expand: false, focus: true, select: true });
        vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobs`, node);

      } else {
        vscode.commands.executeCommand('vscode-ibmi-fs.filterUserJobs', node, 'MSGW');
      }
    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.filterUserJobs`, async (node, msgwMode?: string) => {

      let searchUser: any;
      let searchTerm: any;
      let searchSource: any;
      if (node instanceof UserList) {
        searchUser = node.user;
        searchSource = node.label;
      }
      if (node instanceof UserJob) {
        searchUser = node.parent.user;
        searchSource = node.parent.label;
      }

      if (!searchUser) { return; }

      if (!searchTerm && !msgwMode) {
        searchTerm = await vscode.window.showInputBox({
          prompt: l10n.t(`Filter {0}'s jobs. Delete value to clear filter.`, searchSource),
          value: `${/^userJobJob/.test(node.contextValue) ? node.parent.filter ? node.parent.filter : `` : node?.filter ? node?.filter : ``}`
        });
      }
      let userJobNum = 0;
      if (node && (/^userJobJob/.test(node.contextValue))) {
        userJobNum = node.parent.listCount;
      } else if (node && (/^userJobUser/.test(node.contextValue))) {
        userJobNum = node.listCount;
      }
      else {/* Do I even bother SQL counting? */

      }

      if (searchTerm || msgwMode) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Filtering list of user jobs`),
          }, async progress => {
            progress.report({
              message: l10n.t(`Filtering jobs for {0}, using these words, {1}.`, searchUser, searchTerm || msgwMode),
            });
            // searchTerm = searchTerm?.toLocaleUpperCase();

            if (!userJobNum || userJobNum === 0) {
              const treeFilter = { ...node };
              const userJobNumAnswer = await IBMiContentJobs.getUserJobCount(`vscode-ibmi-fs.filterUserJobs`, treeFilter, searchTerm, msgwMode);
              if (Number.isFinite(Number(userJobNumAnswer))) { userJobNum = Number(userJobNumAnswer); }
            }
            if (userJobNum > 0) {
              if (node.contextValue === `userJobJob`) {
                node.parent.setFilter(searchTerm);
                node.parent.setMsgwMode(msgwMode);
                node.parent.clearToolTip();
                node.parent.setFilterDescription(searchTerm ? searchTerm : msgwMode);
                node.parent.setDescription();
                vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobs`, node.parent);
              } else {
                node.setFilter(searchTerm);
                node.setMsgwMode(msgwMode);
                node.clearToolTip();
                node.setFilterDescription(searchTerm ? searchTerm : msgwMode);
                node.setDescription();
                // await userjobBrowserObj.getChildren(node);
                vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobs`, node);
                vscode.commands.executeCommand(`vscode-ibmi-fs.revealUserJobBrowser`, node, { expand: true, focus: true, select: true });
              }
            } else {
              vscode.window.showErrorMessage(l10n.t(`No user jobs to filter.`));
            }
          });

        } catch (e) {
          console.log(e);
          vscode.window.showErrorMessage(l10n.t(`Error filtering user jobs.`));
        }
      }
      else {
        if (node.filter) {
          node.setFilter(undefined);
          node.clearToolTip;
          vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobs`, node);
        }
        if (node.parent.filter) {
          node.parent.setFilter(undefined);
          node.parent.clearToolTip;
          vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobs`, node.parent);
        }
      }

    }),
    vscode.commands.registerCommand(`vscode-ibmi-fs.viewUserJobDetails`, async (item: UserJob, overrideMode?: DspJobOpenOptions) => {
      let options: DspJobOpenOptions = {};
      options.readonly = item.parent.protected;

      const uri = getUriFromPathMsg(item.path, options);
      const existingUri = Code4i.findExistingDocumentUri(uri);

      if (existingUri) {
        const existingOptions = parseFSOptions(existingUri);
        if (existingOptions.readonly !== options.readonly) {
          vscode.window.showWarningMessage(`The file is already opened in another mode //TODO: remove this comment.`);
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
    vscode.commands.registerCommand(`vscode-ibmi-fs.ReplyToUnansweredMessage`, async (node) => {
      const item = node as IBMiUserJob;
      try {
        if (!item.activeJobStatus && item.activeJobStatus === 'MSGW') {
          const userReply = await vscode.window.showInputBox({
            title: l10n.t(`What is your answer?`),
            prompt: l10n.t(`If no answer given then the reply *DFT is assumed.`),
            placeHolder: ``
          });

          if (userReply) {
            await vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: l10n.t(`Filtering list of user jobs`),
            }, async progress => {
              progress.report({ message: l10n.t(`Finding message for job to send reply to.`), });
              const msgwJobs = await IBMiContentJobs.getJobMessageWaitMessages(`vscode-ibmi-fs.ReplyToUnansweredMessage`, [item.jobName || '']);
              item.jobMessageKey = msgwJobs[0].jobMessageKey;
              item.jobMessageQueueLibrary = msgwJobs[0].jobMessageQueueLibrary;
              item.jobMessageQueueName = msgwJobs[0].jobMessageQueueName;
            });
            if (!await IBMiContentJobs.answerMessage(item, userReply)) {

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
  );
  Code4i.getInstance().subscribe(context, `connected`, "Refresh user job browser", run_on_connection);
  Code4i.getInstance().subscribe(context, `disconnected`, "Clear user job browser", run_on_disconnection);
}
function run_on_connection() {
  userjobBrowserObj.populateData(Code4i.getConfig().userJobs);
}
async function run_on_disconnection() {
  userjobBrowserObj.clearTree();
  vscode.commands.executeCommand(`vscode-ibmi-fs.refreshUserJobBrowser`);
}