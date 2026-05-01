/**
 * Work with Spooled Files (WRKSPLF) Action Module
 *
 * This module provides functionality to display all spooled files in the system.
 * It opens a webview with a table containing all spooled files with search and pagination.
 *
 * @module wrksplf
 */

import * as vscode from 'vscode';
import { getInstance } from '../ibmi';
import { FastTableColumn, generateFastTable, executeSqlIfExists, checkTableFunctionExists } from "../tools";
import { generatePage } from "../webviewToolkit";
import { SpoolOperations } from '../commonOperations';

/**
 * Namespace containing actions for Work with Spooled Files
 */
export namespace WrksplfActions {
  /**
   * Register Work with Spooled Files commands with VS Code
   * @param context - Extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.wrksplf", async () => {
        return openWrksplfWebview();
      })
    );
  };

  /**
   * Interface representing a spooled file entry
   */
  interface Entry {
    /** Timestamp when spool was created */
    spoolts: string
    /** Spooled file name */
    spoolname: string
    /** User who created the spool */
    spooluser: string
    /** User data associated with the spool */
    spooldta: string
    /** Spool status */
    spoolsts: string
    /** Spool size in KB */
    spoolsiz: number
    /** Number of pages */
    pages: number
    /** Job name that created the spool */
    job: string
    /** Spool file number */
    nbr: number
  }

