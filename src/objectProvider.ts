
import * as vscode from 'vscode';
import Base from './types/base';
import { generateError, generatePage } from './webviewToolkit';
import { openSqlTemplate, openTextTemplate } from './tools';
import path = require('path');
import { t } from './l10n';

import { Dtaara } from './types/dataArea';
import { Dtaq } from './types/dataQueue';
import Jobq from './types/jobQueue';
import Jobd from './types/jobDescription';
import Outq from './types/outputQueue';
import { Usrspc } from './types/userSpace';
import Msgf from './types/messageFile';
import Cmd from './types/command';
import { Pgm } from './types/program';
import { Module } from './types/module';
import Jrnrcv from './types/journalReceiver';
import Jrn from './types/journal';
import File from './types/file';
import { DdmFile } from './types/ddmFile';
import { Sbsd } from './types/subsystemDescription';
import Cls from './types/class';
import { Binddir } from './types/bindingDirectory';
import { SaveFile } from './types/saveFile';
import DummyObj, { fetchQrydfn } from './types/dummyObject';
import Msgq from './types/messageQueue';


/**
 * Custom editor provider for IBM i objects
 * Handles the display and editing of various IBM i object types in VS Code
 * Reference: https://github.com/microsoft/vscode-extension-samples/blob/main/custom-editor-sample/src/pawDrawEditor.ts#L316
 */
