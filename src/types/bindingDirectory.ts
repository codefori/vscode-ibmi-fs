/**
 * Binding Directory Management Module
 *
 * This module provides functionality for viewing and managing IBM i Binding Directories (*BNDDIR).
 * Binding Directories contain lists of modules and service programs that can be automatically
 * bound to programs during compilation, simplifying the binding process.
 *
 * Key Features:
 * - Display binding directory entries (modules and service programs)
 * - View entry details (object, type, activation, creation timestamp)
 * - View exported procedures from bound service programs
 * - Add new entries to the binding directory
 * - Remove entries from the binding directory
 * - Interactive management with action buttons
 *
 * @module bindingdirectory
 */

import { CommandResult, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable } from "../tools";

/**
 * Namespace containing Binding Directory action commands
 */
export namespace BindingDirectoryActions {
  /**
   * Register Binding Directory commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.Addbnddire", addbnddire),
      vscode.commands.registerCommand("vscode-ibmi-fs.Rmvbnddire", rmvbnddire),
    );
  };

  /**
   * Remove an entry from a binding directory
   * @param item - Entry to remove
   * @param bnddir - Binding directory name (library/name format)
   * @returns True if removal was successful, false otherwise
   */
  export const rmvbnddire = async (item: Entry, bnddir: string): Promise<boolean> => {
    // Show confirmation dialog to prevent accidental removal
    if (await vscode.window.showWarningMessage(`Are you sure you want to remove ${item.object}?`, { modal: true }, "Remove object")) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        // Execute RMVBNDDIRE command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `RMVBNDDIRE BNDDIR(${bnddir}) OBJ(${item.object})`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Item removed.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to remove selected item.`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
      return false;
    }
  };

  /**
   * Add a new entry to a binding directory
   * @param item - Binding directory object
   * @returns True if addition was successful, false otherwise
   */
  export const addbnddire = async (item: IBMiObject | Binddir): Promise<boolean> => {
    // Prompt user for object details

    let obj, objtype, activation;

    const ibmiPattern = /^[A-Za-z#@$][A-Za-z0-9#@$_]{0,9}\/[A-Za-z#@$][A-Za-z0-9#@$_]{0,9}$/;

    obj = await vscode.window.showInputBox({
      placeHolder: "LIBXXX/OBJXXX",
      title: `Object to bind`,
      validateInput: (obj) => {
        if (obj.length < 3 || !ibmiPattern.test(obj)) {
          return `You need to specify a valid path`;
        }
      },
    });

    objtype = await vscode.window.showQuickPick(
      ["*SRVPGM", "*MODULE"],
      {
        placeHolder: "Object type",
        title: "Object type",
        canPickMany: false,
      },
    );

    activation = await vscode.window.showQuickPick(
      ["*IMMED", "*DEFER"],
      {
        placeHolder: "Object activation",
        title: "Object activation",
        canPickMany: false,
      },
    );

    if (obj && objtype && activation) {
      const ibmi = getInstance();
      const connection = ibmi?.getConnection();
      if (connection) {
        // Execute ADDBNDDIRE command on IBM i
        const cmdrun: CommandResult = await connection.runCommand({
          command: `ADDBNDDIRE BNDDIR(${item.library}/${item.name}) OBJ((${obj} ${objtype} ${activation}))`,
          environment: `ile`
        });

        // Check command execution result
        if (cmdrun.code === 0) {
          vscode.window.showInformationMessage(`Item added.`);
          return true;
        } else {
          vscode.window.showErrorMessage(`Unable to add selected item.`);
          return false;
        }
      } else {
        vscode.window.showErrorMessage(`Not connected to IBM i`);
        return false;
      }
    }
    else {
      return false;
    }
  };
}

const ACTION_ADD = "add";  // Add entry to binding directory action

/**
 * Interface representing an entry in a binding directory
 */
