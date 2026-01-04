/**
 * Module Management Module
 *
 * This module provides functionality for viewing and analyzing IBM i Modules (*MODULE).
 * Modules are compiled objects that contain executable code and can be bound into programs
 * or service programs. They are the building blocks of ILE (Integrated Language Environment) applications.
 *
 * Key Features:
 * - Display comprehensive module information (creation date, source file, compiler options)
 * - View module size details (code size, data size, debug data)
 * - List all procedures defined in the module
 * - View imported and exported symbols
 * - Display referenced system objects
 * - Show copyright information
 * - Support for multiple detail views with tabbed interface
 *
 * @module module
 */

import { CommandResult, IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns, generateDetailTable, FastTableColumn, generateFastTable, generateRandomString } from "../tools";

/**
 * Interface representing a procedure entry in a module
 */
interface Entry {
  /** Procedure name */
  entry: string
  /** Procedure type (REGULAR or ENTRYPOINT) */
  type: string
  /** Argument optimization level */
  arg3: string
}

/**
 * Interface representing an imported or exported symbol
 */
interface ImpExport {
  /** Symbol name (procedure or data item) */
  method: string
  /** Symbol type (PROCEDURE or DATA) */
  type: string
  /** Argument optimization level */
  optimization: string
  /** Import or Export indicator */
  impexp: string
}

/**
 * Interface representing a copyright string
 */
interface Copyright {
  /** Copyright text */
  value: string
}

/**
 * Module (*MODULE) object class
 * Handles display and analysis of IBM i Module information
 */
export class Module extends Base {
  /** List of procedures defined in the module */
  private readonly procs: Entry[] = [];
  /** List of imported and exported symbols */
  private readonly impexports: ImpExport[] = [];
  /** List of referenced system objects */
  private readonly sysobj: Entry[] = [];
  /** List of copyright strings */
  private readonly copyrights: Copyright[] = [];
  /** Column definitions for basic module information display */
  columns: Map<string, string> = new Map();
  /** Column definitions for size information display */
  columns2: Map<string, string> = new Map();
  selectClause: string | undefined;
  /** Module basic information from DSPMOD DETAIL(*BASIC) */
  private module?: any;
  /** Module size information from DSPMOD DETAIL(*SIZE) */
  private size?: any;
  /** Flag indicating if this is a service program (unused for modules) */
  private isSrvpgm: boolean = false;


  /**
   * Fetch program information, modules, service programs, and exports
   */
  async fetch() {

    await this.fetchBasic();
    await this.fetchSize();
    await this.fetchImpExports();
    await this.fetchProcList();
    await this.fetchSysObj();
    await this.fetchCopyRight();
  }

  /**
   * Fetch program metadata from IBM i
   * Retrieves comprehensive program details from QSYS2.PROGRAM_INFO catalog
   */
  /**
   * Fetch basic module information
   * Uses DSPMOD DETAIL(*BASIC) to retrieve module attributes including:
   * - Creation date and time
   * - Source file information
   * - Compiler options
   * - Optimization level
   * - Debug data availability
   * - SQL options
   */
  async fetchBasic() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const tmpfile=generateRandomString(10);

      this.columns = await getColumns(connection, 'QABNDMBA','QSYS');

