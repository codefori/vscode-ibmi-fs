/**
 * Work with Object (WRKOBJ) Action Module
 *
 * This module provides a generic action that can be used with any IBM i object type.
 * It opens a webview with two tabs, each containing a fast table with sample data.
 *
 * @module wrkobj
 */

import { IBMiObject } from '@halcyontech/vscode-ibmi-types';
import * as vscode from 'vscode';
import { getInstance } from './ibmi';
import { FastTableColumn, generateDetailTable, generateFastTable, executeSqlIfExists, checkTableFunctionExists, checkViewExists } from "./tools";
import { Components } from "./webviewToolkit";

/**
 * Namespace containing actions for Work with Object
 */
export namespace DspobjActions {
  /**
   * Register Work with Object commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.dspobj", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const type = '*'+parts[2].split('.')[1];
            return openWrkobjWebview(library, name, type);
          }
        } else if (item) {
          // Called from context menu or Object Browser
          // Check if it's a tree item with object property or direct IBMiObject
          const library = (item as any).object?.library || item.library;
          const name = (item as any).object?.name || item.name;
          const type = (item as any).object?.type || item.type;
          return openWrkobjWebview(library, name, type);
        }
      })
    );
  };

  /**
   * Fetch object statistics and privileges
   * @param library - The library name
   * @param name - The object name
   * @param type - The object type (without asterisk, e.g., 'PGM')
   * @returns Object statistics data
   */
  const fetchObjectStatistics = async (library: string, name: string, type: string): Promise<any[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    const query = `
      SELECT DISTINCT 
                x.OBJLONGNAME, 
                x.SQL_OBJECT_TYPE, 
                OBJOWNER,
                OBJDEFINER,
                OBJSIZE,
                OBJTEXT,
                CASE WHEN x.OBJTYPE='*LIB' THEN IASP_NAME else null end as ASPGRP,  
                TO_CHAR(OBJCREATED, 'yyyy-mm-dd HH24:mi') OBJCREATED,
                TO_CHAR(CHANGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') CHANGE_TIMESTAMP,
                TO_CHAR(LAST_USED_TIMESTAMP, 'yyyy-mm-dd HH24:mi') LAST_USED_TIMESTAMP,
                DAYS_USED_COUNT,
                TO_CHAR(SAVE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') SAVE_TIMESTAMP,
                X.SAVE_DEVICE,
                X.SAVE_VOLUME,
                X.SAVE_SEQUENCE_NUMBER,
                TO_CHAR(RESTORE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') RESTORE_TIMESTAMP,
                CASE WHEN JOURNALED = 'YES' THEN JOURNALED CONCAT ' ' CONCAT JOURNAL_LIBRARY CONCAT '/' CONCAT JOURNAL_NAME ELSE 'NO' END AS JOURNALED,
                AUTHORIZATION_LIST
      FROM TABLE (
               QSYS2.OBJECT_STATISTICS('${library}', '${type}', '${name}')
           ) X
           INNER JOIN QSYS2.OBJECT_PRIVILEGES Y
               ON X.OBJNAME = Y.SYSTEM_OBJECT_NAME
                   AND X.OBJTYPE = Y.OBJECT_TYPE
                   AND X.OBJLIB = Y.SYSTEM_OBJECT_SCHEMA
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'OBJECT_STATISTICS',
      'FUNCTION'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "OBJECT_STATISTICS")
      );
      return null;
    }

    return result;
  };

  /**
   * Fetch object lock information
   * @param library - The library name
   * @param name - The object name
   * @param type - The object type (with asterisk, e.g., '*PGM')
   * @returns Object lock data
   */
  const fetchObjectLocks = async (library: string, name: string, type: string): Promise<any[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    const query = `
      SELECT LOCK_STATE,
             LOCK_STATUS,
             LOCK_SCOPE,
             JOB_NAME
      FROM QSYS2.OBJECT_LOCK_INFO
      WHERE SYSTEM_OBJECT_SCHEMA = '${library}'
            AND SYSTEM_OBJECT_NAME = '${name}'
            AND OBJECT_TYPE='${type}'
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'OBJECT_LOCK_INFO',
      'VIEW'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OBJECT_LOCK_INFO")
      );
      return null;
    }

    return result;
  };

  /**
   * Fetch object privileges/authorizations
   * @param library - The library name
   * @param name - The object name
   * @param type - The object type (with asterisk, e.g., '*PGM')
   * @returns Object privileges data
   */
  const fetchObjectPrivileges = async (library: string, name: string, type: string): Promise<any[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    const query = `
      SELECT AUTHORIZATION_NAME,
             OBJECT_AUTHORITY,
             OBJECT_OPERATIONAL,
             OBJECT_MANAGEMENT,
             OBJECT_EXISTENCE,
             OBJECT_ALTER,
             OBJECT_REFERENCE,
             DATA_READ,
             DATA_ADD,
             DATA_UPDATE,
             DATA_DELETE,
             DATA_EXECUTE
      FROM QSYS2.OBJECT_PRIVILEGES
      WHERE SYSTEM_OBJECT_SCHEMA = '${library}'
            AND SYSTEM_OBJECT_NAME = '${name}'
            AND OBJECT_TYPE='${type}'
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'OBJECT_PRIVILEGES',
      'VIEW'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "OBJECT_PRIVILEGES")
      );
      return null;
    }

    return result;
  };

  /**
   * Open the Work with Object webview
   * @param library - The library name
   * @param name - The object name
   * @returns True if successful, false otherwise
   */
  const openWrkobjWebview = async (library: string, name: string, type: string): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {

      // Fetch data from IBM i in parallel
      const [objectStats, objectLocks, objectPrivileges] = await Promise.all([
        fetchObjectStatistics(library, name, type),
        fetchObjectLocks(library, name, type),
        fetchObjectPrivileges(library, name, type)
      ]);

      // Check if any fetch failed
      if (objectStats === null || objectLocks === null || objectPrivileges === null) {
        return false;
      }

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrkobjView',
        vscode.l10n.t("Display Object Information: {0}/{1} {2}", library, name, type),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Define columns for object statistics (detail table - Map format)
      const statsColumns = new Map<string, string>([
        ['OBJLONGNAME', vscode.l10n.t('SQL Name')],
        ['SQL_OBJECT_TYPE', vscode.l10n.t('SQL Type')],
        ['OBJOWNER', vscode.l10n.t('Owner')],
        ['OBJDEFINER', vscode.l10n.t('Definer')],
        ['OBJSIZE', vscode.l10n.t('Size')],
        ['ASPGRP', vscode.l10n.t('ASPGRP')],
        ['OBJTEXT', vscode.l10n.t('Text')],
        ['OBJCREATED', vscode.l10n.t('Created')],
        ['CHANGE_TIMESTAMP', vscode.l10n.t('Changed')],
        ['LAST_USED_TIMESTAMP', vscode.l10n.t('Last Used')],
        ['DAYS_USED_COUNT', vscode.l10n.t('Days Used')],
        ['SAVE_TIMESTAMP', vscode.l10n.t('Saved')],
        ['SAVE_DEVICE', vscode.l10n.t('Save Device')],
        ['SAVE_VOLUME', vscode.l10n.t('Save Volume')],
        ['SAVE_SEQUENCE_NUMBER', vscode.l10n.t('Save Sequence')],
        ['RESTORE_TIMESTAMP', vscode.l10n.t('Restored')],
        ['JOURNALED', vscode.l10n.t('Journaled')],
        ['AUTHORIZATION_LIST', vscode.l10n.t('Auth List')]
      ]);

      // Define columns for locks table
      const locksColumns: FastTableColumn<any>[] = [
        { title: vscode.l10n.t('Lock State'), width: '1fr', getValue: e => e.LOCK_STATE },
        { title: vscode.l10n.t('Lock Status'), width: '1fr', getValue: e => e.LOCK_STATUS },
        { title: vscode.l10n.t('Lock Scope'), width: '1fr', getValue: e => e.LOCK_SCOPE },
        { title: vscode.l10n.t('Job Name'), width: '2fr', getValue: e => e.JOB_NAME }
      ];

      // Define columns for privileges table
      const privilegesColumns: FastTableColumn<any>[] = [
        { title: vscode.l10n.t('Authorization'), width: '1.5fr', getValue: e => e.AUTHORIZATION_NAME },
        { title: vscode.l10n.t('Object Auth'), width: '1fr', getValue: e => e.OBJECT_AUTHORITY },
        { title: vscode.l10n.t('Operational'), width: '0.8fr', getValue: e => e.OBJECT_OPERATIONAL },
        { title: vscode.l10n.t('Management'), width: '0.8fr', getValue: e => e.OBJECT_MANAGEMENT },
        { title: vscode.l10n.t('Existence'), width: '0.8fr', getValue: e => e.OBJECT_EXISTENCE },
        { title: vscode.l10n.t('Alter'), width: '0.8fr', getValue: e => e.OBJECT_ALTER },
        { title: vscode.l10n.t('Reference'), width: '0.8fr', getValue: e => e.OBJECT_REFERENCE },
        { title: vscode.l10n.t('Read'), width: '0.8fr', getValue: e => e.DATA_READ },
        { title: vscode.l10n.t('Add'), width: '0.8fr', getValue: e => e.DATA_ADD },
        { title: vscode.l10n.t('Update'), width: '0.8fr', getValue: e => e.DATA_UPDATE },
        { title: vscode.l10n.t('Delete'), width: '0.8fr', getValue: e => e.DATA_DELETE },
        { title: vscode.l10n.t('Execute'), width: '0.8fr', getValue: e => e.DATA_EXECUTE }
      ];

      // Generate the detail table for object statistics
      const table1 = generateDetailTable({
        title: `${library}/${name} ${type}`,
        subtitle: vscode.l10n.t('Object Information'),
        columns: statsColumns,
        data: objectStats,
        hideNullValues: true
      });

      // Generate the locks table
      const table2 = generateFastTable({
        title: vscode.l10n.t("Object Locks"),
        columns: locksColumns,
        data: objectLocks,
        stickyHeader: true,
        emptyMessage: vscode.l10n.t("No locks found")
      });

      // Generate the privileges table
      const table3 = generateFastTable({
        title: vscode.l10n.t("Object Authorizations"),
        columns: privilegesColumns,
        data: objectPrivileges,
        stickyHeader: true,
        emptyMessage: vscode.l10n.t("No authorizations found")
      });

      // Create panels with the three tables
      const panelsHtml = Components.panels([
        {
          title: vscode.l10n.t("Information"),
          content: table1
        },
        {
          title: vscode.l10n.t("Locks"),
          badge: objectLocks?.length || 0,
          content: table2
        },
        {
          title: vscode.l10n.t("Authorizations"),
          badge: objectPrivileges?.length || 0,
          content: table3
        }
      ]);

      // Generate complete HTML page
      panel.webview.html = generateWebviewHtml(panelsHtml);

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error opening Work with Object: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * Generate the complete HTML for the webview
   * @param content - The content to display
   * @returns Complete HTML string
   */
  function generateWebviewHtml(content: string): string {
    const webToolKit = require("@vscode-elements/elements/dist/bundled.js");
    
    return `<!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script defer type="module">${webToolKit}</script>
        <style>
          body {
            padding: 20px;
          }
          vscode-tab-panel {
            flex-direction: column;
          }
        </style>
      </head>
      <body>
        ${content}
      </body>
      <script defer>
        const vscode = acquireVsCodeApi();
        
        // Save and restore active tab
        (function() {
          const tabs = document.querySelector('vscode-tabs');
          if (tabs) {
            const state = vscode.getState() || {};
            const savedIndex = state.activeTabIndex;
            
            if (savedIndex !== undefined && savedIndex !== null) {
              tabs.setAttribute('selected-index', savedIndex.toString());
            }
            
            tabs.addEventListener('vsc-select', (event) => {
              const selectedIndex = event.detail.selectedIndex;
              if (selectedIndex !== undefined && selectedIndex !== null) {
                const currentState = vscode.getState() || {};
                currentState.activeTabIndex = selectedIndex;
                vscode.setState(currentState);
              }
            });
          }
        })();
      </script>
    </html>`;
  }
}