  /**
   * Fetch spooled files from the system with pagination and search
   * @param searchTerm - Search term for filtering
   * @param currentPage - Current page number
   * @param itemsPerPage - Items per page
   * @returns Object with entries and total count, or null if error
   */
  const fetchSpooledFiles = async (searchTerm: string = '', currentPage: number = 1, itemsPerPage: number = 50): Promise<{ entries: Entry[], totalItems: number } | null> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      throw new Error(vscode.l10n.t("Not connected to IBM i"));
    }

    // Check if the table function exists
    const functionExists = await checkTableFunctionExists(connection, 'QSYS2', 'SPOOLED_FILE_INFO');
    
    if (!functionExists) {
      vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "SPOOLED_FILE_INFO"));
      return null;
    }

    // Build WHERE clause for search
    let whereClause = '1=1';
    if (searchTerm && searchTerm.trim() !== '' && searchTerm.trim() !== '-') {
      const searchPattern = `%${searchTerm.trim().toUpperCase()}%`;
      whereClause += ` AND (
        UPPER(SPOOLED_FILE_NAME) LIKE '${searchPattern}' OR
        UPPER(JOB_USER) LIKE '${searchPattern}' OR
        UPPER(USER_DATA) LIKE '${searchPattern}' OR
        UPPER(STATUS) LIKE '${searchPattern}' OR
        UPPER(QUALIFIED_JOB_NAME) LIKE '${searchPattern}'
      )`;
    }

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as TOTAL
      FROM TABLE(QSYS2.SPOOLED_FILE_INFO())
      WHERE ${whereClause}
    `;

    const countRows = await executeSqlIfExists(
      connection,
      countQuery,
      'QSYS2',
      'SPOOLED_FILE_INFO',
      'FUNCTION'
    );

    if (countRows === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "SPOOLED_FILE_INFO")
      );
      return null;
    }

    const totalItems = countRows.length > 0 ? Number(countRows[0].TOTAL) : 0;

    // Calculate OFFSET for pagination
    const offset = (currentPage - 1) * itemsPerPage;

    // Fetch paginated data
    const query = `
      SELECT TO_CHAR(CREATION_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS CREATE_TIMESTAMP,
             SPOOLED_FILE_NAME,
             JOB_USER AS USER_NAME,
             USER_DATA,
             STATUS,
             SIZE,
             TOTAL_PAGES,
             QUALIFIED_JOB_NAME AS JOB_NAME,
             SPOOLED_FILE_NUMBER AS FILE_NUMBER
      FROM TABLE(QSYS2.SPOOLED_FILE_INFO())
      WHERE ${whereClause}
      ORDER BY CREATION_TIMESTAMP DESC
      LIMIT ${itemsPerPage} OFFSET ${offset}
    `;

    const result = await executeSqlIfExists(
      connection,
      query,
      'QSYS2',
      'SPOOLED_FILE_INFO',
      'FUNCTION'
    );

    if (result === null) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "TABLE FUNCTION", "QSYS2", "SPOOLED_FILE_INFO")
      );
      return null;
    }

    const entries = result.map((row: any): Entry => ({
      spoolts: String(row.CREATE_TIMESTAMP),
      spoolname: String(row.SPOOLED_FILE_NAME),
      spooluser: String(row.USER_NAME),
      spooldta: String(row.USER_DATA),
      spoolsts: String(row.STATUS),
      spoolsiz: Number(row.SIZE),
      pages: Number(row.TOTAL_PAGES),
      job: String(row.JOB_NAME),
      nbr: Number(row.FILE_NUMBER),
    }));

    return { entries, totalItems };
  };

  /**
   * Open the Work with Spooled Files webview
   * @returns True if successful, false otherwise
   */
  const openWrksplfWebview = async (): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // State for pagination and search
      let searchTerm = '';
      let currentPage = 1;
      let itemsPerPage = 50;
      let totalItems = 0;

      // Fetch spooled files data
      const result = await fetchSpooledFiles(searchTerm, currentPage, itemsPerPage);

      // Check if fetch failed
      if (result === null) {
        return false;
      }

      let spooledFiles = result.entries;
      totalItems = result.totalItems;

      // Create webview panel
      const panel = vscode.window.createWebviewPanel(
        'wrksplfView',
        vscode.l10n.t("Work with Spooled Files"),
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true
        }
      );

      // Add refresh button to the webview toolbar
      const refreshDisposable = vscode.commands.registerCommand('vscode-ibmi-fs.refreshWrksplf', async () => {
        const newResult = await fetchSpooledFiles(searchTerm, currentPage, itemsPerPage);
        if (newResult) {
          spooledFiles = newResult.entries;
          totalItems = newResult.totalItems;
          panel.webview.html = generatePage(generateTableHtml());
          vscode.window.showInformationMessage(vscode.l10n.t('Spooled files refreshed successfully'));
        }
      });

      // Clean up the command when panel is disposed
      panel.onDidDispose(() => {
        refreshDisposable.dispose();
      });

      // Define columns for spooled files table
      const spoolColumns: FastTableColumn<Entry>[] = [
        { title: vscode.l10n.t("Name"), width: "1fr", getValue: e => e.spoolname },
        { title: vscode.l10n.t("Data"), width: "1fr", getValue: e => e.spooldta },
        { title: vscode.l10n.t("Status"), width: "0.5fr", getValue: e => e.spoolsts },
        { title: vscode.l10n.t("User"), width: "1fr", getValue: e => e.spooluser },
        { title: vscode.l10n.t("Job"), width: "2fr", getValue: e => e.job },
        { title: vscode.l10n.t("Number"), width: "0.7fr", getValue: e => String(e.nbr) },
        { title: vscode.l10n.t("Timestamp"), width: "1.5fr", getValue: e => e.spoolts },
        { title: vscode.l10n.t("Pages"), width: "0.5fr", getValue: e => String(e.pages) },
        { title: vscode.l10n.t("Size (KB)"), width: "1fr", getValue: e => String(e.spoolsiz) },
        {
          title: vscode.l10n.t("Actions"),
          width: "1.5fr",
          getValue: e => {
            // Encode spool entry as URL parameter for action handlers
            const arg = encodeURIComponent(JSON.stringify(e));
            return `<vscode-button appearance="primary" href="action:openSpool?entry=${arg}">${vscode.l10n.t("Open")}</vscode-button>
                  <vscode-button appearance="primary" href="action:genPdf?entry=${arg}">${vscode.l10n.t("Download")}</vscode-button>
                  <vscode-button appearance="secondary" href="action:delSpool?entry=${arg}">${vscode.l10n.t("Delete")}</vscode-button>`;
          }
        }
      ];

      // Custom CSS styles for the spool files table
      const customStyles = `
        /* Highlight spool names with link color for better visibility */
        .spool-files-table vscode-table-cell:first-child {
            color: var(--vscode-textLink-foreground);
        }
      `;

      // Function to generate the table HTML
      const generateTableHtml = () => {
        return `<div class="spool-files-table">` + generateFastTable({
          title: vscode.l10n.t("Work with Spooled Files"),
          subtitle: vscode.l10n.t("Total Spools: {0}", String(totalItems)),
          columns: spoolColumns,
          data: spooledFiles,
          stickyHeader: true,
          emptyMessage: vscode.l10n.t("No spooled files found."),
          customStyles: customStyles,
          enableSearch: true,
          searchPlaceholder: vscode.l10n.t("Search spools..."),
          enablePagination: true,
          itemsPerPage: itemsPerPage,
          totalItems: totalItems,
          currentPage: currentPage,
          searchTerm: searchTerm
        }) + `</div>`;
      };

      // Generate initial HTML
      panel.webview.html = generatePage(generateTableHtml());

      // Handle messages from the webview
      panel.webview.onDidReceiveMessage(async (message) => {
        // Handle search and pagination
        if (message.command === 'search' || message.command === 'paginate') {
          if (message.searchTerm !== undefined) {
            searchTerm = message.searchTerm;
          }
          if (message.page !== undefined) {
            currentPage = message.page;
          }
          if (message.itemsPerPage !== undefined) {
            itemsPerPage = message.itemsPerPage;
          }

          // Re-fetch data with new parameters
          const newResult = await fetchSpooledFiles(searchTerm, currentPage, itemsPerPage);
          if (newResult) {
            spooledFiles = newResult.entries;
            totalItems = newResult.totalItems;
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

        switch (uri.path) {
          case "openSpool":
            await SpoolOperations.openSpool({
              spoolname: entry.spoolname,
              nbr: entry.nbr,
              job: entry.job
            });
            break;

          case "genPdf":
            await SpoolOperations.downloadSpoolAsPdf({
              spoolname: entry.spoolname,
              nbr: entry.nbr,
              job: entry.job
            }, 'generatedPDF');
            break;

          case "delSpool":
            const deleted = await SpoolOperations.deleteSpool({
              spoolname: entry.spoolname,
              nbr: entry.nbr,
              job: entry.job
            });
            
            if (deleted) {
              // Refresh the view with current search/pagination settings
              const newResult = await fetchSpooledFiles(searchTerm, currentPage, itemsPerPage);
              if (newResult) {
                spooledFiles = newResult.entries;
                totalItems = newResult.totalItems;
                panel.webview.html = generatePage(generateTableHtml());
              }
            }
            break;
        }
      });

      return true;
    } catch (error) {
      vscode.window.showErrorMessage(vscode.l10n.t("Error opening WRKSPLF: {0}", String(error)));
      return false;
    }
  };
}
