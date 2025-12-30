
import * as vscode from 'vscode';
import Base from './types/base';
import { generateError, generatePage } from './webviewToolkit';
import path = require('path');

import { Dtaara } from './types/dataarea';
import { Dtaq } from './types/dataqueue';
import { SaveFile } from './types/savefile';
import Jobq from './types/jobqueue';
import Jobd from './types/jobdescription';
import Outq from './types/outputqueue';
import { Usrspc } from './types/userspace';
import Msgf from './types/messagefile';
import Cmd from './types/command';
import { Pgm } from './types/program';
import { Binddir } from './types/bindingDirectory';

/**
 * Custom editor provider for IBM i objects
 * Handles the display and editing of various IBM i object types in VS Code
 * Reference: https://github.com/microsoft/vscode-extension-samples/blob/main/custom-editor-sample/src/pawDrawEditor.ts#L316
 */
export default class ObjectProvider implements vscode.CustomEditorProvider<Base> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Base>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /**
   * Save the custom document
   * @param document - The document to save
   * @param cancellation - Cancellation token
   * @returns Promise that resolves when save is complete
   */
  saveCustomDocument(document: Base, cancellation: vscode.CancellationToken): Thenable<void> {
    if (!document.failedFetch) {
      return document.save();
    }

    return Promise.resolve();
  }

  /**
   * Save the custom document to a new location (not implemented)
   */
  saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Revert the custom document to its last saved state (not implemented)
   */
  revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Backup the custom document (not implemented)
   */
  backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Thenable<vscode.CustomDocumentBackup> {
    throw new Error('Method not implemented.');
  }

  /**
   * Open a custom document
   * Called prior to resolveCustomEditor to fetch object information from the system
   * @param uri - The URI of the document to open
   * @param openContext - Context for opening the document
   * @param token - Cancellation token
   * @returns Promise that resolves to the Base document object
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
   * Resolve and render the custom editor
   * Called when the object is ready to be displayed in the webview
   * @param document - The document to render
   * @param webviewPanel - The webview panel to render into
   * @param token - Cancellation token
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

/**
 * Create the appropriate object type based on the URI
 * @param uri - The URI of the object to create
 * @returns The appropriate Base subclass instance, or undefined if type is not supported
 */
function getTypeFile(uri: vscode.Uri): Base | undefined {
  const pieces = uri.path.split(`/`);
  if (pieces.length === 3) {
    const library = pieces[1].toUpperCase();
    const nameInfo = path.parse(pieces[2]);
    const objectName = nameInfo.name.toUpperCase();
    const type = nameInfo.ext.startsWith(`.`) ? nameInfo.ext.substring(1) : nameInfo.ext;

    switch (type.toUpperCase()) {
      case `BNDDIR`:
        return new Binddir(uri, library, objectName);

      case `DTAARA`:
        return new Dtaara(uri, library, objectName);

      case `PGM`:
      case `SRVPGM`:
        return new Pgm(uri, library, objectName);

      case `CMD`:
        return new Cmd(uri, library, objectName);

      case `OUTQ`:
        return new Outq(uri, library, objectName);

      case `JOBQ`:
        return new Jobq(uri, library, objectName);

      case `JOBD`:
        return new Jobd(uri, library, objectName);

      case `DTAQ`:
        return new Dtaq(uri, library, objectName);

      case `USRSPC`:
        return new Usrspc(uri, library, objectName);

      case `MSGF`:
        return new Msgf(uri, library, objectName);

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