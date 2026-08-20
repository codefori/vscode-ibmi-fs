/**
 * Work with Subsystems (WRKSBS) Action Module
 *
 * This module provides functionality to display all active subsystems in the system,
 * based on the QSYS2.SUBSYSTEM_INFO view. It opens a webview with a table containing
 * all active subsystems with a detail action.
 * 
 */

import { IBMiObject } from '@halcyontech/vscode-ibmi-types';
import * as vscode from 'vscode';
import { getInstance } from '../ibmi';
import { executeSqlIfExists, checkViewExists } from "../tools";
import { FastTableColumn, generateFastTable, generateFastTableUpdate } from "../ibmi";
import { generatePage } from "../webviewToolkit";
import { getAutoRefreshInterval } from '../config';
import { SubsystemActions } from '../types/subsystemDescription';

/** Explicit id so refreshes can target this table; see FastTableUpdateOptions.tableId. */
const WRKSBS_TABLE_ID = 'wrksbs-subsystems';

/** Value SUBSYSTEM_INFO reports for MAXIMUM_ACTIVE_JOBS when the subsystem has no limit. */
const NO_MAX_ACTIVE_JOBS = -1;

/**
 * Namespace containing actions for Work with Subsystems
 */
export namespace WrksbsActions {
  /**
   * Register Work with Subsystems commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrksbs", async () => {
        return openWrksbsWebview();
      })
    );
  };

  /**
   * Interface representing an active subsystem entry
   */
  interface Entry {
    /** Subsystem description library */
    library: string;
    /** Subsystem description name */
    subsystem: string;
    /** Maximum active jobs allowed, or *NOMAX */
    maxActiveJobs: string;
    /** Current number of active jobs */
    currentActiveJobs: number;
    /** Text description */
    text: string;
  }