      let cmdrun: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*BASIC) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });

      if (cmdrun.code !== 0) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun.stderr}`);
        return;
      }

      // Query to retrieve module basic information from temporary outfile
      this.module = await connection.runSQL(
        `SELECT bamoat,
          bamosy,
          to_char(TO_DATE(bacdat concat ' ' concat bactim, 'YYMMDD hh24miss'), 'yyyy-mm-dd HH24:mi') as bacdat,
          CASE
              WHEN TRIM(bastmf) = '' THEN TRIM(basrcl) CONCAT '/' CONCAT TRIM(basrcf) CONCAT ', ' CONCAT TRIM(basrcm)
              ELSE TRIM(bastmf)
          END AS basrcf,
          to_char(TO_DATE(basrcd concat ' ' concat basrct, 'YYMMDD hh24miss'), 'yyyy-mm-dd HH24:mi') as basrcd,
          bamown,
          baccsi,
          batext,
          bamit,
          basrtt,
          basrtl,
          balgid,
          baoplv,
          baoplx,
          badblv,
          bacomp,
          bapepn,
          baminp,
          bamaxp,
          bastat,
          badomn,
          banexs,
          banims,
          bacmco,
          bacmcf,
          bacert,
          basqln,
          basqlr,
          basqlc,
          basqla,
          basqlu,
          basqno,
          basqld,
          basqle,
          basqlt,
          basqlp,
          basqly,
          basqlb,
          basqdc,
          basqpn,
          basqpl,
          basqdu,
          basqss,
          basqsl,
          basqli,
          basqcm,
          basepl,
          basepp,
          bascnv,
          baprfd,
          baild,
          batera,
          basqpa,
          balico,
          bastgm,
          basqsz,
          basqpx,
          bacnvd,
          baarcs
        FROM ${connection.getConfig().tempLibrary}.${tmpfile}`);

      cmdrun = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });
    }
  }

  /**
   * Fetch module size information
   * Uses DSPMOD DETAIL(*SIZE) to retrieve detailed size metrics including:
   * - Total module size
   * - Procedure code size
   * - Debug data size
   * - Static storage size
   * - Type information size
   * - And many other size-related attributes
   */
  async fetchSize() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const tmpfile=generateRandomString(10);

      this.columns2 = await getColumns(connection, 'QABNDMSI','QSYS');

      let cmdrun: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*SIZE) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });

      if (cmdrun.code !== 0) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun.stderr}`);
        return;
      }

      // Query to retrieve module size information from temporary outfile
      this.size = await connection.runSQL(
        `SELECT SITMS CONCAT ' / ' CONCAT SITMSL SITMS,
          SIPCO CONCAT ' / ' CONCAT SIPCOL SIPCO,
          SIDBS CONCAT ' / ' CONCAT SIDBSL SIDBS,
          SIASP CONCAT ' / ' CONCAT SIASPl SIASP,
          SIMOC CONCAT ' / ' CONCAT SIMOCL SIMOC,
          SISTS CONCAT ' / ' CONCAT SISTSL SISTS,
          SIDMT CONCAT ' / ' CONCAT SIDMTL SIDMT,
          SIEHT CONCAT ' / ' CONCAT SIEHTL SIEHT,
          SIEML CONCAT ' / ' CONCAT SIEMLL SIEML,
          SIBNS CONCAT ' / ' CONCAT SIBNSL SIBNS,
          SISTD CONCAT ' / ' CONCAT SISTDL SISTD,
          SIDIC CONCAT ' / ' CONCAT SIDICL SIDIC,
          SIINC CONCAT ' / ' CONCAT SIINCL SIINC,
          SIIZC CONCAT ' / ' CONCAT SIIZCL SIIZC,
          SIALI CONCAT ' / ' CONCAT SIALIL SIALI,
          SITYP CONCAT ' / ' CONCAT SITYPL SITYP,
          SILIT CONCAT ' / ' CONCAT SILITL SILIT,
          SISWA CONCAT ' / ' CONCAT SISWAL SISWA,
          SIBWA CONCAT ' / ' CONCAT SIBWAL SIBWA,
          SIAXS CONCAT ' / ' CONCAT SIAXSL SIAXS,
          SISSF CONCAT ' / ' CONCAT SISSFL SISSF,
          SIPRO CONCAT ' / ' CONCAT SIPROL SIPRO,
          SICOP CONCAT ' / ' CONCAT SICOPL SICOP,
          SIPAS CONCAT ' / ' CONCAT SIPASL SIPAS,
          SIPASN,
          SIPVS CONCAT ' / ' CONCAT SIPVSL SIPVS,
          SIPVSN,
          SIPDS CONCAT ' / ' CONCAT SIPDSL SIPDS,
          SIPDSN,
          SIPES CONCAT ' / ' CONCAT SIPESL SIPES,
          SIPESN,
          SIPMI CONCAT ' / ' CONCAT SIPMIL SIPMI,
          SIPMIN,
          SIPLP CONCAT ' / ' CONCAT SIPLPL SIPLP,
          SIPLPN,
          SISTS8 CONCAT ' / ' CONCAT SISTSL8 SISTS8
        FROM ${connection.getConfig().tempLibrary}.${tmpfile}`);

      cmdrun = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });
    }
  }

  /**
   * Fetch imported and exported symbols
   * Uses DSPMOD DETAIL(*IMPORT) and DETAIL(*EXPORT) to retrieve:
   * - Imported procedures and data items from other modules/service programs
   * - Exported procedures and data items available to other modules
   * - Symbol types (PROCEDURE or DATA)
   * - Optimization information
   */
  private async fetchImpExports() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      const tmpfile1=generateRandomString(10);
      const tmpfile2=generateRandomString(10);

      let cmdrun1: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*IMPORT) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile1})`,
        environment: `ile`
      });

      let cmdrun2: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*EXPORT) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile2})`,
        environment: `ile`
      });

      if (cmdrun1.code !== 0 && cmdrun2.code !== 0) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun1.stderr}\n${cmdrun2.stderr}`);
        return;
      }

      this.impexports.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT *
          FROM (
                  SELECT imsynm AS symbol,
                        CASE imSYTY
                            WHEN '0' THEN 'PROCEDURE'
                            WHEN '1' THEN 'DATA'
                        END AS SYMBOL_TYPE,
                        IMOPPP AS ARGUMENT_OPTIMIZATION,
                        'IMPORT' AS TYPEOF
                      FROM ${connection.getConfig().tempLibrary}.${tmpfile1}
                  UNION
                  SELECT exsynm AS symbol,
                        CASE EXSYTY
                            WHEN '0' THEN 'PROCEDURE'
                            WHEN '1' THEN 'DATA'
                        END AS SYMBOL_TYPE,
                        EXOPPP AS ARGUMENT_OPTIMIZATION,
                        'EXPORT' AS TYPEOF
                      FROM ${connection.getConfig().tempLibrary}.${tmpfile2}
              )
          ORDER BY typeof`);
        
      this.impexports.push(...entryRows.map(toExport));
      
      cmdrun1 = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile1})`,
        environment: `ile`
      });
      cmdrun1 = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile2})`,
        environment: `ile`
      });
    }
  }

  /**
   * Fetch list of procedures defined in the module
   * Uses DSPMOD DETAIL(*PROCLIST) to retrieve:
   * - All procedure names defined in the module
   * - Procedure types (REGULAR or ENTRYPOINT)
   * - Argument optimization settings
   */
  private async fetchProcList() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      const tmpfile=generateRandomString(10);

      let cmdrun: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*PROCLIST) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });

      if (cmdrun.code !== 0 ) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun.stderr}`);
        return;
      }

      this.procs.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT prprnm AS PRCNAME,
          CASE prprTY
              WHEN '0' THEN 'REGULAR'
              WHEN '1' THEN 'ENTRYPOINT'
          END AS PRCTYPE,
          PROPPP AS ARGUMENT_OPTIMIZATION
        FROM ${connection.getConfig().tempLibrary}.${tmpfile}`);

      this.procs.push(...entryRows.map(toEntry));

      cmdrun = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });
    }
  }

  /**
   * Fetch referenced system objects
   * Uses DSPMOD DETAIL(*REFSYSOBJ) to retrieve:
   * - System objects referenced by the module
   * - Object names, libraries, and types
   * - Dependencies on other IBM i objects
   */
  private async fetchSysObj() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      const tmpfile=generateRandomString(10);

      let cmdrun: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*REFSYSOBJ) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });

      if (cmdrun.code !== 0 ) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun.stderr}`);
        return;
      }

      this.sysobj.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT reobnm,
          reolnm,
          reobty
        FROM ${connection.getConfig().tempLibrary}.${tmpfile}`);

      this.sysobj.push(...entryRows.map(toEntry2));

      cmdrun = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });
    }
  }

  /**
   * Fetch copyright information
   * Uses DSPMOD DETAIL(*COPYRIGHT) to retrieve:
   * - Copyright strings embedded in the module
   * - Legal and licensing information
   */
  private async fetchCopyRight() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      const tmpfile=generateRandomString(10);

      let cmdrun: CommandResult = await connection.runCommand({
        command: `DSPMOD MODULE(${this.library}/${this.name}) DETAIL(*COPYRIGHT) OUTPUT(*OUTFILE) OUTFILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });

      if (cmdrun.code !== 0 ) {
        vscode.window.showErrorMessage(`Unable to fetch data:\n${cmdrun.stderr}`);
        return;
      }

      this.copyrights.length = 0;
      const entryRows = await connection.runSQL(`
        SELECT COPYRT
        FROM ${connection.getConfig().tempLibrary}.${tmpfile}`);

      this.copyrights.push(...entryRows.map(toCopyRight));

      cmdrun = await connection.runCommand({
        command: `DLTF FILE(${connection.getConfig().tempLibrary}/${tmpfile})`,
        environment: `ile`
      });
    }
  }

  /**
   * Generate HTML for the module view with tabs
   * Creates a multi-panel interface displaying:
   * - Detail: Basic module information
   * - Size: Detailed size metrics
   * - Imports/Exports: Imported and exported symbols (if any)
   * - Procedures: List of procedures (if any)
   * - System objects reference: Referenced system objects (if any)
   * - Copyright: Copyright information (if any)
   * @returns HTML string containing tabbed interface with all module information
   */
  generateHTML(): string {
    const panels: Components.Panel[] = [
      { title: "Detail", content: this.renderModule() },
      { title: "Size", content: this.renderSize() },
    ];

    if (this.impexports.length>0) {
      panels.push({ title: "Imports/Exports", badge: this.impexports.length, content: renderExports(this.impexports) });
    }

    if (this.procs.length>0) {
      panels.push({ title: "Procedures", badge: this.procs.length, content: renderProcs(this.procs) });
    }

    if (this.sysobj.length>0) {
      panels.push({ title: "System objects reference", badge: this.sysobj.length, content: renderSysobj(this.sysobj) });
    }

    if (this.copyrights.length>0) {
      panels.push({ title: "Copyright", badge: this.copyrights.length, content: renderCopyright(this.copyrights) });
    }

    return Components.panels(panels);
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available for modules)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for modules (read-only view)
    return {};
  }

  /**
   * Save changes (not applicable for modules)
   * Modules are read-only objects in this viewer
   */
  async save() {
    // Modules are read-only in this view
  }

  /**
   * Render the module basic information panel
   * Displays module attributes from DSPMOD DETAIL(*BASIC)
   * @returns HTML string for the detail panel
   */
  private renderModule(): string {
    return generateDetailTable({
      title: `Module: ${this.library}/${this.name}`,
      subtitle: `Module Information`,
      columns: this.columns,
      data: this.module,
      hideNullValues: true
    });
  }

  /**
   * Render the module size information panel
   * Displays size metrics from DSPMOD DETAIL(*SIZE)
   * @returns HTML string for the size panel
   */
  private renderSize(): string {
    return generateDetailTable({
      title: ``,
      subtitle: ``,
      columns: this.columns2,
      data: this.size,
      hideNullValues: true
    });
  }
}

/**
 * Convert a database row to an ImpExport object
 * Maps import/export data from DSPMOD output files
 * @param row - Database row from DSPMOD DETAIL(*IMPORT) or DETAIL(*EXPORT)
 * @returns ImpExport object with symbol information
 */
function toExport(row: Tools.DB2Row): ImpExport {
  return {
    method: String(row.SYMBOL),
    type: String(row.SYMBOL_TYPE),
    optimization: String(row.ARGUMENT_OPTIMIZATION),
    impexp: String(row.TYPEOF),
  };
}

/**
 * Convert a database row to an Entry object (for procedures)
 * Maps procedure data from DSPMOD DETAIL(*PROCLIST)
 * @param row - Database row from procedure list
 * @returns Entry object with procedure information
 */
function toEntry(row: Tools.DB2Row): Entry {
  return {
    entry: String(row.PRCNAME),
    type: String(row.PRCTYPE),
    arg3: String(row.ARGUMENT_OPTIMIZATION),
  };
}

/**
 * Convert a database row to an Entry object (for system objects)
 * Maps system object reference data from DSPMOD DETAIL(*REFSYSOBJ)
 * @param row - Database row from system object references
 * @returns Entry object with system object information
 */
function toEntry2(row: Tools.DB2Row): Entry {
  return {
    entry: String(row.REOBNM),
    type: String(row.REOBTY),
    arg3: String(row.REOLNM),
  };
}

/**
 * Convert a database row to a Copyright object
 * Maps copyright data from DSPMOD DETAIL(*COPYRIGHT)
 * @param row - Database row from copyright information
 * @returns Copyright object with copyright text
 */
function toCopyRight(row: Tools.DB2Row): Copyright {
  return {
    value: String(row.COPYRT)
  };
}

/**
 * Render the procedures panel
 * Displays all procedures defined in the module with their types and optimization
 * @param exports - Array of procedure entries
 * @returns HTML string for the procedures table
 */
function renderProcs(exports: Entry[]) {
  const columns: FastTableColumn<Entry>[] = [
    { title: "Procedure", width: "1.5fr", getValue: e => e.entry },
    { title: "Procedure type", width: "0.5fr", getValue: e => e.type },
    { title: "Optimization", width: "0.5fr", getValue: e => e.arg3 },
  ];

  const customStyles = `
    /* Custom styles for procedure name cells */
    .procs-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="procs-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: exports,
    stickyHeader: true,
    emptyMessage: 'No procedures in this module.',
    customStyles: customStyles,
  }) + `</div>`;
}

