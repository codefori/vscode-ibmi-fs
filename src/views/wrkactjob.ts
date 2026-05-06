/**
 * Work with Active Jobs (WRKACTJOB) Action Module
 *
 * This module provides functionality to display all active jobs in the system.
 * It opens a webview with a table containing all active jobs with actions.
 *
 * @module wrkactjob
 */

import * as vscode from 'vscode';
import { getInstance } from '../ibmi';
import { FastTableColumn, generateFastTable, executeSqlIfExists, checkTableFunctionExists } from "../tools";
import { generatePage } from "../webviewToolkit";
import { JobOperations } from '../commonOperations';

/**
 * Namespace containing actions for Work with Active Jobs
 */
export namespace WrkactjobActions {
  /**
   * Register Work with Active Jobs commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrkactjob", async () => {
        return openWrkactjobWebview();
      })
    );
  };

  /**
   * Interface representing an active job entry
   */
  interface Entry {
    /** Subsystem name */
    subsystem: string;
    /** Job name */
    job: string;
    /** Authorization name (user) */
    user: string;
    /** Job type */
    type: string;
    /** Function */
    function: string;
    /** Job status */
    status: string;
    /** Temporary storage */
    tmpstg: number;
    /** Elapsed CPU percentage */
    elapsedCpuPct: number;
    /** Elapsed total disk I/O count */
    elapsedIo: number;
    /** CPU time */
    cpu: number;
    /** Total disk I/O count */
    io: number;
  }

