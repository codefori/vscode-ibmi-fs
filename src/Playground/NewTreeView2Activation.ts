import * as vscode from 'vscode';
import { MessageQueueProvider } from './NewTreeView2MessageQueueProvider';

export function activate(context: vscode.ExtensionContext) {
  const messageQueueProvider = new MessageQueueProvider();
  vscode.window.registerTreeDataProvider('messageQueueView', messageQueueProvider);

  // You can also register commands to refresh the view
  context.subscriptions.push(vscode.commands.registerCommand('messageQueueView.refresh', () => messageQueueProvider.refresh()));
}