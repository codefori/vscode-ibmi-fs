/**
 * User Index Management Module
 *
 * This module provides functionality for viewing and managing IBM i User Indexes (*USRIDX).
 * User Indexes are objects that provide fast keyed or sequential access to data entries.
 * They can be used for high-performance data storage and retrieval operations.
 *
 * Key Features:
 * - Display user index information and attributes
 * - View all entries in the user index
 * - Add new entries (with or without keys)
 * - Remove entries using various operations (EQ, GE, GT, LE, LT, BETWEEN, FIRST, LAST)
 * - Support for both keyed and non-keyed user indexes
 * - Interactive entry management through webview
 *
 * @module userIndex
 */

import { CommandResult, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, getProtected, checkProcedureExists, checkTableFunctionExists, checkViewExists, executeSqlIfExists } from "../tools";
import ObjectProvider from '../objectProvider';

/**
 * Namespace containing User Index action commands
 */
export namespace UserIndexActions {
  /**
   * Register User Index commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.AddUsridxEntry", async (item: IBMiObject | Usridx | vscode.Uri) => {
        let usridx: IBMiObject | Usridx;
        
        // Handle toolbar call (Uri)
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          const name = parts[parts.length - 1].replace('.USRIDX', '');
          const library = parts[parts.length - 2];
          usridx = { library, name, type: '*USRIDX' } as IBMiObject;
        } else {
          usridx = item;
        }
        
        const result = await addUsridxEntry(usridx);
        
        // Refresh document if called from toolbar
        if (result && item instanceof vscode.Uri) {
          await ObjectProvider.refreshDocument(item);
        }
        
        return result;
      }),
      vscode.commands.registerCommand("vscode-ibmi-fs.RmvUsridxEntry", async (item: IBMiObject | Usridx | vscode.Uri) => {
        let usridx: IBMiObject | Usridx;
        
        // Handle toolbar call (Uri)
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          const name = parts[parts.length - 1].replace('.USRIDX', '');
          const library = parts[parts.length - 2];
          usridx = { library, name, type: '*USRIDX' } as IBMiObject;
        } else {
          usridx = item;
        }
        
        const result = await rmvUsridxEntry(usridx);
        
        // Refresh document if called from toolbar
        if (result && item instanceof vscode.Uri) {
          await ObjectProvider.refreshDocument(item);
        }
        
        return result;
      })
    );
  };

  /**
   * Remove an entry from a user index
   * @param item - User Index object
   * @returns True if removal was successful, false otherwise
   */
  export const rmvUsridxEntry = async (item: IBMiObject | Usridx): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection, item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      // First, get user index info to check if it has keys
      const usridxInfo = await executeSqlIfExists(
        connection,
        `SELECT KEY_INSERTION
         FROM QSYS2.USER_INDEX_INFO
         WHERE USER_INDEX_LIBRARY = '${library}' AND USER_INDEX = '${name}'
         FETCH FIRST ROW ONLY`,
        'QSYS2',
        'USER_INDEX_INFO',
        'VIEW'
      );