interface Entry {
  /** Object name with library (library/object format) */
  object: string
  /** Object type (*MODULE or *SRVPGM) */
  type: string
  /** Activation type (*IMMED or *DEFER) */
  activation: string
  /** Entry creation timestamp */
  creation: string
}

/**
 * Interface representing an exported procedure or data item from a bound service program
 */
interface Export {
  /** Procedure or data item name */
  method: string
  /** Usage type (PROCEDURE or DATA) */
  usage: string
  /** Object that exports this symbol */
  object: string
}

/**
 * Binding Directory (*BNDDIR) object class
 * Handles display and management of IBM i Binding Directory information
 */
export class Binddir extends Base {
  /** List of binding directory entries */
  private readonly entries: Entry[] = [];
  /** List of exported procedures from bound service programs */
  private readonly exports: Export[] = [];
  private _keyed = false;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Program information from database (unused for binding directories) */
  private pgm?: any;
  /** Flag indicating if this is a service program (unused for binding directories) */
  private isSrvpgm: boolean = false;


  /**
   * Fetch binding directory entries and exported procedures
   */
  async fetch() {
    await this.fetchEntries();
    await this.fetchExports();
  }

  /**
   * Fetch all entries in the binding directory
   * Retrieves entry information from QSYS2.BINDING_DIRECTORY_INFO catalog
   */
  private async fetchEntries() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.entries.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT ENTRY_LIBRARY CONCAT '/' CONCAT ENTRY AS ENTRY,
          ENTRY_TYPE,
          ENTRY_ACTIVATION,
          to_char(ENTRY_CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') as ENTRY_CREATE_TIMESTAMP
        FROM QSYS2.BINDING_DIRECTORY_INFO
        WHERE BINDING_DIRECTORY_LIBRARY = '${this.library}'
              AND BINDING_DIRECTORY = '${this.name}'`);

      this.entries.push(...entryRows.map(toEntry));
    }
  }

  /**
   * Fetch exported procedures and data items from bound service programs
   * Retrieves export information by joining QSYS2.BINDING_DIRECTORY_INFO with QSYS2.PROGRAM_EXPORT_IMPORT_INFO
   */
  private async fetchExports() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.exports.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT ENTRY_LIBRARY CONCAT '/' CONCAT ENTRY as ENTRY,
          y.SYMBOL_NAME,
          y.SYMBOL_USAGE
        FROM QSYS2.BINDING_DIRECTORY_INFO x
            INNER JOIN QSYS2.PROGRAM_EXPORT_IMPORT_INFO y
                ON x.ENTRY_LIBRARY = y.PROGRAM_LIBRARY
                    AND x.ENTRY = y.PROGRAM_NAME
        WHERE BINDING_DIRECTORY_LIBRARY = '${this.library}'
          AND BINDING_DIRECTORY = '${this.name}'`);

      this.exports.push(...entryRows.map(toExport));
    }
  }

  /**
   * Generate HTML for the binding directory view with tabs
   * @returns HTML string containing tabbed interface with entries and exports
   */
  generateHTML(): string {
    return Components.panels([
      { title: "Entries", content: renderEntries(this.entries, this.library + '/' + this.name), badge: this.entries.length },
      { title: "Exports", content: renderExports(this.exports), badge: this.exports.length },
    ]);
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Action result indicating if re-render is needed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // Parse the action URL to extract action type and parameters
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;  // Flag to determine if data needs to be refetched
    let entryJson;
    const params = new URLSearchParams(uri.query);
    
    // Route to appropriate action handler based on action type
    switch (uri.path) {
      case "remove":
        // Remove a specific entry from the binding directory
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if (await BindingDirectoryActions.rmvbnddire(entry, this.library + '/' + this.name)) {
            refetch = true;
          }
        }
        break;

      case ACTION_ADD:
        // Add a new entry to the binding directory
        if (await BindingDirectoryActions.addbnddire(this)) {
          refetch = true;
        }
        break;
    }
    // If any action was successful, refetch data to update the UI
    if (refetch) {
      await this.fetch();
    }
    
    // Return result indicating whether the UI should be re-rendered
    return { rerender: refetch };
  }

  /**
   * Save changes (not applicable for binding directories)
   */
  async save() {
    // Binding directories don't have a save operation
  }

  /**
   * Render the binding directory information panel (unused)
   * @returns HTML string for the detail panel
   */
  private renderPgmPanel(): string {
    return generateDetailTable({
      title: `${this.isSrvpgm ? 'Service Program' : 'Program'}: ${this.library}/${this.name}`,
      subtitle: `${this.isSrvpgm ? 'Service Program' : 'Program'} Information`,
      columns: this.columns,
      data: this.pgm,
      codeColumns: ['COPYRIGHT_STRINGS', 'EXPORT_SIGNATURES'],
      hideNullValues: true
    });
  }
}

