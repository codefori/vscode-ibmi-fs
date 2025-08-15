import vscode, { l10n, } from 'vscode';
import { IBMiContentMsgq } from "./api/IBMiContentfs";
import { MessageQueueSearch } from './api/messageQueueSearch';
import { Code4i } from "./tools";
import { MsgqSearchView } from './views/messageQueueSearchView';
import { SearchParms } from './typings';
// import setSearchResults from "@halcyontech/vscode-ibmi-types/instantiate";

import { ConnectionProfile, Profile, ConnectionConfig, CustomVariable,  } from '@halcyontech/vscode-ibmi-types';
import type { Action  } from '@halcyontech/vscode-ibmi-types/api/types';
import { runAction } from '@halcyontech/vscode-ibmi-types/ui/actions';
const custVars: string[] = ['LMI_REL_IDLIBS', 'LMI_REL_IDLIB', 'REL', 'PCR', 'NUMPCR'];
const custVarActionCmd = 'CUSTVARVAL LMI_REL_IDLIBS(${IDLIBS|List of PDN libraries for PCR |}) LMI_REL_IDLIB(${IDLIB|A PDN library name for PCR |}) REL(${REL|Aldon Application Release|BASE,BASE30,CVTBASE,DEVBASE,D1CVT,D1DTS,D1SYS,D1WFI,D2CVT,D2DTS,D2SYS,D2WFI,EXITS,RIMS,SYSBASE,TEST}) PCR(${PCR|Text string of project ID in form of PCRXXXXXvv|PCR}) NUMPCR(${NUMPCR|PCR number for actions that need only the number in form of XXXXXvv|XXXXXvv})';

let userMsgqSearchViewProvider = <MsgqSearchView>{};
export async function initializeMessageQueueSearchView(context: vscode.ExtensionContext) {
  userMsgqSearchViewProvider = new MsgqSearchView(context);
  let search = <SearchParms>{};
  context.subscriptions.push(
    vscode.commands.registerCommand(`vscode-ibmi-fs.searchMessageQueue`, async (node) => {
      //Initiate search from message item
      if (node && (/^message/.test(node.contextValue))) {
        search.messageQueue = node.messageQueue;
        search.messageQueueLibrary = node.messageQueueLibrary;
        search.word = node.parent.filter; // TODO: what does this represent??
      }//Initiate search from message queue filter
      else if (node && (/^msgq/.test(node.contextValue))) {
        search.messageQueue = node.messageQueue;
        search.messageQueueLibrary = node.messageQueueLibrary;
        search.word = node.filter; // TODO: what does this represent??
      }
      if (!search.messageQueue) {
        const config = Code4i.getConfig();
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

      if (search && search.term) {
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: l10n.t(`Searching`),
          }, async progress => {
            progress.report({
              message: l10n.t(`'{0}' in {1}, messages.`, String(search.term), String(search.messageQueue))
            });
            const treeFilter = {...node};
            const msgqMsgNum = await IBMiContentMsgq.getMessageQueueCount(`vscode-ibmi-fs.searchMessageQueue`,treeFilter,node.filter, undefined, node.inquiryMode);
            if (Number(msgqMsgNum) > 0) {
              // NOTE: if more messages are added, lower the timeout interval
              const timeoutInternal = 9000;
              const searchMessages = [
                l10n.t(`'{0}' in {1} messages.`, String(search.term), String(search.messageQueue)),
                l10n.t(`This is taking a while because there are {0} message. Searching '{1}' in {2} still.`, msgqMsgNum, String(search.term), String(search.messageQueue)),
                l10n.t(`What's so special about '{0}' anyway?`, String(search.term)),
                l10n.t(`Still searching '{0}' in {1}...`, String(search.term), String(search.messageQueue)),
                l10n.t(`Wow. This really is taking a while. Let's hope you get the result you want.`),
                l10n.t(`How does one end up with {0} messages.  Ever heard of cleaning up?`, msgqMsgNum),
                l10n.t(`'{0}' in {1}.`, String(search.term), String(search.messageQueue)),
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
              let results = await MessageQueueSearch.searchMessageQueue(
                String(search.term),
                {
                  messageQueue: String(search.messageQueue),
                  messageQueueLibrary: String(search.messageQueueLibrary),
                  type: '*MSGQ'
                },
                search.word
              );

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
                setSearchResultsSplf(`searchUserMessage`, String(search.term), results);
                // setSearchResults(search.term, results.sort((a, b) => a.path.localeCompare(b.path)));

              } else {
                vscode.window.showInformationMessage(l10n.t(`No results found searching for '{0}' in {1}.`, String(search.term), String(search.messageQueue)));
              }
            } else {
              vscode.window.showErrorMessage(l10n.t(`No messages to search.`));
            }
          });

        } catch (e) {
          // console.log(e);
          vscode.window.showErrorMessage(l10n.t(`Error searching messages.`));
        }
      }

    }),
    vscode.window.registerTreeDataProvider(`MsgqSearchView`, userMsgqSearchViewProvider),
  );
  Code4i.getInstance()?.subscribe(context, `connected`, "Get temporary library", runOnConnection);
}


// let userMsgqSearchViewProvider = <MsgqSearchView>{};
export function setSearchResultsSplf(actionCommand: string, term: string, results: MessageQueueSearch.Result[]) {
  userMsgqSearchViewProvider.setResults(actionCommand, term, results);
}

async function runOnConnection(): Promise<void> {
  const library = Code4i.getTempLibrary();
}

async function selectConnectionProfiles(config?: ConnectionConfig): Promise<ConnectionProfile | undefined> {
  const storage = Code4i.getStorage();
  if (config && storage) {
    const chosenProfile = await getOrPickAvailableProfile(config.connectionProfiles);
    if (chosenProfile) {
      // vscode.window.showInformationMessage(l10n.t(`Switched to profile "{0}".`, chosenProfile.name));
      return chosenProfile;
    }
  }
  return undefined;
};
function assignProfile(fromProfile: ConnectionProfile, toProfile: ConnectionProfile) {
  toProfile.homeDirectory = fromProfile.homeDirectory;
  toProfile.currentLibrary = fromProfile.currentLibrary;
  toProfile.libraryList = fromProfile.libraryList;
  toProfile.objectFilters = fromProfile.objectFilters;
  toProfile.ifsShortcuts = fromProfile.ifsShortcuts;
  toProfile.customVariables = fromProfile.customVariables;
}

async function getOrPickAvailableProfile(availableProfiles: ConnectionProfile[], profileNode?: Profile): Promise<ConnectionProfile | undefined> {
  if (availableProfiles.length > 0) {
    if (profileNode) {
      return availableProfiles.find(profile => profile.name === profileNode.profile);
    }
    else {
      const items = availableProfiles.map(profile => {
        return {
          label: profile.name,
          profile: profile
        };
      });
      return (await vscode.window.showQuickPick(items))?.profile;
    }
  }
  else {
    vscode.window.showInformationMessage(`No profiles exist for this system.`);
  }
}