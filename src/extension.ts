// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { DataQueueActions } from './types/dataqueue';
import { SaveFileActions } from './types/savefile';
import { loadBase } from './ibmi';
import { DataAreaActions } from './types/dataarea';
import { JobQueueActions } from './types/jobqueue';
import { OutputQueueActions } from './types/outputqueue';
import { UserSpaceActions } from './types/userspace';

/**
 * Extension activation function
 * This method is called when the extension is activated for the first time
 * @param context - The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Load the base IBM i extension
  loadBase();

  // Register the custom editor provider for IBM i file system objects
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(`vscode-ibmi-fs.editor`, new ObjectProvider(), {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  // Register action handlers for Save Files and Data Queues
  SaveFileActions.register(context);
  DataQueueActions.register(context);
  DataAreaActions.register(context);
  JobQueueActions.register(context);
  OutputQueueActions.register(context);
  UserSpaceActions.register(context);

  console.log('Congratulations, your extension "vscode-ibmi-fs" is now active!');
}

/**
 * Extension deactivation function
 * This method is called when the extension is deactivated
 */
export function deactivate() { }
