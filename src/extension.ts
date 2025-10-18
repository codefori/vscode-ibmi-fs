// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { DataQueueActions } from './types/dataqueue';
import { SaveFileActions } from './types/saveFile';
import { loadBase } from './ibmi';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	loadBase();

	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(`vscode-ibmi-fs.editor`, new ObjectProvider(), {
			webviewOptions: {
				retainContextWhenHidden: true
			}
		})
	);

	SaveFileActions.register(context);
	DataQueueActions.register(context);

	console.log('Congratulations, your extension "vscode-ibmi-fs" is now active!');
}

// this method is called when your extension is deactivated
export function deactivate() { }