export default class ObjectProvider implements vscode.CustomEditorProvider<Base> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Base>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  
  // Map to track open documents and their webview panels
  private static readonly _documentPanels = new Map<string, { document: Base, panel: vscode.WebviewPanel }>();
  
  /**
   * Get the document and panel for a given URI
   * @param uri - The URI of the document
   * @returns The document and panel, or undefined if not found
   */
  public static getDocumentPanel(uri: vscode.Uri): { document: Base, panel: vscode.WebviewPanel } | undefined {
    return ObjectProvider._documentPanels.get(uri.toString());
  }
  
  /**
   * Refresh a document's webview
   * @param uri - The URI of the document to refresh
   */
  public static async refreshDocument(uri: vscode.Uri): Promise<void> {
    const entry = ObjectProvider._documentPanels.get(uri.toString());
    if (entry) {
      await entry.document.fetch();
      entry.panel.webview.html = generatePage(entry.document.generateHTML());
    }
  }

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
    // Check if this should open as text editor instead of webview
    const shouldOpenAsText = await shouldOpenInTextEditor(uri);
    if (shouldOpenAsText) {
      // Return a placeholder object that will auto-close the webview
      // We use Dtaara as a concrete class but mark it for auto-close
      const placeholder = new DummyObj(uri, '', '');
      placeholder.shouldAutoClose = true;
      return placeholder;
    }
    
    const object = getTypeFile(uri);
    if (object) {
      // Set context based on file type fragment
      const fragment = uri.fragment.toUpperCase();
      console.log(`Opening document with fragment: ${fragment}, URI: ${uri.toString()}`);
      if (fragment) {
        await vscode.commands.executeCommand('setContext', 'ibmiFileType', fragment);
        console.log(`Set context ibmiFileType to: ${fragment}`);
      }
      
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
    // If document should auto-close (e.g., QRYDFN opened in text editor), dispose immediately
    if (document.shouldAutoClose) {
      webviewPanel.dispose();
      return;
    }
    
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
    };
    
    // Register the document and panel
    ObjectProvider._documentPanels.set(document.uri.toString(), { document, panel: webviewPanel });
    
    // Update context when panel becomes active
    webviewPanel.onDidChangeViewState(e => {
      if (e.webviewPanel.active) {
        const fragment = document.uri.fragment.toUpperCase();
        if (fragment) {
          vscode.commands.executeCommand('setContext', 'ibmiFileType', fragment);
          console.log(`Panel became active, set context ibmiFileType to: ${fragment}`);
        } else {
          vscode.commands.executeCommand('setContext', 'ibmiFileType', undefined);
          console.log(`Panel became active, cleared context ibmiFileType`);
        }
      }
    });
    
    // Clean up when panel is disposed
    webviewPanel.onDidDispose(() => {
      ObjectProvider._documentPanels.delete(document.uri.toString());
      // Clear the context when panel is closed
      vscode.commands.executeCommand('setContext', 'ibmiFileType', undefined);
    });

    if (document.failedFetch) {
      webviewPanel.webview.html = generateError(t(`Failed to fetch data. Please close this window.`));
    } else {
      webviewPanel.webview.html = generatePage(document.generateHTML());
      webviewPanel.webview.onDidReceiveMessage(async body => {
        // Handle search and pagination commands
        if (body.command === 'search' || body.command === 'paginate') {
          // Check if this is a SaveFile with tableId (for multiple tables)
          if (document instanceof SaveFile && body.tableId) {
            // SaveFile has separate properties for each table type (pagination only, no search)
            const prefix = body.tableId; // 'objects', 'members', or 'spools'
            
            // Set the current table ID so fetchSearchData knows which table to update
            (document as any).currentTableId = body.tableId;
            
            if (body.page !== undefined) {
              (document as any)[`${prefix}CurrentPage`] = body.page;
            }
            if (body.itemsPerPage !== undefined) {
              (document as any)[`${prefix}ItemsPerPage`] = body.itemsPerPage;
            }
          } else {
            // Standard handling for single-table documents
            if (body.searchTerm !== undefined) {
              (document as any).searchTerm = body.searchTerm;
            }
            if (body.page !== undefined) {
              (document as any).currentPage = body.page;
            }
            if (body.itemsPerPage !== undefined) {
              (document as any).itemsPerPage = body.itemsPerPage;
            }
          }
          
          // Re-fetch only searchable data (avoids reloading all tabs in multi-tab documents)
          await document.fetchSearchData();
          
          // Re-render the view
          webviewPanel.webview.html = generatePage(document.generateHTML());
          return;
        }
        
        // Handle other actions
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
  
      case `MODULE`:
        return new Module(uri, library, objectName);

      case `JRNRCV`:
        return new Jrnrcv(uri, library, objectName);
      
      case `JRN`:
        return new Jrn(uri, library, objectName);
      
      case `SBSD`:
        return new Sbsd(uri, library, objectName);  

      case `CLS`:
        return new Cls(uri, library, objectName);  

      case `MSGQ`:
        return new Msgq(uri, library, objectName);  

      case `FILE`:
        if (uri.fragment.toUpperCase() === 'SAVF') {
          return new SaveFile(uri, library, objectName);
        } else if (uri.fragment.toUpperCase() === 'DDMF') {
          return new DdmFile(uri, library, objectName);
        } else {
          return new File(uri, library, objectName);
        }
    }
  } else {
    throw new Error(t(`Invalid path.`));
  }
  return;
}

/**
 * Check if a URI should open in text editor instead of webview
 * @param uri - The URI to check
 * @returns True if should open in text editor
 */
async function shouldOpenInTextEditor(uri: vscode.Uri): Promise<boolean> {
  const pieces = uri.path.split('/');
  if (pieces.length === 3) {
    const library = pieces[1].toUpperCase();
    const nameInfo = path.parse(pieces[2]);
    const objectName = nameInfo.name.toUpperCase();
    const type = nameInfo.ext.startsWith(`.`) ? nameInfo.ext.substring(1) : nameInfo.ext;

    switch(type.toUpperCase()){
      case 'QRYDFN':
        let qrysql=await fetchQrydfn(library,objectName);
        if(qrysql.trim()===''){
          vscode.window.showErrorMessage(t(`Unable to fetch query definition.`));
        } else {
          await openSqlTemplate(qrysql);
        }
        return true;
    }
  }
  
  return false;
} 