// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { DataQueueActions } from './types/dataQueue';
import { SaveFileActions } from './types/saveFile';
import { loadBase } from './ibmi';
import { DataAreaActions } from './types/dataArea';
import { JobQueueActions } from './types/jobQueue';
import { OutputQueueActions } from './types/outputQueue';
import { UserSpaceActions } from './types/userSpace';
import { BindingDirectoryActions } from './types/bindingDirectory';
import { JournalActions } from './types/journal';
import { SubsystemActions } from './types/subsystemDescription';
import { MessageQueueActions } from './types/messageQueue';
import { FileActions } from './types/file';
import { UserIndexActions } from './types/userIndex';
import { DspobjActions } from './dspobj';
import { WrksplfActions } from './views/wrksplf';
import { DocumentManager } from './documentManager';

/**
 * Extension activation function
 * This method is called when the extension is activated for the first time
 * @param context - The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Load the base IBM i extension
  loadBase();

  // Register the document manager
  DocumentManager.register(context);

  // Register the custom editor provider for IBM i file system objects
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(`vscode-ibmi-fs.editor`, new ObjectProvider(), {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  SaveFileActions.register(context);
  DataQueueActions.register(context);
  DataAreaActions.register(context);
  JobQueueActions.register(context);
  OutputQueueActions.register(context);
  UserSpaceActions.register(context);
  BindingDirectoryActions.register(context);
  JournalActions.register(context);
  SubsystemActions.register(context);
  MessageQueueActions.register(context);
  FileActions.register(context);
  UserIndexActions.register(context);
  DspobjActions.register(context);
  WrksplfActions.register(context);

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.refreshObject', async () => {
      // Get the active custom editor URI from the tab
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab?.input) {
        const input = activeTab.input as any;
        if (input.uri) {
          await ObjectProvider.refreshDocument(input.uri);
          vscode.window.showInformationMessage(vscode.l10n.t('Object refreshed successfully'));
        }
      }
    })
  );

  // Register object actions menu command
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.showObjectActions', async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!activeTab?.input) {
        return;
      }

      const input = activeTab.input as any;
      const uri = input.uri as vscode.Uri;
      if (!uri) {
        return;
      }

      // Determine object type from URI
      const ext = uri.path.split('.').pop()?.toUpperCase();
      const fragment = uri.fragment?.toUpperCase();
      
      // Build actions list based on object type
      const actions: { label: string; command: string; icon?: string }[] = [];

      switch (ext) {
        case 'DTAQ':
          actions.push(
            { label: vscode.l10n.t('Send data to Data Queue'), command: 'vscode-ibmi-fs.sendToDataQueue', icon: '$(mail)' },
            { label: vscode.l10n.t('Clear Data Queue'), command: 'vscode-ibmi-fs.clearDataQueue', icon: '$(trash)' }
          );
          break;

        case 'FILE':
          if (fragment === 'SAVF') {
            actions.push(
              { label: vscode.l10n.t('Download Save File'), command: 'vscode-ibmi-fs.downloadSavf', icon: '$(cloud-download)' },
              { label: vscode.l10n.t('Upload Save File'), command: 'vscode-ibmi-fs.uploadSavf', icon: '$(cloud-upload)' },
              { label: vscode.l10n.t('Save to Save File'), command: 'vscode-ibmi-fs.savf', icon: '$(save)' },
              { label: vscode.l10n.t('Restore from Save File'), command: 'vscode-ibmi-fs.restore', icon: '$(issue-reopened)' },
              { label: vscode.l10n.t('Clear Save File'), command: 'vscode-ibmi-fs.clearSavf', icon: '$(trash)' }
            );
          } else if (fragment === 'PF' || fragment === 'LF') {
            actions.push(
              { label: vscode.l10n.t('Query file'), command: 'vscode-ibmi-fs.QueryFile', icon: '$(file-code)' }
            );
          }
          break;

        case 'JOBQ':
          actions.push(
            { label: vscode.l10n.t('Hold Job Queue'), command: 'vscode-ibmi-fs.HldJobq', icon: '$(primitive-square)' },
            { label: vscode.l10n.t('Release Job Queue'), command: 'vscode-ibmi-fs.RlsJobq', icon: '$(play)' },
            { label: vscode.l10n.t('Clear Job Queue'), command: 'vscode-ibmi-fs.ClrJobq', icon: '$(trash)' }
          );
          break;

        case 'OUTQ':
          actions.push(
            { label: vscode.l10n.t('Hold Output Queue'), command: 'vscode-ibmi-fs.HldOutq', icon: '$(primitive-square)' },
            { label: vscode.l10n.t('Release Output Queue'), command: 'vscode-ibmi-fs.RlsOutq', icon: '$(play)' },
            { label: vscode.l10n.t('Clear Output Queue'), command: 'vscode-ibmi-fs.ClrOutq', icon: '$(trash)' },
            { label: vscode.l10n.t('Delete old spools'), command: 'vscode-ibmi-fs.DelOldSpool', icon: '$(calendar)' },
            { label: vscode.l10n.t('Manage Writer'), command: 'vscode-ibmi-fs.MngWtr', icon: '$(debug-disconnect)' }
          );
          break;

        case 'DTAARA':
          actions.push(
            { label: vscode.l10n.t('Change DTAARA'), command: 'vscode-ibmi-fs.ChgDtaara', icon: '$(edit)' }
          );
          break;

        case 'USRSPC':
          actions.push(
            { label: vscode.l10n.t('Change USRSPC'), command: 'vscode-ibmi-fs.chgUsrspc', icon: '$(edit)' }
          );
          break;

        case 'BNDDIR':
          actions.push(
            { label: vscode.l10n.t('Add Binding Directory Entry'), command: 'vscode-ibmi-fs.Addbnddire', icon: '$(plus)' }
          );
          break;

        case 'JRN':
          actions.push(
            { label: vscode.l10n.t('Generate new Journal Receiver'), command: 'vscode-ibmi-fs.GenJrnRcv', icon: '$(git-pull-request-new-changes)' },
            { label: vscode.l10n.t('Display Journal'), command: 'vscode-ibmi-fs.DspJrn', icon: '$(file-code)' }
          );
          break;

        case 'SBSD':
          actions.push(
            { label: vscode.l10n.t('Start Subsystem'), command: 'vscode-ibmi-fs.StrSbs', icon: '$(play)' },
            { label: vscode.l10n.t('End Subsystem'), command: 'vscode-ibmi-fs.EndSbs', icon: '$(primitive-square)' }
          );
          break;

        case 'MSGQ':
          actions.push(
            { label: vscode.l10n.t('Send Message to Message Queue'), command: 'vscode-ibmi-fs.sendToMessageQueue', icon: '$(mail)' },
            { label: vscode.l10n.t('Clear Message Queue'), command: 'vscode-ibmi-fs.clearMessageQueue', icon: '$(trash)' }
          );
          break;

        case 'USRIDX':
          actions.push(
            { label: vscode.l10n.t('Add User Index Entry'), command: 'vscode-ibmi-fs.AddUsridxEntry', icon: '$(plus)' },
            { label: vscode.l10n.t('Remove User Index Entry'), command: 'vscode-ibmi-fs.RmvUsridxEntry', icon: '$(trash)' }
          );
          break;
      }

      if (actions.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No actions available for this object type'));
        return;
      }

      // Show quick pick menu
      const selected = await vscode.window.showQuickPick(
        actions.map(a => ({
          label: a.icon ? `${a.icon} ${a.label}` : a.label,
          command: a.command
        })),
        {
          placeHolder: vscode.l10n.t('Select an action')
        }
      );

      if (selected) {
        // Execute the command with the URI as parameter
        await vscode.commands.executeCommand(selected.command, uri);
      }
    })
  );

  // === FS Quick Start Status Bar ===
  const fsActionsStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  fsActionsStatusBar.text = "$(tools) FS Quick Start";
  fsActionsStatusBar.tooltip = "IBM i FS Quick Start";
  fsActionsStatusBar.command = "vscode-ibmi-fs.showFsActionsMenu";
  fsActionsStatusBar.show();
  context.subscriptions.push(fsActionsStatusBar);

  // Command to show the FS Quick Start menu
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.showFsActionsMenu', async () => {
      const action = await vscode.window.showQuickPick(
        [
          { label: 'WRKJOB', description: 'Work with Job', command: 'vscode-ibmi-fs.wrkjob' },
          { label: '$(output-view-icon) WRKSPLF', description: 'Work with Spooled Files', command: 'vscode-ibmi-fs.wrksplf' },
          { label: '$(chat-editor-label-icon) DSPMSG QSYSOPR', description: 'Display System Operator Messages', command: 'vscode-ibmi-fs.dspmsgQsysopr' },
          { label: '$(extensions-info-message) DSPOBJ', description: 'Display Object Information', command: 'vscode-ibmi-fs.dspobj' },
          { label: '$(search-view-icon) DSPOBJ Detailed', description: 'Display Object Information (single input)', command: 'vscode-ibmi-fs.dspobjDetailed' }
        ],
        { placeHolder: 'Select an FS action' }
      );

      if (action) {
        vscode.commands.executeCommand(action.command);
      }
    })
  );

  // WRKJOB Command - Example of read-only output with working search
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.wrkjob', async () => {
      // Create the content
      const output = [
        '╔════════════════════════════════════════════════════════════╗',
        '║           Work with Job - Example                         ║',
        '╚════════════════════════════════════════════════════════════╝',
        '',
        'Hello world!',
        '',
        'This is an example of read-only display.',
        'The content is static and cannot be modified.',
        '',
        '💡 Tip: Press Ctrl+F (Cmd+F on Mac) to search in the text',
        '',
        '────────────────────────────────────────────────────────────',
        'Command output:',
        '────────────────────────────────────────────────────────────',
        '',
        'Hello world!',
        'This is a read-only tab.',
        'You cannot modify this text.',
        '',
        'Try searching for the word "world" or "read-only".',
        'The search function is fully enabled!',
        '',
        'You can also search for:',
        '  - "hello"',
        '  - "example"',
        '  - "command"',
        '  - any other word present in this document',
        '',
        '════════════════════════════════════════════════════════════',
        'End of document',
        '════════════════════════════════════════════════════════════'
      ];

      // Optional metadata
      const metadata = {
        'Command': 'WRKJOB',
        'Date': new Date().toLocaleString('en-US'),
        'Status': 'Completed'
      };

      // Show the read-only document
      await DocumentManager.showOutput('WRKJOB - Output', output, metadata);
      
      vscode.window.showInformationMessage('Read-only tab opened! Use Ctrl+F to search in the text.');
    })
  );

  // DSPMSG QSYSOPR Command - Opens the QSYSOPR message queue
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.dspmsgQsysopr', async () => {
      try {
        // Create the URI for the QSYSOPR message queue in QSYS library
        const uri = vscode.Uri.parse('member:/QSYS/QSYSOPR.MSGQ');
        
        // Open the file with the custom editor
        await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor');
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to open QSYSOPR: {0}', String(error)));
      }
    })
  );

  // DSPOBJ Detailed Command - Display object with custom editor using same prompts as DSPOBJ
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.dspobjDetailed', async () => {
      // Prompt for library name
      const library = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("Enter library name"),
        placeHolder: vscode.l10n.t("Library"),
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return vscode.l10n.t("Library name is required");
          }
          if (value.length > 10) {
            return vscode.l10n.t("Library name must be 10 characters or less");
          }
          return null;
        }
      });

      if (!library) {
        return;
      }

      // Prompt for object name
      const name = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("Enter object name"),
        placeHolder: vscode.l10n.t("Object name"),
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return vscode.l10n.t("Object name is required");
          }
          if (value.length > 10) {
            return vscode.l10n.t("Object name must be 10 characters or less");
          }
          return null;
        }
      });

      if (!name) {
        return;
      }

      // Prompt for object type
      const type = await vscode.window.showInputBox({
        prompt: vscode.l10n.t("Enter object type (e.g., *PGM, *FILE, *DTAARA)"),
        placeHolder: vscode.l10n.t("*PGM"),
        value: "*PGM",
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return vscode.l10n.t("Object type is required");
          }
          if (!value.startsWith('*')) {
            return vscode.l10n.t("Object type must start with *");
          }
          return null;
        }
      });

      if (!type) {
        return;
      }

      try {
        // Remove asterisk from type for URI
        const typeExt = type.substring(1).toUpperCase();
        const libraryUpper = library.toUpperCase();
        const nameUpper = name.toUpperCase();

        // Create URI and open with custom editor
        const uriPath = `member:/${libraryUpper}/${nameUpper}.${typeExt}`;
        const uri = vscode.Uri.parse(uriPath);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor');
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to display object information: {0}', String(error)));
      }
    })
  );

  console.log(vscode.l10n.t('Congratulations, your extension "vscode-ibmi-fs" is now active!'));
}

/**
 * Extension deactivation function
 * This method is called when the extension is deactivated
 */
export function deactivate() { }
