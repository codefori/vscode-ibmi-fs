
import * as vscode from 'vscode';
import Base from './types/base';
import { generateError, generatePage } from './webviewToolkit';
import { DocumentManager } from './documentManager';
import path = require('path');

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
import { Usridx } from './types/userIndex';
import { getAutoRefreshInterval } from './config';


/**
 * Custom editor provider for IBM i objects
 * Handles the display and editing of various IBM i object types in VS Code
 * Reference: https://github.com/microsoft/vscode-extension-samples/blob/main/custom-editor-sample/src/pawDrawEditor.ts#L316
 */
export default class ObjectProvider implements vscode.CustomEditorProvider<Base> {
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<Base>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
  
  // Map to track open documents and their webview panels
  private static readonly _documentPanels = new Map<string, { document: Base, panel: vscode.WebviewPanel, refreshTimer?: NodeJS.Timeout }>();
  
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
      // First, tell the webview to save its current state with the restore flag
      // This must happen BEFORE we update the HTML
      await entry.panel.webview.postMessage({
        command: 'saveStateForRestore'
      });
      
      // Give the webview time to process the message and save state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Now fetch new data
      await entry.document.fetch();
      
      // Update HTML - the state is already saved with isSearchRestore flag
      entry.panel.webview.html = generatePage(entry.document.generateHTML());
    }
  }

  /**
   * Refresh only the rows of a document's tables, leaving the page in place.
   *
   * Used by the auto-refresh timer, where nothing but the data changes: rebuilding the page
   * every interval would steal focus from the search box and reset the active tab under the
   * user. Commands that can also change the detail panels (CLRMSGQ and friends) must keep
   * using {@link refreshDocument} instead.
   *
   * @param uri - The URI of the document to refresh
   */
  public static async refreshDocumentTables(uri: vscode.Uri): Promise<void> {
    const key = uri.toString();
    const entry = ObjectProvider._documentPanels.get(key);
    if (!entry) {
      return;
    }

    // A tick starting while the previous query is still running would stack overlapping
    // fetches on a slow system until the connection is saturated.
    if (ObjectProvider._refreshing.has(key)) {
      return;
    }
    ObjectProvider._refreshing.add(key);

    try {
      await entry.document.fetch();
      // Documents without generateTableUpdate fall back to a full page rebuild, which
      // costs them the scroll position every interval — see applyUpdate.
      await ObjectProvider.applyUpdate(entry.document, entry.panel);
    } finally {
      ObjectProvider._refreshing.delete(key);
    }
  }

  /** URIs with a refresh in flight, keyed as in {@link _documentPanels}. */
  private static readonly _refreshing = new Set<string>();

  /**
   * Push fresh data to an open panel, patching the table rows when the document supports it
   * and rebuilding the page only when it doesn't.
   *
   * Patching is what keeps the search box's focus and the caret position, and leaves the
   * active tab where the user put it. The rebuild branch has to announce itself first so the
   * webview can stash the active tab (see `saveStateForRestore` in webviewToolkit.ts), which
   * is why it needs the small delay the patching branch doesn't.
   *
   * @param document - The document holding the fresh data
   * @param panel - The panel showing it
   * @param tableId - Which table to patch, for documents hosting more than one
   */
  private static async applyUpdate(document: Base, panel: vscode.WebviewPanel, tableId?: string): Promise<void> {
    const update = document.generateTableUpdate?.(tableId);
    // A document hosting several tables returns one message per table; each one is filtered
    // on its own tableId by the page, so the order doesn't matter.
    const updates = update ? (Array.isArray(update) ? update : [update]) : [];
    if (updates.length > 0) {
      for (const message of updates) {
        await panel.webview.postMessage(message);
      }
      return;
    }

    await panel.webview.postMessage({ command: 'saveStateForRestore' });
    await new Promise(resolve => setTimeout(resolve, 100));
    panel.webview.html = generatePage(document.generateHTML());
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
      if (fragment) {
        await vscode.commands.executeCommand('setContext', 'ibmiFileType', fragment);
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
    
    // Setup auto-refresh for the types that opt in (see Base.autoRefresh)
    const autoRefreshInterval = getAutoRefreshInterval();
    if (document.autoRefresh && autoRefreshInterval > 0) {
      // No visibility check: custom editors are registered with retainContextWhenHidden,
      // so a document left in a background tab keeps refreshing and is already up
      // to date when the user comes back to it.
      const refreshTimer = setInterval(async () => {
        try {
          await ObjectProvider.refreshDocumentTables(document.uri);
        } catch (error) {
          console.error(`Auto-refresh error for ${document.uri.toString()}:`, error);
        }
      }, autoRefreshInterval);

      // Store the timer in the map
      const entry = ObjectProvider._documentPanels.get(document.uri.toString());
      if (entry) {
        entry.refreshTimer = refreshTimer;
      }
    }
    
    // Update context when panel becomes active
    webviewPanel.onDidChangeViewState(e => {
      if (e.webviewPanel.active) {
        const fragment = document.uri.fragment.toUpperCase();
        if (fragment) {
          vscode.commands.executeCommand('setContext', 'ibmiFileType', fragment);
        } else {
          vscode.commands.executeCommand('setContext', 'ibmiFileType', undefined);
        }
      }
    });
    
    // Clean up when panel is disposed
    webviewPanel.onDidDispose(() => {
      const entry = ObjectProvider._documentPanels.get(document.uri.toString());
      // Clear auto-refresh timer if exists
      if (entry?.refreshTimer) {
        clearInterval(entry.refreshTimer);
      }
      ObjectProvider._documentPanels.delete(document.uri.toString());
      // Clear the context when panel is closed
      vscode.commands.executeCommand('setContext', 'ibmiFileType', undefined);
    });

    if (document.failedFetch) {
      webviewPanel.webview.html = generateError(vscode.l10n.t(`Failed to fetch data. Please close this window.`));
    } else {
      webviewPanel.webview.html = generatePage(document.generateHTML());
      webviewPanel.webview.onDidReceiveMessage(async body => {
        // Handle search and pagination commands
        if (body.command === 'search' || body.command === 'paginate') {
          // Note: the page size deliberately isn't taken from the message. The webview echoes
          // back the value baked into it when it was rendered, so honouring it would undo a
          // change to `code-for-ibmi.tables.itemsPerPage` made while the tab was open.
          if (document instanceof SaveFile && body.tableId) {
            // SaveFile has separate properties for each table type (pagination only, no search)
            const prefix = body.tableId; // 'objects', 'members', or 'spools'

            // Set the current table ID so fetchSearchData knows which table to update
            (document as any).currentTableId = body.tableId;

            if (body.page !== undefined) {
              (document as any)[`${prefix}CurrentPage`] = body.page;
            }
          } else {
            // Standard handling for single-table documents
            if (body.searchTerm !== undefined) {
              (document as any).searchTerm = body.searchTerm;
            }
            if (body.page !== undefined) {
              (document as any).currentPage = body.page;
            }
          }

          try {
            // Re-fetch only searchable data (avoids reloading all tabs in multi-tab documents)
            await document.fetchSearchData();
            await ObjectProvider.applyUpdate(document, webviewPanel, body.tableId);
          } catch (error) {
            // The webview spins its busy indicator until an answer arrives, so a failed query
            // must still be answered — otherwise it spins until its own safety timeout.
            console.error(`${body.command} error:`, error);
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to load data: {0}", String(error)));
            await webviewPanel.webview.postMessage({ command: 'updateTableFailed', tableId: body.tableId });
          }
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
          await ObjectProvider.applyUpdate(document, webviewPanel, body.tableId);
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

      case `USRIDX`:
        return new Usridx(uri, library, objectName);  

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
    throw new Error(vscode.l10n.t(`Invalid path.`));
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
          vscode.window.showErrorMessage(vscode.l10n.t(`Unable to fetch query definition.`));
        } else {
          await DocumentManager.openTextTemplate(qrysql, 'sql');
        }
        return true;
    }
  }
  
  return false;
} 