      if (usridxInfo === null || usridxInfo.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t("Unable to retrieve User Index information"));
        return false;
      }

      const hasKey = usridxInfo[0].KEY_INSERTION === 'YES';

      // Prompt user for operation type
      const operation = await vscode.window.showQuickPick(
        [
          { label: 'EQ', description: vscode.l10n.t('Equal - Remove entries that match or start with the value') },
          { label: 'GE', description: vscode.l10n.t('Greater or Equal - Remove entries >= value') },
          { label: 'GT', description: vscode.l10n.t('Greater Than - Remove entries > value') },
          { label: 'LE', description: vscode.l10n.t('Less or Equal - Remove entries <= value') },
          { label: 'LT', description: vscode.l10n.t('Less Than - Remove entries < value') },
          { label: 'BETWEEN', description: vscode.l10n.t('Between - Remove entries between two values') },
          { label: 'FIRST', description: vscode.l10n.t('First - Remove first n entries') },
          { label: 'LAST', description: vscode.l10n.t('Last - Remove last n entries') }
        ],
        {
          placeHolder: vscode.l10n.t("Select removal operation"),
          title: vscode.l10n.t("Removal Operation")
        }
      );

      if (!operation) {
        return false;
      }

      let removeValue: string | undefined;
      let removeValueEnd: string | undefined;
      let maxRemove: string | undefined;

      // Handle different operation types
      if (operation.label === 'FIRST' || operation.label === 'LAST') {
        // For FIRST/LAST, ask for max number of entries
        maxRemove = await vscode.window.showInputBox({
          placeHolder: vscode.l10n.t("Number of entries (leave empty for all)"),
          title: vscode.l10n.t("Maximum entries to remove"),
          prompt: vscode.l10n.t("Enter number or leave empty to remove all")
        });
        // User can leave empty or cancel
        if (maxRemove === undefined) {
          return false;
        }
      } else if (operation.label === 'BETWEEN') {
        // For BETWEEN, ask for start and end values
        removeValue = await vscode.window.showInputBox({
          placeHolder: vscode.l10n.t("Start value"),
          title: vscode.l10n.t("Enter start value for BETWEEN operation"),
          prompt: vscode.l10n.t("Start value")
        });

        if (!removeValue) {
          return false;
        }

        removeValueEnd = await vscode.window.showInputBox({
          placeHolder: vscode.l10n.t("End value"),
          title: vscode.l10n.t("Enter end value for BETWEEN operation"),
          prompt: vscode.l10n.t("End value")
        });

        if (!removeValueEnd) {
          return false;
        }
      } else {
        // For other operations, ask for the value
        removeValue = await vscode.window.showInputBox({
          placeHolder: vscode.l10n.t("Entry key/value"),
          title: vscode.l10n.t("Enter the key/value for removal"),
          prompt: vscode.l10n.t("Key/value")
        });

        if (!removeValue) {
          return false;
        }
      }

      return await rmvUsridxEntryByOperation(library, name, operation.label, removeValue, removeValueEnd, maxRemove);
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Add a new entry to a user index
   * @param item - User Index object
   * @returns True if addition was successful, false otherwise
   */
  export const addUsridxEntry = async (item: IBMiObject | Usridx): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();
    
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection, item.library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      // First, get user index info to check if it has keys
      const usridxInfo = await executeSqlIfExists(
        connection,
        `SELECT KEY_INSERTION, KEY_LENGTH
         FROM QSYS2.USER_INDEX_INFO
         WHERE USER_INDEX_LIBRARY = '${library}' AND USER_INDEX = '${name}'
         FETCH FIRST ROW ONLY`,
        'QSYS2',
        'USER_INDEX_INFO',
        'VIEW'
      );

      if (usridxInfo === null || usridxInfo.length === 0) {
        vscode.window.showErrorMessage(vscode.l10n.t("Unable to retrieve User Index information"));
        return false;
      }

      const hasKey = usridxInfo[0].KEY_INSERTION === 'YES';
      let key = null;

      // If user index has keys, prompt for key
      if (hasKey) {
        key = await vscode.window.showInputBox({
          placeHolder: vscode.l10n.t("Entry key"),
          title: vscode.l10n.t("Enter the key for the new entry"),
          prompt: vscode.l10n.t("Key value (max {0} characters)", String(usridxInfo[0].KEY_LENGTH))
        });

        if (!key) {
          return false;
        }
      }

      // Prompt user for entry data
      const data = await vscode.window.showInputBox({
        placeHolder: vscode.l10n.t("Entry data"),
        title: vscode.l10n.t("Enter the data for the new entry"),
        prompt: vscode.l10n.t("Entry value")
      });

      if (data) {
        try {
          // Use QSYS2.ADD_USER_INDEX_ENTRY procedure
          let sqlCall: string;
          if (hasKey && key) {
            sqlCall = `CALL QSYS2.ADD_USER_INDEX_ENTRY(
              USER_INDEX => '${name}',
              USER_INDEX_LIBRARY => '${library}',
              REPLACE => 'NO',
              KEY => '${key.replace(/'/g, "''")}',
              ENTRY => '${data.replace(/'/g, "''")}'
            )`;
          } else {
            sqlCall = `CALL QSYS2.ADD_USER_INDEX_ENTRY(
              USER_INDEX => '${name}',
              USER_INDEX_LIBRARY => '${library}',
              REPLACE => 'NO',
              ENTRY => '${data.replace(/'/g, "''")}'
            )`;
          }

          const result = await executeSqlIfExists(
            connection,
            sqlCall,
            'QSYS2',
            'ADD_USER_INDEX_ENTRY',
            'PROCEDURE'
          );

          if (result === null) {
            vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "PROCEDURE", "QSYS2", "ADD_USER_INDEX_ENTRY"));
            return false;
          }

          vscode.window.showInformationMessage(vscode.l10n.t("Entry added to User Index {0}/{1}.", library, name));
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(vscode.l10n.t("An error occurred while adding entry to User Index {0}/{1}: {2}", library, name, String(error)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };

  /**
   * Remove an entry from a user index by key (internal helper for table actions)
   * @param key - Entry key to remove
   * @param library - Library name
   * @param name - User index name
   * @returns True if removal was successful, false otherwise
   */
  export const rmvUsridxEntryByKey = async (key: string, library: string, name: string): Promise<boolean> => {
    return await rmvUsridxEntryByOperation(library, name, 'EQ', key);
  };

  /**
   * Remove entries from a user index using specified operation
   * @param library - Library name
   * @param name - User index name
   * @param operation - Operation type (EQ, GE, GT, LE, LT, BETWEEN, FIRST, LAST)
   * @param removeValue - Value for removal (optional for FIRST/LAST)
   * @param removeValueEnd - End value for BETWEEN operation
   * @param maxRemove - Maximum entries to remove for FIRST/LAST
   * @returns True if removal was successful, false otherwise
   */
  export const rmvUsridxEntryByOperation = async (
    library: string,
    name: string,
    operation: string,
    removeValue?: string,
    removeValueEnd?: string,
    maxRemove?: string
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      if(getProtected(connection, library)){
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      // Build confirmation message based on operation
      let confirmMessage: string;
      if (operation === 'FIRST' || operation === 'LAST') {
        const count = maxRemove || vscode.l10n.t('all');
        confirmMessage = vscode.l10n.t("Are you sure you want to remove {0} {1} entries from User Index {2}/{3}?", count, operation.toLowerCase(), library, name);
      } else if (operation === 'BETWEEN') {
        confirmMessage = vscode.l10n.t("Are you sure you want to remove entries between '{0}' and '{1}' from User Index {2}/{3}?", removeValue || '', removeValueEnd || '', library, name);
      } else {
        confirmMessage = vscode.l10n.t("Are you sure you want to remove entries {0} '{1}' from User Index {2}/{3}?", operation, removeValue || '', library, name);
      }

      // Show confirmation dialog
      if (await vscode.window.showWarningMessage(
        confirmMessage,
        { modal: true },
        vscode.l10n.t("Remove entry")
      )) {
        try {
          // Build SQL call based on operation
          let sqlCall: string;
          const baseParams = `USER_INDEX => '${name}', USER_INDEX_LIBRARY => '${library}', OPERATION => '${operation}'`;
          
          if (operation === 'FIRST' || operation === 'LAST') {
            // FIRST/LAST operations
            if (maxRemove && maxRemove.trim() !== '') {
              sqlCall = `SELECT * FROM TABLE(QSYS2.REMOVE_USER_INDEX_ENTRY(${baseParams}, MAX_REMOVE => ${maxRemove}))`;
            } else {
              sqlCall = `SELECT * FROM TABLE(QSYS2.REMOVE_USER_INDEX_ENTRY(${baseParams}))`;
            }
          } else if (operation === 'BETWEEN') {
            // BETWEEN operation
            sqlCall = `SELECT * FROM TABLE(QSYS2.REMOVE_USER_INDEX_ENTRY(${baseParams}, REMOVE_VALUE => '${removeValue?.replace(/'/g, "''")}', REMOVE_VALUE_END => '${removeValueEnd?.replace(/'/g, "''")}'))`;
          } else {
            // Other operations (EQ, GE, GT, LE, LT)
            sqlCall = `SELECT * FROM TABLE(QSYS2.REMOVE_USER_INDEX_ENTRY(${baseParams}, REMOVE_VALUE => '${removeValue?.replace(/'/g, "''")}'))`;
          }

          const result = await executeSqlIfExists(
            connection,
            sqlCall,
            'QSYS2',
            'REMOVE_USER_INDEX_ENTRY',
            'FUNCTION'
          );

          if (result === null) {
            vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "REMOVE_USER_INDEX_ENTRY"));
            return false;
          }

          vscode.window.showInformationMessage(vscode.l10n.t("Entries removed from User Index {0}/{1}.", library, name));
          return true;
        } catch (error) {
          vscode.window.showErrorMessage(vscode.l10n.t("An error occurred while removing entries from User Index {0}/{1}: {2}", library, name, String(error)));
          return false;
        }
      } else {
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  };
}

