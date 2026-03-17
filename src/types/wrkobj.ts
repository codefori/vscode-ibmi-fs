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
import { getInstance } from '../ibmi';
import { FastTableColumn, generateFastTable } from "../tools";
import { Components } from "../webviewToolkit";

/**
 * Namespace containing actions for Work with Object
 */
export namespace WrkobjActions {
  /**
   * Register Work with Object commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrkobj", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          // Called from editor toolbar - get library and name from URI
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            return openWrkobjWebview(library, name);
          }
        } else if (item) {
          // Called from context menu
          return openWrkobjWebview(item.library, item.name);
        }
      })
    );
  };

  /**
   * Open the Work with Object webview
   * @param library - The library name
   * @param name - The object name
   * @returns True if successful, false otherwise
   */
  const openWrkobjWebview = async (library: string, name: string): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrkobjView',
        vscode.l10n.t("Work with Object: {0}/{1}", library, name),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Generate sample data for the tables
      const sampleData1 = [
        { column1: vscode.l10n.t('Value 1'), column2: vscode.l10n.t('Data A'), column3: '100' },
        { column1: vscode.l10n.t('Value 2'), column2: vscode.l10n.t('Data B'), column3: '200' },
        { column1: vscode.l10n.t('Value 3'), column2: vscode.l10n.t('Data C'), column3: '300' },
        { column1: vscode.l10n.t('Value 4'), column2: vscode.l10n.t('Data D'), column3: '400' },
        { column1: vscode.l10n.t('Value 5'), column2: vscode.l10n.t('Data E'), column3: '500' }
      ];

      const sampleData2 = [
        { info: vscode.l10n.t('Information 1'), value: 'Alpha', status: vscode.l10n.t('Active') },
        { info: vscode.l10n.t('Information 2'), value: 'Beta', status: vscode.l10n.t('Inactive') },
        { info: vscode.l10n.t('Information 3'), value: 'Gamma', status: vscode.l10n.t('Active') },
        { info: vscode.l10n.t('Information 4'), value: 'Delta', status: vscode.l10n.t('Active') },
        { info: vscode.l10n.t('Information 5'), value: 'Epsilon', status: vscode.l10n.t('Inactive') }
      ];

      // Define columns for first table
      const columns1: FastTableColumn<typeof sampleData1[0]>[] = [
        { title: vscode.l10n.t('Column 1'), width: '1fr', getValue: e => e.column1 },
        { title: vscode.l10n.t('Column 2'), width: '1fr', getValue: e => e.column2 },
        { title: vscode.l10n.t('Column 3'), width: '0.5fr', getValue: e => e.column3 }
      ];

      // Define columns for second table
      const columns2: FastTableColumn<typeof sampleData2[0]>[] = [
        { title: vscode.l10n.t('Info'), width: '1.5fr', getValue: e => e.info },
        { title: vscode.l10n.t('Value'), width: '1fr', getValue: e => e.value },
        { title: vscode.l10n.t('Status'), width: '0.8fr', getValue: e => e.status }
      ];

      // Generate the first table
      const table1 = generateFastTable({
        title: vscode.l10n.t("First Table"),
        subtitle: vscode.l10n.t("Sample data for {0}/{1}", library, name),
        columns: columns1,
        data: sampleData1,
        stickyHeader: true,
        emptyMessage: vscode.l10n.t("No data available")
      });

      // Generate the second table
      const table2 = generateFastTable({
        title: vscode.l10n.t("Second Table"),
        subtitle: vscode.l10n.t("Additional information for {0}/{1}", library, name),
        columns: columns2,
        data: sampleData2,
        stickyHeader: true,
        emptyMessage: vscode.l10n.t("No data available")
      });

      // Create panels with the two tables
      const panelsHtml = Components.panels([
        {
          title: vscode.l10n.t("Tab 1"),
          badge: sampleData1.length,
          content: table1
        },
        {
          title: vscode.l10n.t("Tab 2"),
          badge: sampleData2.length,
          content: table2
        }
      ]);

      // Generate complete HTML page
      panel.webview.html = generateWebviewHtml(panelsHtml);

      vscode.window.showInformationMessage(
        vscode.l10n.t("Work with Object opened for {0}/{1}", library, name)
      );

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