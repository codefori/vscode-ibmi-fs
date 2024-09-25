import vscode, { l10n, } from 'vscode';
import { IBMiContentMsgq } from "./api/IBMiContentMsgq";
import { MessageQueueSearch } from './api/messageQueueSearch';
import { Code4i, getInstance } from "./tools";
import { UserMsgqSearchView } from './views/messageQueueSearchView';
// import setSearchResults from "@halcyontech/vscode-ibmi-types/instantiate";

interface SearchParms {
  messageQueue: string | undefined,
  messageQueueLibrary: string,
  term: string | undefined,
  word: string,
};


let userMsgqSearchViewProvider = <UserMsgqSearchView>{};
export async function initializeMessageQueueSearchView(context: vscode.ExtensionContext) {
  userMsgqSearchViewProvider = new UserMsgqSearchView(context);
  let search = <SearchParms>{};
  context.subscriptions.push(
    vscode.commands.registerCommand(`vscode-ibmi-msgqbrowser.searchMessageQueue`, async (node) => {
      //Initiate search from Spooled file item
      if (node && (/^message/.test(node.contextValue))) {
        search.messageQueue = node.messageQueue;
        search.messageQueueLibrary = node.messageQueueLibrary;
        search.word = node.parent.filter; // TODO: what does this represent??
      }//Initiate search from user filter
      else if (node && (/^msgq/.test(node.contextValue))) {
        search.messageQueue = node.messageQueue;
        search.messageQueueLibrary = node.messageQueueLibrary;
        search.word = node.filter; // TODO: what does this represent??
      }
      if (!search.messageQueue) {
        const config = getConfig();
        search.messageQueue = await vscode.window.showInputBox({
          placeHolder: `*LIBL/*MSGQ`,
          prompt: l10n.t(`Enter message queue to search over`),
          title: l10n.t(`Search messages`),
        });
      }
      
      
      if (search.messageQueue) {
        search.term = await vscode.window.showInputBox({
          prompt: l10n.t(`Search for string in messages in queue named {0}`, search.messageQueue)
        });
      } else {
        search.term = await vscode.window.showInputBox({
          prompt: l10n.t(`Search for string in *ALL XXXXXXX files`)
        });
      }


      if (search.term) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Searching`),
          }, async progress => {
            progress.report({
              message: l10n.t(`'{0}' in {1}, messages.`, search.term, search.messageQueue)
            });
            const msgqMsgNum = await IBMiContentMsgq.getMessageQueueCount(search.messageQueue, search.messageQueueLibrary);
            if (Number(msgqMsgNum) > 0) {
              // NOTE: if more messages are added, lower the timeout interval
              const timeoutInternal = 9000;
              const searchMessages = [
                l10n.t(`'{0}' in {1} messages.`, search.term, search.messageQueue),
                l10n.t(`This is taking a while because there are {0} message. Searching '{1}' in {2} still.`, msgqMsgNum, search.term, search.messageQueue),
                l10n.t(`What's so special about '{0}' anyway?`, search.term),
                l10n.t(`Still searching '{0}' in {1}...`, search.term, search.messageQueue),
                l10n.t(`Wow. This really is taking a while. Let's hope you get the result you want.`),
                l10n.t(`How does one end up with {0} messages.  Ever heard of cleaning up?`, msgqMsgNum),
                l10n.t(`'{0}' in {1}.`, search.term, search.messageQueue),
              ];
              let currentMessage = 0;
              const messageTimeout = setInterval(() => {
                if (currentMessage < searchMessages.length) {
                  progress.report({
                    message: searchMessages[currentMessage]
                  });
                  currentMessage++;
                } else {
                  clearInterval(messageTimeout);
                }
              }, timeoutInternal);
              let results = await MessageQueueSearch.searchMessageQueue(search.term, {messageQueue :search.messageQueue, messageQueueLibrary: search.messageQueueLibrary}
                                                                        , search.word);

              if (results.length > 0) {
                results.forEach(result => {
                  // if (objectNamesLower === true) {
                  //   result.path = result.path.toLowerCase();
                  // }
                  result.label = result.path;
                });
                results = results.sort((a, b) => {
                  return a.path.localeCompare(b.path);
                });
                setSearchResultsSplf(`searchUserMessage`, search.term, results);
                // setSearchResults(search.term, results.sort((a, b) => a.path.localeCompare(b.path)));

              } else {
                vscode.window.showInformationMessage(l10n.t(`No results found searching for '{0}' in {1}.`, search.term, search.name));
              }
            } else {
              vscode.window.showErrorMessage(l10n.t(`No spooled files to search.`));
            }
          });

        } catch (e) {
          console.log(e);
          vscode.window.showErrorMessage(l10n.t(`Error searching spooled files.`));
        }
      }

    }),
    vscode.window.registerTreeDataProvider(`userMsgqSearchView`, userMsgqSearchViewProvider),
  );
  getInstance()?.subscribe(context, `connected`, "Get temporary library", runOnConnection);
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

// let userMsgqSearchViewProvider = <UserMsgqSearchView>{};
export function setSearchResultsSplf(actionCommand: string, term: string, results: MessageQueueSearch.Result[]) {
  userMsgqSearchViewProvider.setResults(actionCommand, term, results);
}

async function runOnConnection(): Promise<void> {
  const library = Code4i.getTempLibrary();
}