/**
 * Interface representing a User Index entry
 */
interface Entry {
  /** Entry key (for keyed user indexes) */
  key: string
  /** Entry position/ordinal number */
  position: number
  /** Entry data value */
  value: string
}

/**
 * User Index (Usridx) object class
 * Handles display and management of IBM i User Indexes
 */
export class Usridx extends Base {
  private readonly _info: Record<string, string | boolean | number> = {};
  private readonly _entries: Entry[] = [];
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** User index information from database */
  private Usridx?: any;

  /** User index information */
  get info() {
    return this.Usridx;
  }

  /**
   * Fetch user index information and entries
   */
  async fetch() {
    await this.fetchInfo();
    await this._fetchEntries();
  }

  /**
   * Fetch user index metadata from IBM i
   */
  async fetchInfo() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      this.columns = await getColumns(connection, 'USER_INDEX_INFO');
      let sql: string;

      // Query to get user index information
      this.Usridx = await executeSqlIfExists(
        connection,
        `SELECT ENTRY_TYPE,
          ENTRY_LENGTH,
          MAXIMUM_ENTRY_LENGTH,
          INDEX_SIZE,
          IMMEDIATE_UPDATE,
          OPTIMIZATION,
          KEY_INSERTION,
          KEY_LENGTH,
          ENTRY_TOTAL,
          ENTRIES_ADDED,
          ENTRIES_REMOVED,
          OBJECT_DOMAIN,
          TEXT_DESCRIPTION
        FROM QSYS2.USER_INDEX_INFO
        WHERE USER_INDEX_LIBRARY = '${this.library}' and USER_INDEX='${this.name}'
        Fetch first row only`,
        'QSYS2',
        'USER_INDEX_INFO',
        'VIEW'
      );

