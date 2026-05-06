/**
 * Work with User Jobs (WRKUSRJOB) Action Module
 *
 * This module provides functionality to display all jobs (active and inactive) in the system.
 * It opens a webview with a table containing all jobs with conditional actions based on status.
 *
 * @module wrkusrjob
 */

import * as vscode from 'vscode';
import { getInstance } from '../ibmi';
import { FastTableColumn, generateFastTable, executeSqlIfExists, checkTableFunctionExists } from "../tools";
import { generatePage } from "../webviewToolkit";
import { JobOperations } from '../commonOperations';

/**
 * Namespace containing actions for Work with User Jobs
 */
export namespace WrkusrjobActions {
  /**
   * Register Work with User Jobs commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrkusrjob", async () => {
        return openWrkusrjobWebview();
      })
    );
  };

  /**
   * Interface representing a user job entry
   */
  interface Entry {
    /** Job name */
    job: string;
    /** Job status */
    jobStatus: string;
    /** Active status (from ACTIVE_JOB_INFO) */
    activeStatus: string;
    /** Job type */
    jobType: string;
    /** Job end severity */
    endSeverity: number;
    /** Completion status */
    completionStatus: string;
    /** Function */
    function: string;
  }

  /**
   * Fetch user jobs from the system with search filtering
   * @param searchTerm - Search term for filtering
   * @returns Array of user job entries, or null if error
   */
  const fetchUserJobs = async (searchTerm: string = ''): Promise<Entry[] | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    // Check if the table functions exist
    const jobInfoExists = await checkTableFunctionExists(connection, 'QSYS2', 'JOB_INFO');
    