  /**
   * Fetch active subsystems from the system with search filtering
   * @param searchTerm - Search term for filtering
   * @returns Array of active subsystem entries, or null if error
   */
  const fetchActiveSubsystems = async (searchTerm: string = ''): Promise<Entry[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    // Check if the view exists
    const viewExists = await checkViewExists(connection, 'QSYS2', 'SUBSYSTEM_INFO');

    if (!viewExists) {
      vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_INFO"));
      return null;
    }

    // Fetch active subsystems data with search filter
    const query = `
      SELECT SUBSYSTEM_DESCRIPTION_LIBRARY,
             SUBSYSTEM_DESCRIPTION,
             MAXIMUM_ACTIVE_JOBS,
             CURRENT_ACTIVE_JOBS,
             TEXT_DESCRIPTION
       FROM QSYS2.SUBSYSTEM_INFO
       WHERE STATUS = 'ACTIVE'
       ORDER BY SUBSYSTEM_DESCRIPTION ASC
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'SUBSYSTEM_INFO',
      'VIEW'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SUBSYSTEM_INFO")
      );
      return null;
    }

    const entries = result.map((row: any): Entry => ({
      library: String(row.SUBSYSTEM_DESCRIPTION_LIBRARY),
      subsystem: String(row.SUBSYSTEM_DESCRIPTION),
      maxActiveJobs: Number(row.MAXIMUM_ACTIVE_JOBS) === NO_MAX_ACTIVE_JOBS ? '*NOMAX' : String(row.MAXIMUM_ACTIVE_JOBS),
      currentActiveJobs: Number(row.CURRENT_ACTIVE_JOBS),
      text: String(row.TEXT_DESCRIPTION || ''),
    }));

    return entries;
  };

  /**
   * Open the Work with Subsystems webview
   * @returns True if successful, false otherwise
   */
  const openWrksbsWebview = async (): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // State for search
      let searchTerm = '';

      // Fetch active subsystems data
      let subsystems = await fetchActiveSubsystems(searchTerm);

      // Check if fetch failed
      if (subsystems === null) {
        return false;
      }

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrksbsView',
        vscode.l10n.t("Work with Subsystems"),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Auto-refresh configuration, from `code-for-ibmi.views.autoRefreshInterval`
      const autoRefreshInterval = getAutoRefreshInterval();
      let autoRefreshTimer: NodeJS.Timeout | undefined;
      // Guards against a tick starting while the previous query is still running, which on a
      // slow system would stack overlapping fetches until the connection is saturated.
      let refreshing = false;

      const refresh = async (isAutoRefresh: boolean = false) => {
        if (refreshing) {
          return;
        }
        refreshing = true;
        try {
          const newSubsystems = await fetchActiveSubsystems(searchTerm);
          if (newSubsystems) {
            subsystems = newSubsystems;
            await postTableUpdate();
            // Show success message only for manual refresh
            if (!isAutoRefresh) {
              vscode.window.showInformationMessage(vscode.l10n.t('Subsystems refreshed successfully'));
            }
          }
        } finally {
          refreshing = false;
        }
      };

      // Add refresh button to the webview toolbar
      const refreshDisposable = vscode.commands.registerCommand('vscode-ibmi-fs.refreshWrksbs', async (isAutoRefresh: boolean = false) => {
        await refresh(isAutoRefresh);
      });

      // Clean up the command and the timer when panel is disposed
      panel.onDidDispose(() => {
        refreshDisposable.dispose();
        if (autoRefreshTimer) {
          clearInterval(autoRefreshTimer);
          autoRefreshTimer = undefined;
        }
      });

      // Column titles reuse the QSYS2.SUBSYSTEM_INFO column names as l10n keys — they're
      // already translated everywhere else the view's raw SQL columns show up as labels.
      const subsystemColumns: FastTableColumn<Entry>[] = [
        { title: vscode.l10n.t("SUBSYSTEM_DESCRIPTION_LIBRARY"), width: "1fr", getValue: e => e.library },
        { title: vscode.l10n.t("SUBSYSTEM_DESCRIPTION"), width: "1fr", getValue: e => e.subsystem },
        { title: vscode.l10n.t("MAXIMUM_ACTIVE_JOBS"), width: "0.8fr", getValue: e => e.maxActiveJobs },
        { title: vscode.l10n.t("CURRENT_ACTIVE_JOBS"), width: "0.8fr", getValue: e => String(e.currentActiveJobs) },
        { title: vscode.l10n.t("TEXT_DESCRIPTION"), width: "1.5fr", getValue: e => e.text },
        {
          title: vscode.l10n.t("Actions"),
          width: "1fr",
          getValue: e => {
            // Encode subsystem entry as URL parameter for the action handler
            const arg = encodeURIComponent(JSON.stringify(e));
            return `<vscode-button appearance="primary" href="action:sbsDetail?entry=${arg}">${vscode.l10n.t("Details")}</vscode-button>
                  <vscode-button appearance="secondary" href="action:endSbs?entry=${arg}">${vscode.l10n.t("End")}</vscode-button>`;
          }
        }
      ];

      // Function to generate the table HTML
      const generateTableHtml = () => {
        return generateFastTable({
          title: vscode.l10n.t("Work with Subsystems"),
          subtitle: vscode.l10n.t("Total Active Subsystems: {0}", String(subsystems?.length || 0)),
          columns: subsystemColumns,
          data: subsystems || [],
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No active subsystems found."),
          enableSearch: false,
          tableId: WRKSBS_TABLE_ID
        });
      };

      /**
       * Push the freshly fetched rows into the page already on screen.
       * Reassigning `webview.html` instead would recreate the search box, taking keyboard
       * focus away mid-typing and restoring the term as it was when the query started.
       */
      const postTableUpdate = async () => {
        const rows = subsystems || [];
        await panel.webview.postMessage(generateFastTableUpdate({
          columns: subsystemColumns,
          data: rows,
          totalItems: rows.length,
          currentPage: 1,
          subtitle: vscode.l10n.t("Total Active Subsystems: {0}", String(rows.length)),
          tableId: WRKSBS_TABLE_ID
        }));
      };

      // Generate initial HTML
      panel.webview.html = generatePage(generateTableHtml());

      // Start auto-refresh (disabled when the interval is 0)
      if (autoRefreshInterval > 0) {
        autoRefreshTimer = setInterval(async () => {
          try {
            await refresh(true);
          } catch (error) {
            console.error('Active subsystems auto-refresh error:', error);
          }
        }, autoRefreshInterval);
      }

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(async (message) => {
        // Handle search
        if (message.command === 'search') {
          if (message.searchTerm !== undefined) {
            searchTerm = message.searchTerm;
          }

          try {
            const newSubsystems = await fetchActiveSubsystems(searchTerm);
            if (newSubsystems) {
              subsystems = newSubsystems;
            }
            await postTableUpdate();
          } catch (error) {
            // The webview spins its busy indicator until an answer arrives, so a failed query
            // must still be answered — otherwise it spins until its own safety timeout.
            console.error(`Active subsystems search error:`, error);
            vscode.window.showErrorMessage(vscode.l10n.t("Failed to load subsystems: {0}", String(error)));
            await panel.webview.postMessage({ command: 'updateTableFailed', tableId: WRKSBS_TABLE_ID });
          }
          return;
        }

        // The message contains the href attribute from the clicked element
        const href = message.href;
        if (!href) {
          return;
        }

        // Parse the action URL
        const uri = vscode.Uri.parse(href);
        const params = new URLSearchParams(uri.query);
        const entryJson = params.get("entry");

        if (!entryJson) {
          return;
        }

        const entry: Entry = JSON.parse(decodeURIComponent(entryJson));
        let refetch = false;

        switch (uri.path) {
          case "sbsDetail":
            // Open the Subsystem Description (*SBSD) view
            await vscode.commands.executeCommand(
              'vscode.openWith',
              vscode.Uri.parse(`member:/${entry.library}/${entry.subsystem}.SBSD`),
              'vscode-ibmi-fs.editor',
              { preview: true }
            );
            break;

          case "endSbs":
            if (await SubsystemActions.endSbs({ library: entry.library, name: entry.subsystem } as IBMiObject)) {
              refetch = true;
            }
            break;
        }

        // Refresh the list if the action changed a subsystem's status
        if (refetch) {
          const newSubsystems = await fetchActiveSubsystems(searchTerm);
          if (newSubsystems) {
            subsystems = newSubsystems;
            await postTableUpdate();
          }
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error opening WRKSBS: {0}", String(error)));
      return false;
    }
  };
}