/**
 * Render the system objects reference panel
 * Displays all system objects referenced by the module
 * @param exports - Array of system object entries
 * @returns HTML string for the system objects table
 */
function renderSysobj(exports: Entry[]) {
  const columns: FastTableColumn<Entry>[] = [
    { title: "Library", width: "1fr", getValue: e => e.arg3 },
    { title: "Object", width: "1fr", getValue: e => e.entry },
    { title: "Object type", width: "0.5fr", getValue: e => e.type },
  ];
  
  return `<div class="exports-sysobj-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: exports,
    stickyHeader: true,
    emptyMessage: 'No system objects referenced in this module.',
  }) + `</div>`;
}

/**
 * Render the imports/exports panel
 * Displays all imported and exported symbols (procedures and data items)
 * @param exports - Array of import/export entries
 * @returns HTML string for the imports/exports table
 */
function renderExports(exports: ImpExport[]) {
  const columns: FastTableColumn<ImpExport>[] = [
    { title: "Symbol", width: "1.5fr", getValue: e => e.method },
    { title: "Symbol type", width: "0.5fr", getValue: e => e.type },
    { title: "Optimization", width: "0.5fr", getValue: e => e.optimization },
    { title: "Category", width: "0.5fr", getValue: e => e.impexp },
  ];

  const customStyles = `
    /* Custom styles for procedure name cells */
    .exports-entries-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
    }
  `;
  
  return `<div class="exports-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: exports,
    stickyHeader: true,
    emptyMessage: 'No imports/exports in this module.',
    customStyles: customStyles,
  }) + `</div>`;
}

/**
 * Render the copyright panel
 * Displays copyright strings embedded in the module
 * @param crs - Array of copyright entries
 * @returns HTML string for the copyright table
 */
function renderCopyright(crs: Copyright[]) {
  const columns: FastTableColumn<Copyright>[] = [
    { title: "Text", width: "100%", getValue: e => e.value },
  ];
  
  return `<div class="crs-entries-table">` + generateFastTable({
    title: ``,
    subtitle: ``,
    columns: columns,
    data: crs,
    stickyHeader: true,
    emptyMessage: 'No copyright information in this module.',
  }) + `</div>`;
}