  /**
   * Fetch active jobs from the system with search filtering
   * @param searchTerm - Search term for filtering
   * @returns Array of active job entries, or null if error
   */
  const fetchActiveJobs = async (searchTerm: string = ''): Promise<Entry[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    // Check if the table function exists
    const functionExists = await checkTableFunctionExists(connection, 'QSYS2', 'ACTIVE_JOB_INFO');
    
    if (!functionExists) {
      vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "ACTIVE_JOB_INFO"));
      return null;
    }

    // Build WHERE clause for search
    let whereClause = '1=1';
    if (searchTerm && searchTerm.trim() !== '' && searchTerm.trim() !== '-') {
      const searchPattern = `%${searchTerm.trim().toUpperCase()}%`;
      whereClause += ` AND (
        UPPER(JOB_NAME) LIKE '${searchPattern}' OR
        UPPER(AUTHORIZATION_NAME) LIKE '${searchPattern}' OR
        UPPER(JOB_TYPE) LIKE '${searchPattern}' OR
        UPPER(JOB_STATUS) LIKE '${searchPattern}' OR
        UPPER(SUBSYSTEM) LIKE '${searchPattern}' OR
        UPPER(FUNCTION_TYPE CONCAT '-' CONCAT "FUNCTION") LIKE '${searchPattern}'
      )`;
    }

    // Fetch active jobs data with search filter
    const query = `
      SELECT case when SUBSYSTEM is null then ' ' else SUBSYSTEM end as SUBSYSTEM,
             JOB_NAME,
             AUTHORIZATION_NAME,
             JOB_TYPE,
             FUNCTION_TYPE CONCAT '-' CONCAT "FUNCTION" "FUNCTION",
             JOB_STATUS,
             TEMPORARY_STORAGE,
             ELAPSED_CPU_PERCENTAGE,
             ELAPSED_TOTAL_DISK_IO_COUNT,
             CPU_TIME,
             TOTAL_DISK_IO_COUNT
      FROM TABLE (
              QSYS2.ACTIVE_JOB_INFO(DETAILED_INFO => 'NONE', RESET_STATISTICS => 'NO')
          ) x
      WHERE ${whereClause}
      ORDER BY x.SUBSYSTEM ASC
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'ACTIVE_JOB_INFO',
      'FUNCTION'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "ACTIVE_JOB_INFO")
      );
      return null;
    }

    const entries = result.map((row: any): Entry => ({
      subsystem: String(row.SUBSYSTEM),
      job: String(row.JOB_NAME),
      user: String(row.AUTHORIZATION_NAME),
      type: String(row.JOB_TYPE),
      function: String(row.FUNCTION),
      status: String(row.JOB_STATUS),
      tmpstg: Number(row.TEMPORARY_STORAGE),
      elapsedCpuPct: Number(row.ELAPSED_CPU_PERCENTAGE),
      elapsedIo: Number(row.ELAPSED_TOTAL_DISK_IO_COUNT),
      cpu: Number(row.CPU_TIME),
      io: Number(row.TOTAL_DISK_IO_COUNT)
    }));

    return entries;
  };

  /**
   * Open the Work with Active Jobs webview
   * @returns True if successful, false otherwise
   */
  const openWrkactjobWebview = async (): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // State for search
      let searchTerm = '';

      // Fetch active jobs data
      let activeJobs = await fetchActiveJobs(searchTerm);

      // Check if fetch failed
      if (activeJobs === null) {
        return false;
      }

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrkactjobView',
        vscode.l10n.t("Work with Active Jobs"),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Add refresh button to the webview toolbar
      const refreshDisposable = vscode.commands.registerCommand('vscode-ibmi-fs.refreshWrkactjob', async () => {
        const newJobs = await fetchActiveJobs(searchTerm);
        if (newJobs) {
          activeJobs = newJobs;
          panel.webview.html = generatePage(generateTableHtml());
          vscode.window.showInformationMessage(vscode.l10n.t('Active jobs refreshed successfully'));
        }
      });

      // Clean up the command when panel is disposed
      panel.onDidDispose(() => {
        refreshDisposable.dispose();
      });

      // Define columns for active jobs table
      const jobColumns: FastTableColumn<Entry>[] = [
        { title: vscode.l10n.t("Subsystem"), width: "1fr", getValue: e => e.subsystem },
        { title: vscode.l10n.t("Job"), width: "1.5fr", getValue: e => e.job },
        { title: vscode.l10n.t("User"), width: "0.7fr", getValue: e => e.user },
        { title: vscode.l10n.t("Type"), width: "0.5fr", getValue: e => e.type },
        { title: vscode.l10n.t("Function"), width: "0.7fr", getValue: e => e.function },
        { title: vscode.l10n.t("Status"), width: "0.5fr", getValue: e => e.status },
        { title: vscode.l10n.t("Temp. Stg."), width: "0.5fr", getValue: e => String(e.tmpstg) },
        { title: vscode.l10n.t("Elapsed CPU %"), width: "0.5fr", getValue: e => String(e.elapsedCpuPct) },
        { title: vscode.l10n.t("Elapsed I/O"), width: "0.5fr", getValue: e => String(e.elapsedIo) },
        { title: vscode.l10n.t("CPU Time"), width: "0.5fr", getValue: e => String(e.cpu) },
        { title: vscode.l10n.t("Total I/O"), width: "0.5fr", getValue: e => String(e.io) },
        {
          title: vscode.l10n.t("Actions"),
          width: "2fr",
          getValue: e => {
            // Don't show action buttons for subsystem jobs (JOB_TYPE = 'SBS')
            if (e.type === 'SBS') {
              return '';
            }
            // Encode job entry as URL parameter for action handlers
            const arg = encodeURIComponent(JSON.stringify(e));
            // Conditionally show Hold or Release button based on job status
            // If job is HLD, show Release button; otherwise show Hold button
            return `<vscode-button appearance="primary" href="action:wrkJob?entry=${arg}">${vscode.l10n.t("Details")}</vscode-button>
                  ${e.status !== 'HLD' ? `<vscode-button appearance="secondary" href="action:holdJob?entry=${arg}">${vscode.l10n.t("Hold")}</vscode-button>` :
                    `<vscode-button appearance="secondary" href="action:releaseJob?entry=${arg}">${vscode.l10n.t("Release")}</vscode-button>`}
                  <vscode-button appearance="secondary" href="action:endJob?entry=${arg}">${vscode.l10n.t("End")}</vscode-button>`;
          }
        }
      ];

      // Custom CSS styles for the active jobs table
      const customStyles = `
        /* Highlight job names with link color for better visibility */
        .active-jobs-table vscode-table-cell:nth-child(2) {
            color: var(--vscode-textLink-foreground);
        }
      `;

      // Function to generate the table HTML
      const generateTableHtml = () => {
        return `<div class="active-jobs-table">` + generateFastTable({
          title: vscode.l10n.t("Work with Active Jobs"),
          subtitle: vscode.l10n.t("Total Active Jobs: {0}", String(activeJobs?.length || 0)),
          columns: jobColumns,
          data: activeJobs || [],
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No active jobs found."),
          customStyles: customStyles,
          enableSearch: true,
          searchPlaceholder: vscode.l10n.t("Search jobs..."),
          searchTerm: searchTerm
        }) + `</div>`;
      };

      // Generate initial HTML
      panel.webview.html = generatePage(generateTableHtml());

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(async (message) => {
        // Handle search
        if (message.command === 'search') {
          if (message.searchTerm !== undefined) {
            searchTerm = message.searchTerm;
          }

          // Re-fetch data with new search term
          const newJobs = await fetchActiveJobs(searchTerm);
          if (newJobs) {
            activeJobs = newJobs;
            panel.webview.html = generatePage(generateTableHtml());
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
          case "wrkJob":
            // Open WRKJOB for the selected job
            await vscode.commands.executeCommand('vscode-ibmi-fs.wrkjob', entry.job);
            break;

          case "holdJob":
            if (await JobOperations.holdJob({ job: entry.job })) {
              refetch = true;
            }
            break;

          case "releaseJob":
            if (await JobOperations.releaseJob({ job: entry.job })) {
              refetch = true;
            }
            break;

          case "endJob":
            if (await JobOperations.endJob({ job: entry.job })) {
              refetch = true;
            }
            break;
        }

        // Refresh the view if needed
        if (refetch) {
          const newJobs = await fetchActiveJobs(searchTerm);
          if (newJobs) {
            activeJobs = newJobs;
            panel.webview.html = generatePage(generateTableHtml());
          }
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error opening WRKACTJOB: {0}", String(error)));
      return false;
    }
  };
}