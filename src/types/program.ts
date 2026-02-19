/**
 * Program Management Module
 *
 * This module provides functionality for viewing IBM i Programs (*PGM) and Service Programs (*SRVPGM).
 * Programs are executable objects that contain compiled code, while Service Programs provide
 * reusable procedures that can be bound to other programs.
 *
 * Key Features:
 * - Display program and service program information and attributes
 * - View bound modules with source information
 * - View bound service programs with signatures
 * - View exported procedures (for service programs)
 * - View SQL settings and optimization details
 * - View activation group and storage model information
 * - Read-only view (no modification capabilities)
 *
 * @module program
 */

import { IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, checkViewExists } from "../tools";
import { t } from '../l10n';

/**
 * Interface representing a bound module within a program
 */
interface Module {
  /** Module name with library (library/module) */
  module: string
  /** Module attribute (e.g., RPGLE, CLLE, C) */
  type: string
  /** Module creation timestamp */
  creation: string
  /** Source file or stream file path */
  source: string
  /** Source file last change timestamp */
  sourcechg: string
  /** Debug data availability */
  debug: string
  /** Release program was created on */
  crtrls: string
  /** Target release for the module */
  tgtrls: string
  /** Whether source can be retrieved */
  rtvclsrc: string
}

/**
 * Interface representing a bound service program
 */
interface Srvpgm {
  /** Service program name with library */
  srvpgm: string
  /** Service program signature */
  signature: string
  /** Activation type (*IMMED or *DEFER) */
  activation: string
}

/**
 * Interface representing an exported procedure or data item
 */
interface Export {
  /** Procedure or data item name */
  method: string
  /** Usage type (PROCEDURE or DATA) */
  usage: string
}

/**
 * Program (*PGM) and Service Program (*SRVPGM) object class
 * Handles display of IBM i Program and Service Program information
 */
export class Pgm extends Base {
  /** List of bound modules */
  private readonly modules: Module[] = [];
  /** List of bound service programs */
  private readonly srvpgms: Srvpgm[] = [];
  /** List of exported procedures (for service programs) */
  private readonly exports: Export[] = [];
  private _keyed = false;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Program information from database */
  private pgm?: any;
  /** Flag indicating if this is a service program */
  private isSrvpgm: boolean = false;


  /**
   * Fetch program information, modules, service programs, and exports
   */
  async fetch() {
    await this.fetchInfo();
    await this.fetchModules();
    await this.fetchSrvpgms();

    if (this.isSrvpgm) {
      await this.fetchExports();
    }
  }

