// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { Code4i } from './tools';
import { DataQueueActions } from './types/dataqueue';
import { SaveFileActions } from './types/saveFile';
import { initializeMessageQueueBrowser } from './messageQueueBrowser';
import { initializeMessageQueueSearchView } from './messageQueueSearchResults';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	await Code4i.initialize(context);

	initializeMessageQueueBrowser(context);
	await initializeMessageQueueSearchView(context);
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(`vscode-ibmi-fs.editor`, new ObjectProvider(), {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	SaveFileActions.register(context);
	DataQueueActions.register(context);

	console.log(`Congratulations, your extension "vscode-ibmi-fs" "Version" :"${context.extension.packageJSON.version}" is now active!`);
	Code4i.getInstance()?.subscribe(
    context,
    'connected',
    `Refresh views`,
    () => {
      vscode.commands.executeCommand("vscode-ibmi-msgqbrowser.refreshMSGQBrowser");
    });
}

// this method is called when your extension is deactivated
export function deactivate() { }