/**
 * Convert a database row to an Entry object
 * @param row - Database row from QSYS2.BINDING_DIRECTORY_INFO
 * @returns Entry object
 */
function toEntry(row: Tools.DB2Row): Entry {
  return {
    object: String(row.ENTRY),
    type: String(row.ENTRY_TYPE),
    activation: String(row.ENTRY_ACTIVATION),
    creation: String(row.ENTRY_CREATE_TIMESTAMP),
  };
}

/**
 * Convert a database row to an Export object
 * @param row - Database row from joined QSYS2.BINDING_DIRECTORY_INFO and QSYS2.PROGRAM_EXPORT_IMPORT_INFO
 * @returns Export object
 */
function toExport(row: Tools.DB2Row): Export {
  return {
    method: String(row.SYMBOL_NAME),
    usage: String(row.SYMBOL_USAGE), 
    object: String(row.ENTRY), 
  };
}

/**
 * Render the entries panel showing binding directory entries
 * @param entries - Array of binding directory entries
 * @param name - Binding directory name (library/name format)
 * @returns HTML string for the entries panel with action buttons
 */
function renderEntries(entries: Entry[], name: string) {
  const columnsmod: FastTableColumn<Entry>[] = [
    { title: "Object", width: "2fr", getValue: e => e.object },
    { title: "Type", width: "1fr", getValue: e => e.type },
    { title: "Activation", width: "1fr", getValue: e => e.activation },
    { title: "Creation", width: "2fr", getValue: e => e.creation },
    {
      title: "Actions",
      width: "1fr",
      getValue: e => {
        // Encode entry as URL parameter for action handlers
        const arg = encodeURIComponent(JSON.stringify(e));
        
        return `<vscode-button appearance="secondary" href="action:remove?entry=${arg}">Remove ❌</vscode-button>`;
      }
    }
  ];

  const customStyles = `
    /* Custom styles for object name cells */
    .modules-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="modules-entries-table">` + generateFastTable({
    title: `Binding Directory: ` + name,
    subtitle: `Total entries: ` + entries.length,
    columns: columnsmod,
    data: entries,
    stickyHeader: true,
    emptyMessage: 'No entries in this binding directory.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>${Components.divider()}<br>${Components.button("Add entry ➕", { action: ACTION_ADD, style: "width:100%; text-align: center" })}`;
}

/**
 * Render the exports panel showing exported procedures and data items
 * @param exports - Array of exported items
 * @returns HTML string for the exports panel
 */
function renderExports(exports: Export[]) {
  const columns: FastTableColumn<Export>[] = [
    { title: "Procedure", width: "1.5fr", getValue: e => e.method },
    { title: "Object", width: "1.5fr", getValue: e => e.object },
    { title: "Usage", width: "0.5fr", getValue: e => e.usage },
  ];

  const customStyles = `
    /* Custom styles for procedure name cells */
    .exports-entries-bd-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="exports-entries-bd-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: exports,
    stickyHeader: true,
    emptyMessage: 'No exports in this binding directory.',
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
}