      if (this.Usridx === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "USER_INDEX_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch all entries from the user index
   */
  private async _fetchEntries() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this._entries.length = 0;
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT ORDINAL_POSITION,
          "KEY",
          ENTRY
        FROM TABLE (
          QSYS2.USER_INDEX_ENTRIES
            (USER_INDEX => '${this.name}', 
            USER_INDEX_LIBRARY => '${this.library}')
          )
        Order By ORDINAL_POSITION`,
        'QSYS2',
        'USER_INDEX_ENTRIES',
        'FUNCTION'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "USER_INDEX_ENTRIES"));
        return;
      }

      this._entries.push(...entryRows.map(toEntry));
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the user index view with tabs
   * @returns HTML string
   */
  generateHTML(): string {
    return Components.panels([
      { title: vscode.l10n.t("Detail"), content: this.renderDataQueuePanel() },
      { title: vscode.l10n.t("Data"), badge: this._entries.length, content: renderEntries(this._entries) },
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
        // Remove a specific entry from the user index
        entryJson = params.get("entry");
        if (entryJson) {
          const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
          if (await UserIndexActions.rmvUsridxEntryByKey(entry.key, this.library, this.name)) {
            refetch = true;
          }
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
   * Save changes (not applicable for user indexes)
   */
  async save() {
    // User indexes don't have a save operation
  }

  /**
   * Render the user index information panel
   * @returns HTML string for the panel
   */
  private renderDataQueuePanel(): string {
    return generateDetailTable({
      title: vscode.l10n.t("User Index: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t("User Index Information"),
      columns: this.columns,
      data: this.Usridx
    });
  }
}

/**
 * Convert a database row to an Entry object
 * @param row - Database row from QSYS2.USER_INDEX_ENTRIES
 * @returns Entry object
 */
function toEntry(row: Tools.DB2Row): Entry {
  return {
    key: String(row.KEY),
    position: Number(row.ORDINAL_POSITION),
    value: String(row.ENTRY),
  };
}

/**
 * Render the entries table
 * @param entries - Array of entries to display
 * @returns HTML string for the entries table
 */
function renderEntries(entries: Entry[]) {
  const columns: FastTableColumn<Entry>[] = [
    { title: vscode.l10n.t("Position"), width: "0.5fr", getValue: e => e.position },
    { title: vscode.l10n.t("Key"), width: "0.5fr", getValue: e => e.key },
    { title: vscode.l10n.t("Value"), width: "2fr", getValue: e => e.value }
  ];

  return `<div class="usridx-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: entries,
    stickyHeader: true,
    emptyMessage: vscode.l10n.t("No data in this Usridx."),
  }) + `</div>`;

}