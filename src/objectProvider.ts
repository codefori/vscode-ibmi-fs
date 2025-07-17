
import * as vscode from 'vscode';
import Base from './types/base';
import BindingDirectory from './types/bindingDirectory';
import { Command } from './types/command';
import { DataArea } from './types/dataarea';
import { DataQueue } from './types/dataqueue';
// import { MessageFile } from './types/messageFile';
import Program from './types/program';
import { SaveFile } from './types/saveFile';
import { generateError, generatePage } from './webviewToolkit';
import path = require('path');

export default class ObjectProvider implements vscode.CustomEditorProvider<Base> {
  // https://github.com/microsoft/vscode-extension-samples/blob/main/custom-editor-sample/src/pawDrawEditor.ts#L316
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Base>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  saveCustomDocument(document: Base, cancellation: vscode.CancellationToken): Thenable<void> {
    if (!document.failedFetch) {
      return document.save();
    }

    return Promise.resolve();
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
      try {
        await object.fetch();
      } catch (e) {
        object.failedFetch = true;
      }
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

    if (document.failedFetch) {
      webviewPanel.webview.html = generateError(`Failed to fetch data. Please close this window.`);

    } else {
      webviewPanel.webview.html = generatePage(document.generateHTML());
      webviewPanel.webview.onDidReceiveMessage(async body => {
        const actionResult = await document.handleAction(body);

        if (actionResult.dirty) {
          this._onDidChangeCustomDocument.fire({
            document,
            redo: () => { throw new Error("Redo not supported."); },
            undo: () => { throw new Error("Undo not supported."); }
          });
        }

        if (actionResult.rerender) {
          webviewPanel.webview.html = generatePage(document.generateHTML());
        }
      });
    }
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

      case `PGM`:
      case `SRVPGM`:
        return new Program(uri, library, objectName);

      case `CMD`:
        return new Command(uri, library, objectName);

      case `DTAQ`:
        return new DataQueue(uri, library, objectName);
      // case `MSGF`:
      //   return new MessageFile(uri, library, objectName);

      case `FILE`:
        if (uri.fragment.toUpperCase() === 'SAVF') {
          return new SaveFile(uri, library, objectName);
        }
    }
  } else {
    throw new Error(`Invalid path.`);
  }
  return;
}