import * as vscode from 'vscode';
import { IBMiMessageQueue, IBMiMessageQueueMessage, ObjAttributes } from '../typings';


export class MessageQueue extends vscode.TreeItem implements IBMiMessageQueue {
  messageQueueLibrary: string;
  messageQueue: string;
  text?: string;
  protected?: boolean;
  constructor(
    public readonly label: string, // Name of the message queue
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly messages: Message[] // Array to store messages (initially empty)
  ) {
    super(label, collapsibleState);
    this.contextValue = 'messageQueue'; // Useful for context menus
    this.messageQueueLibrary = ``;
    this.messageQueue = ``;
    this.text = ``;
    this.protected = false;
  }
}

export class Message extends vscode.TreeItem {
  constructor(
    public readonly label: string, // Content of the message
    public readonly messageDetails: any // Additional message details
  ) {
    super(label, vscode.TreeItemCollapsibleState.None); // Messages are leaves
    this.contextValue = 'message';
  }
}