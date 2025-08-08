// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { Code4i } from './tools';
import { DataQueueActions } from './types/dataqueue';
import { SaveFileActions } from './types/saveFile';
import { initializeMessageQueueBrowser } from './messageQueueBrowser';
import { initializeMessageQueueSearchView } from './messageQueueSearchResults';
import { initializeUserJobBrowser } from './userJobsBrowser';
import { TempFileManager } from './tools/tempFileManager'; // Adjust path as needed

let tempFileManager: TempFileManager;
let globalContext: vscode.ExtensionContext;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	tempFileManager = new TempFileManager();
	globalContext = context;
	const isDebugMode = () => process.env.VSCODE_DEBUG_MODE === "true";
	await Code4i.initialize(context);

	initializeMessageQueueBrowser(context);
	await initializeMessageQueueSearchView(context);
	initializeUserJobBrowser(context);
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
}

// this method is called when your extension is deactivated
export function deactivate() {
	// Clean up temporary files when the extension deactivates
	if (tempFileManager) {
		tempFileManager.cleanUpTempFiles();
	}
}
export function getGlobalContext(): vscode.ExtensionContext {
	return globalContext;
}