  /**
   * Fetch program metadata from IBM i
   * Retrieves comprehensive program details from QSYS2.PROGRAM_INFO catalog
   */
  async fetchInfo() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      // Check if PROGRAM_INFO view exists
      if (!await checkViewExists(connection, 'QSYS2', 'PROGRAM_INFO')) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "PROGRAM_INFO"));
        return;
      }

      this.columns = await getColumns(connection, 'PROGRAM_INFO');

      // Query to get program information
      this.pgm = await connection.runSQL(
        `SELECT PROGRAM_TYPE,
          OBJECT_TYPE,
          to_char(CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS CREATE_TIMESTAMP,
          TEXT_DESCRIPTION,
          PROGRAM_OWNER,
          PROGRAM_ATTRIBUTE,
          USER_PROFILE,
          USE_ADOPTED_AUTHORITY,
          PROGRAM_STATE,
          PROGRAM_DOMAIN,
          EARLIEST_POSSIBLE_RELEASE,
          RELEASE_CREATED_ON,
          TARGET_RELEASE,
          MINIMUM_NUMBER_PARMS,
          MAXIMUM_NUMBER_PARMS,
          ASSOCIATED_SPACE_SIZE,
          PAGING_POOL,
          PAGING_AMOUNT,
          ALLOW_RTVCLSRC,
          CONVERSION_REQUIRED,
          CONVERSION_DETAIL,
          PROGRAM_ENTRY_PROCEDURE_MODULE_LIBRARY CONCAT '/' CONCAT PROGRAM_ENTRY_PROCEDURE_MODULE as PROGRAM_ENTRY_PROCEDURE_MODULE,
          ACTIVATION_GROUP,
          SHARED_ACTIVATION_GROUP,
          OBSERVABLE_INFO_COMPRESSED,
          RUNTIME_INFO_COMPRESSED,
          ALLOW_UPDATE,
          ALLOW_BOUND_SRVPGM_LIBRARY_UPDATE,
          ALL_CREATION_DATA,
          PROFILING_DATA,
          TERASPACE_STORAGE_ENABLED_MODULES,
          TERASPACE_STORAGE_ENABLED_PEP,
          STORAGE_MODEL,
          ARGUMENT_OPTIMIZATION,
          NUMBER_OF_UNRESOLVED_REFERENCES,
          ALLOW_STATIC_STORAGE_REINIT,
          MINIMUM_STATIC_STORAGE_SIZE,
          MAXIMUM_STATIC_STORAGE_SIZE,
          AUXILIARY_STORAGE_SEGMENTS CONCAT ' / ' CONCAT MAXIMUM_AUXILIARY_STORAGE_SEGMENTS AS AUXILIARY_STORAGE_SEGMENTS,
          PROGRAM_SIZE CONCAT ' / ' CONCAT MAXIMUM_PROGRAM_SIZE AS PROGRAM_SIZE,
          MODULES CONCAT ' / ' CONCAT MAXIMUM_MODULES AS MODULES,
          SERVICE_PROGRAMS CONCAT ' / ' CONCAT MAXIMUM_SERVICE_PROGRAMS AS SERVICE_PROGRAMS,
          STRING_DIRECTORY_SIZE CONCAT ' / ' CONCAT MAXIMUM_STRING_DIRECTORY_SIZE AS STRING_DIRECTORY_SIZE,
          COPYRIGHTS,
          COPYRIGHT_STRINGS,
          COPYRIGHT_STRING_SIZE CONCAT ' / ' CONCAT MAXIMUM_COPYRIGHT_STRING_SIZE AS COPYRIGHT_STRING_SIZE,
          EXPORT_SOURCE_LIBRARY CONCAT ' / ' CONCAT EXPORT_SOURCE_FILE concat ', ' concat  EXPORT_SOURCE_FILE_MEMBER as EXPORT_SOURCE_FILE,
          EXPORT_SOURCE_STREAM_FILE,
          PROCEDURE_EXPORTS CONCAT ' / ' CONCAT MAXIMUM_PROCEDURE_EXPORTS AS PROCEDURE_EXPORTS,
          DATA_EXPORTS CONCAT ' / ' CONCAT MAXIMUM_DATA_EXPORTS AS DATA_EXPORTS,
          SIGNATURES CONCAT ' / ' CONCAT MAXIMUM_SIGNATURES AS SIGNATURES,
          EXPORT_SIGNATURES,
          SOURCE_FILE_LIBRARY CONCAT '/' CONCAT SOURCE_FILE CONCAT ', ' CONCAT SOURCE_FILE_MEMBER as SOURCE_FILE,
          SOURCE_FILE_CHANGE_TIMESTAMP,
          SORT_SEQUENCE_LIBRARY,
          SORT_SEQUENCE,
          LANGUAGE_ID,
          OBSERVABLE,
          OPTIMIZATION,
          LOG_COMMANDS,
          FIX_DECIMAL_DATA,
          UPDATE_PASA,
          CLEAR_PASA,
          COMPILER_ID,
          TERASPACE_STORAGE_ENABLED_PROGRAM,
          OPM_PROGRAM_SIZE,
          STATIC_STORAGE_SIZE,
          AUTOMATIC_STORAGE_SIZE,
          NUMBER_MI_INSTRUCTIONS,
          NUMBER_MI_ODT_ENTRIES,
          SQL_STATEMENT_COUNT,
          SQL_RELATIONAL_DATABASE,
          SQL_COMMITMENT_CONTROL,
          SQL_NAMING,
          SQL_DATE_FORMAT,
          SQL_DATE_SEPARATOR,
          SQL_TIME_FORMAT,
          SQL_TIME_SEPARATOR,
          SQL_SORT_SEQUENCE_LIBRARY,
          SQL_SORT_SEQUENCE,
          SQL_LANGUAGE_ID,
          SQL_DEFAULT_SCHEMA,
          SQL_PATH,
          SQL_DYNAMIC_USER_PROFILE,
          SQL_ALLOW_COPY_DATA,
          SQL_CLOSE_SQL_CURSOR,
          SQL_DELAY_PREPARE,
          SQL_ALLOW_BLOCK,
          SQL_PACKAGE_LIBRARY,
          SQL_PACKAGE,
          SQL_RDB_CONNECTION_METHOD
        FROM QSYS2.PROGRAM_INFO
        WHERE PROGRAM_LIBRARY = '${this.library}' AND PROGRAM_NAME='${this.name}'
        Fetch first row only`);

      this.isSrvpgm = this.pgm[0].OBJECT_TYPE === '*SRVPGM';
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch all bound modules for the program
   * Retrieves module information from QSYS2.BOUND_MODULE_INFO catalog
   */
  private async fetchModules() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if BOUND_MODULE_INFO view exists
      const viewExists = await checkViewExists(connection, 'QSYS2', 'BOUND_MODULE_INFO');
      if (!viewExists) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "BOUND_MODULE_INFO"));
        return;
      }

      this.modules.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT BOUND_MODULE_LIBRARY CONCAT '/' CONCAT BOUND_MODULE AS module,
          MODULE_ATTRIBUTE,
          to_char(MODULE_CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS MODULE_CREATE_TIMESTAMP,
          CASE
              WHEN
                  SOURCE_STREAM_FILE_PATH IS null
                  THEN SOURCE_FILE_LIBRARY CONCAT '/' CONCAT SOURCE_FILE CONCAT ', ' CONCAT SOURCE_FILE_MEMBER
              ELSE SOURCE_STREAM_FILE_PATH
          END AS src,
          to_char(SOURCE_CHANGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS SOURCE_CHANGE_TIMESTAMP,
          DEBUG_DATA,
          RELEASE_CREATED_ON,
          TARGET_RELEASE,
          ALLOW_RTVCLSRC
        FROM QSYS2.BOUND_MODULE_INFO
        WHERE PROGRAM_LIBRARY = '${this.library}' AND PROGRAM_NAME='${this.name}'`);

      this.modules.push(...entryRows.map(toModules));
    }
  }

  /**
   * Fetch all bound service programs for the program
   * Retrieves service program binding information from QSYS2.BOUND_SRVPGM_INFO catalog
   */
  private async fetchSrvpgms() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if BOUND_SRVPGM_INFO view exists
      const viewExists = await checkViewExists(connection, 'QSYS2', 'BOUND_SRVPGM_INFO');
      if (!viewExists) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "BOUND_SRVPGM_INFO"));
        return;
      }

      this.srvpgms.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT BOUND_SERVICE_PROGRAM_LIBRARY CONCAT '/' CONCAT BOUND_SERVICE_PROGRAM as srvpgm,
          BOUND_SERVICE_PROGRAM_SIGNATURE,
          BOUND_SERVICE_PROGRAM_ACTIVATION
        FROM QSYS2.BOUND_SRVPGM_INFO
        WHERE PROGRAM_LIBRARY = '${this.library}' AND PROGRAM_NAME='${this.name}'`);

      this.srvpgms.push(...entryRows.map(toSrvpgm));
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch exported procedures and data items (for service programs only)
   * Retrieves export information from QSYS2.PROGRAM_EXPORT_IMPORT_INFO catalog
   */
  private async fetchExports() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if PROGRAM_EXPORT_IMPORT_INFO view exists
      const viewExists = await checkViewExists(connection, 'QSYS2', 'PROGRAM_EXPORT_IMPORT_INFO');
      if (!viewExists) {
        vscode.window.showErrorMessage(t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "PROGRAM_EXPORT_IMPORT_INFO"));
        return;
      }

      this.exports.length = 0;
      const entryRows = await connection.runSQL(`
        select SYMBOL_NAME, SYMBOL_USAGE 
        from QSYS2.PROGRAM_EXPORT_IMPORT_INFO
        WHERE PROGRAM_LIBRARY = '${this.library}' AND PROGRAM_NAME='${this.name}'`);

      this.exports.push(...entryRows.map(toExport));
    } else {
      vscode.window.showErrorMessage(t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the program view with tabs
   * @returns HTML string containing tabbed interface with program details, bounds, and exports
   */
  generateHTML(): string {
    const panels: Components.Panel[] = [{ title: t("Detail"), content: this.renderPgmPanel() }];

    if (this.srvpgms.length + this.modules.length > 0) {
      panels.push({ title: t("Bounds"), badge: this.srvpgms.length + this.modules.length, content: renderBounds(this.modules, this.srvpgms) })
    }

    if (this.isSrvpgm) {
      panels.push({ title: t("Exports"), badge: this.exports.length, content: renderExports(this.exports) });
    }

    return Components.panels(panels);
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for programs (read-only view)
    return {};
  }

  /**
   * Save changes (not applicable for programs)
   */
  async save() {
    // Programs are read-only in this view
  }

  /**
   * Render the program information panel
   * @returns HTML string for the detail panel
   */
  private renderPgmPanel(): string {
    return generateDetailTable({
      title: t("{0}: {1}/{2}", this.isSrvpgm ? t('Service Program') : t('Program'), this.library, this.name),
      subtitle: t("{0} Information", this.isSrvpgm ? t('Service Program') : t('Program')),
      columns: this.columns,
      data: this.pgm,
      codeColumns: ['COPYRIGHT_STRINGS', 'EXPORT_SIGNATURES'],
      hideNullValues: true
    });
  }
}

/**
 * Convert a database row to a Module object
 * @param row - Database row from QSYS2.BOUND_MODULE_INFO
 * @returns Module object
 */
function toModules(row: Tools.DB2Row): Module {
  return {
    module: String(row.MODULE),
    type: String(row.MODULE_ATTRIBUTE),
    creation: String(row.MODULE_CREATE_TIMESTAMP),
    source: String(row.SRC),
    sourcechg: String(row.SOURCE_CHANGE_TIMESTAMP),
    debug: String(row.DEBUG_DATA),
    crtrls: String(row.RELEASE_CREATED_ON),
    tgtrls: String(row.TARGET_RELEASE),
    rtvclsrc: String(row.ALLOW_RTVCLSRC),
  };
}

/**
 * Convert a database row to a Srvpgm object
 * @param row - Database row from QSYS2.BOUND_SRVPGM_INFO
 * @returns Srvpgm object
 */
function toSrvpgm(row: Tools.DB2Row): Srvpgm {
  return {
    srvpgm: String(row.SRVPGM),
    signature: String(row.BOUND_SERVICE_PROGRAM_SIGNATURE),
    activation: String(row.BOUND_SERVICE_PROGRAM_ACTIVATION)
  };
}

/**
 * Convert a database row to an Export object
 * @param row - Database row from QSYS2.PROGRAM_EXPORT_IMPORT_INFO
 * @returns Export object
 */
function toExport(row: Tools.DB2Row): Export {
  return {
    method: String(row.SYMBOL_NAME),
    usage: String(row.SYMBOL_USAGE)
  };
}

/**
 * Render the bounds panel showing modules and service programs
 * @param modules - Array of bound modules
 * @param srvpgms - Array of bound service programs
 * @returns HTML string for the bounds panel with two tables
 */
function renderBounds(modules: Module[], srvpgms: Srvpgm[]) {
  let columnsmod: FastTableColumn<Module>[] = [
    { title: t("Module"), width: "1fr", getValue: e => e.module },
    { title: t("Type"), width: "0.5fr", getValue: e => e.type },
    { title: t("Creation"), width: "1fr", getValue: e => e.creation },
    { title: t("Source"), width: "2fr", getValue: e => e.source },
    { title: t("Source Change"), width: "1fr", getValue: e => e.sourcechg },
    { title: t("Debug Data"), width: "0.5fr", getValue: e => e.debug },
    { title: t("Creation Release"), width: "0.5fr", getValue: e => e.crtrls },
    { title: t("Target Release"), width: "0.5fr", getValue: e => e.tgtrls },
    { title: t("RTVCLSRC"), width: "0.7fr", getValue: e => e.rtvclsrc },
  ];

  const customStyles = `
    /* Custom styles for module name cells */
    .modules-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  let html = `<div class="modules-entries-table">` + generateFastTable({
    title: t(`Modules`),
    subtitle: ``,
    columns: columnsmod,
    data: modules,
    stickyHeader: true,
    emptyMessage: t('No modules in this pgm.'),
    customStyles: customStyles,
  }) + `</div>${Components.divider()}`;

  let columnssrvpgm: FastTableColumn<Srvpgm>[] = [
    { title: t("Service program"), width: "1.5fr", getValue: e => e.srvpgm },
    { title: t("Signature"), width: "3fr", getValue: e => e.signature },
    { title: t("Activation"), width: "1fr", getValue: e => e.activation },
  ];

  const customStylesSrvpgm = `
    /* Custom styles for service program name cells */
    .srvpgm-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  html = html.trim() + `<div class="srvpgm-entries-table">` + generateFastTable({
    title: t(`Service Programs`),
    subtitle: ``,
    columns: columnssrvpgm,
    data: srvpgms,
    stickyHeader: true,
    emptyMessage: t('No service programs in this program.'),
    customStyles: customStylesSrvpgm,
    customScript: ""
  }) + `</div>`;

  return html;
}

/**
 * Render the exports panel showing exported procedures and data items
 * @param exports - Array of exported items
 * @returns HTML string for the exports panel
 */
function renderExports(exports: Export[]) {
  const columns: FastTableColumn<Export>[] = [
    { title: t("Procedure"), width: "1.5fr", getValue: e => e.method },
    { title: t("Usage"), width: "0.5fr", getValue: e => e.usage },
  ];

  const customStyles = `
    /* Custom styles for procedure name cells */
    .exports-entries-table vscode-table-cell:first-child {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="exports-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: exports,
    stickyHeader: true,
    emptyMessage: t('No exports in this service program.'),
    customStyles: customStyles,
    customScript: ""
  }) + `</div>`;
}