
import path = require('path');
import * as vscode from 'vscode';
import Base from './types/base';
import BindingDirectory from './types/bindingDirectory';
import { DataArea } from './types/dataarea';
import generatePage from './webviewToolkit';

export default class ObjectProvider implements vscode.CustomEditorProvider<Base> {
  // https://github.com/microsoft/vscode-extension-samples/blob/main/custom-editor-sample/src/pawDrawEditor.ts#L316
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Base>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method not implemented.');
  }
  saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method not implemented.');
  }
  revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method not implemented.');
  }
  backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    throw new Error('Method not implemented.');
  }

  /**
   * Called prior to resolveCustomEditor to allow extension to talk to system to fetch object information
   */
  async openCustomDocument(uri: vscode.Uri, openContext: vscode.CustomDocumentOpenContext, token: vscode.CancellationToken): Promise<Base> {
    const object = getTypeFile(uri);
    if (object) {
      await object.fetch();
      return object;
    }

    throw new Error(`Unsupported type given: ${uri.toString()}`);
  }

  /**
   * Called when the object is ready to be rendered
   */
  async resolveCustomEditor(document: Base, webviewPanel: vscode.WebviewPanel, token: vscode.CancellationToken): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    };
    webviewPanel.webview.html = generatePage(document.generateHTML());
  }
}

function getTypeFile(uri: vscode.Uri): Base | undefined {
  const pieces = uri.path.split(`/`);
  if (pieces.length === 3) {
    const library = pieces[1].toUpperCase();
    const nameInfo = path.parse(pieces[2]);
    const objectName = nameInfo.name.toUpperCase();
    const type = nameInfo.ext.startsWith(`.`) ? nameInfo.ext.substring(1) : nameInfo.ext;

    switch (type.toUpperCase()) {
      case `BNDDIR`:
        return new BindingDirectory(uri, library, objectName);

      case `DTAARA`:
        return new DataArea(uri, library, objectName);
    }
  } else {
    throw new Error(`Invalid path.`);
  }
  return;
}