    if (!jobInfoExists) {
      vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "JOB_INFO"));
      return null;
    }

    // Build WHERE clause for search
    let whereClause = '1=1';
    if (searchTerm && searchTerm.trim() !== '' && searchTerm.trim() !== '-') {
      const searchPattern = `%${searchTerm.trim().toUpperCase()}%`;
      whereClause += ` AND (
        UPPER(JI.JOB_NAME) LIKE '${searchPattern}' OR
        UPPER(JI.JOB_STATUS) LIKE '${searchPattern}' OR
        UPPER(AJ.JOB_STATUS) LIKE '${searchPattern}' OR
        UPPER(JI.JOB_TYPE) LIKE '${searchPattern}' OR
        UPPER(JI.COMPLETION_STATUS) LIKE '${searchPattern}' OR
        UPPER(AJ.FUNCTION_TYPE CONCAT '-' CONCAT AJ."FUNCTION") LIKE '${searchPattern}'
      )`;
    }

    // Fetch user jobs data with search filter
    const query = `
      SELECT JI.JOB_NAME,
             JI.JOB_STATUS,
             aj.JOB_STATUS AS ACTIVE_STATUS,
             JI.JOB_TYPE,
             JI.JOB_END_SEVERITY,
             JI.COMPLETION_STATUS,
             AJ.FUNCTION_TYPE CONCAT '-' CONCAT AJ."FUNCTION" "FUNCTION"
      FROM TABLE (
               QSYS2.JOB_INFO(JOB_STATUS_FILTER => '*ALL')
           ) JI
           LEFT JOIN TABLE (
                   QSYS2.ACTIVE_JOB_INFO(DETAILED_INFO => 'NONE')
               ) AJ
               ON JI.JOB_NAME = AJ.JOB_NAME
      WHERE ${whereClause}
      ORDER BY JI.JOB_NAME ASC
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'JOB_INFO',
      'FUNCTION'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "JOB_INFO")
      );
      return null;
    }

    const entries = result.map((row: any): Entry => ({
      job: String(row.JOB_NAME),
      jobStatus: String(row.JOB_STATUS || ''),
      activeStatus: String(row.ACTIVE_STATUS || ''),
      jobType: String(row.JOB_TYPE || ''),
      endSeverity: Number(row.JOB_END_SEVERITY || 0),
      completionStatus: String(row.COMPLETION_STATUS || ''),
      function: String(row.FUNCTION || '')
    }));

    return entries;
  };

  /**
   * Open the Work with User Jobs webview
   * @returns True if successful, false otherwise
   */
  const openWrkusrjobWebview = async (): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // State for search
      let searchTerm = '';

      // Fetch user jobs data
      let userJobs = await fetchUserJobs(searchTerm);

      // Check if fetch failed
      if (userJobs === null) {
        return false;
      }

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrkusrjobView',
        vscode.l10n.t("Work with User Jobs"),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Add refresh button to the webview toolbar
      const refreshDisposable = vscode.commands.registerCommand('vscode-ibmi-fs.refreshWrkusrjob', async () => {
        const newJobs = await fetchUserJobs(searchTerm);
        if (newJobs) {
          userJobs = newJobs;
          panel.webview.html = generatePage(generateTableHtml());
          vscode.window.showInformationMessage(vscode.l10n.t('User jobs refreshed successfully'));
        }
      });

      // Clean up the command when panel is disposed
      panel.onDidDispose(() => {
        refreshDisposable.dispose();
      });

      // Define columns for user jobs table
      const jobColumns: FastTableColumn<Entry>[] = [
        { title: vscode.l10n.t("Job"), width: "2fr", getValue: e => e.job },
        { title: vscode.l10n.t("Job Status"), width: "1fr", getValue: e => e.jobStatus },
        { title: vscode.l10n.t("Active Status"), width: "1fr", getValue: e => e.activeStatus },
        { title: vscode.l10n.t("Type"), width: "0.5fr", getValue: e => e.jobType },
        { title: vscode.l10n.t("End Severity"), width: "0.7fr", getValue: e => String(e.endSeverity) },
        { title: vscode.l10n.t("Completion"), width: "1fr", getValue: e => e.completionStatus },
        { title: vscode.l10n.t("Function"), width: "1fr", getValue: e => e.function },
        {
          title: vscode.l10n.t("Actions"),
          width: "2.5fr",
          getValue: e => {
            // Encode job entry as URL parameter for action handlers
            const arg = encodeURIComponent(JSON.stringify(e));
            
            // Build action buttons based on job status
            let buttons = `<vscode-button appearance="primary" href="action:wrkJob?entry=${arg}">${vscode.l10n.t("Details")}</vscode-button>`;
            
            // If job is ACTIVE, show conditional Hold/Release and End buttons
            if (e.jobStatus === 'ACTIVE') {
              // If active status is HLD, show Release button; otherwise show Hold button
              if (e.activeStatus === 'HLD') {
                buttons += ` <vscode-button appearance="secondary" href="action:releaseJob?entry=${arg}">${vscode.l10n.t("Release")}</vscode-button>`;
              } else {
                buttons += ` <vscode-button appearance="secondary" href="action:holdJob?entry=${arg}">${vscode.l10n.t("Hold")}</vscode-button>`;
              }
              buttons += ` <vscode-button appearance="secondary" href="action:endJob?entry=${arg}">${vscode.l10n.t("End")}</vscode-button>`;
            }
            
            return buttons;
          }
        }
      ];

      // Custom CSS styles for the user jobs table
      const customStyles = `
        /* Highlight job names with link color for better visibility */
        .user-jobs-table vscode-table-cell:first-child {
            color: var(--vscode-textLink-foreground);
        }
      `;

      // Function to generate the table HTML
      const generateTableHtml = () => {
        return `<div class="user-jobs-table">` + generateFastTable({
          title: vscode.l10n.t("Work with User Jobs"),
          subtitle: vscode.l10n.t("Total Jobs: {0}", String(userJobs?.length || 0)),
          columns: jobColumns,
          data: userJobs || [],
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No jobs found."),
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
          const newJobs = await fetchUserJobs(searchTerm);
          if (newJobs) {
            userJobs = newJobs;
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
          const newJobs = await fetchUserJobs(searchTerm);
          if (newJobs) {
            userJobs = newJobs;
            panel.webview.html = generatePage(generateTableHtml());
          }
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error opening WRKUSRJOB: {0}", String(error)));
      return false;
    }
  };
}

// Made with Bob
