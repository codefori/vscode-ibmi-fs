/**
 * File Management Module
 *
 * This module provides functionality for managing IBM i FILE objects including physical files (PF),
 * logical files (LF), views, and indexes. It displays comprehensive file information, statistics,
 * members, and dependent objects.
 *
 * Key Features:
 * - Display file/table/view/index information and attributes
 * - View file statistics (rows, operations, reads/writes)
 * - Display file members with their statistics
 * - Show dependent objects (indexes, views, etc.)
 * - Query file contents using SQL
 * - Support for both DDS and SQL-based files
 *
 * @module file
 */

import Base from "./base";
import { IBMiObject, CommandResult } from '@halcyontech/vscode-ibmi-types';
import { Components } from "../webviewToolkit";
import { getInstance } from "../ibmi";
import { generateDetailTable, getColumns, generateFastTable, FastTableColumn, getProtected, openSqlTemplate, checkTableFunctionExists, checkViewExists, executeSqlIfExists } from "../tools";
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import ObjectProvider from '../objectProvider';

/**
 * Namespace containing actions for FILE objects
 */
export namespace FileActions {
  /**
   * Register FILE commands with VS Code
   * @param context - Extension context for command registration
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.QueryFile", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            return queryFile({ library, name } as IBMiObject);
          }
        } else if (item) {
          return queryFile(item);
        }
      }),
    );
  };

  /**
   * Query file contents using SQL SELECT statement
   * Opens a new SQL editor with a SELECT statement for the file
   * @param item - The File object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const queryFile = async (item: IBMiObject | File): Promise<boolean> => {
    const library = item.library.toUpperCase();
    const name = item.name.toUpperCase();

    // Generate SQL statement to query file contents
    const sqlStatement = `-- Query file
    
      select * 
        from ${library}.${name}`;
    
    // Open the SQL template with the generated statement
    return await openSqlTemplate(sqlStatement);
  };
}

/**
 * Interface representing a dependent object (index, view, etc.) related to the file
 */
interface DepObj {
  /** SQL object type (INDEX, VIEW, etc.) */
  type: string
  /** Schema name where the object resides */
  schema: string
  /** Object name */
  name: string
  /** Object owner */
  owner: string
  /** Object text description */
  text: string
  /** Last alteration timestamp */
  altered: string
}

/**
 * Interface representing a file member with its statistics
 */
interface Member {
  /** Member name */
  member: string
  /** Last change timestamp */
  lastchg: string
  /** Number of rows in the member */
  rows: number
  /** Number of deleted rows */
  delrows: number
  /** Data size in bytes */
  size: number
  /** Member text description */
  text: string
}

/**
 * File object class
 * Handles display and management of IBM i FILE objects including tables, views, and indexes
 * Provides comprehensive information about file structure, statistics, members, and dependencies
 */
export default class File extends Base {
  
  /** Column definitions for file information display */
  columns: Map<string, string> = new Map();
  /** File/table/index information data */
  private file?: any;

  /** Column definitions for statistics display */
  columnsstats: Map<string, string> = new Map();
  /** File/index statistics data */
  private stats?: any;

  /** Column definitions for view information display */
  columnsview: Map<string, string> = new Map();
  /** View definition data */
  private view?: any;
  
  /** Array of dependent objects (indexes, views, etc.) */
  private depobjs: DepObj[] = [];
  /** Array of file members */
  private members: Member[] = [];
  /** SQL object type (TABLE, VIEW, INDEX) */
  private objtype: string = '';


  /**
   * Fetch file information, statistics, members, and dependencies
   * Determines the object type and fetches appropriate data
   */
  async fetch() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      const objTypeResult = await executeSqlIfExists(
        connection,
        `SELECT SQL_OBJECT_TYPE
          FROM TABLE (
                  QSYS2.OBJECT_STATISTICS('${this.library}', 'FILE', '${this.name}')
              )`,
        'QSYS2',
        'OBJECT_STATISTICS',
        'FUNCTION'
      );

      if (objTypeResult === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "QSYS2", "OBJECT_STATISTICS"));
        return;
      }
      
      if (objTypeResult && objTypeResult.length > 0) {
        this.objtype = String(objTypeResult[0].SQL_OBJECT_TYPE);
      } else {
        this.objtype = 'TABLE'
      }

      this.stats=false;

      if (this.objtype === 'TABLE' || this.objtype === 'VIEW') {
        await this.fetchInfoFile();
        if( this.objtype === 'VIEW') {
          await this.fetchInfoView();
        } else {
          await this.fetchStatsFile();
          await this.fetchMembers();
          await this.fetchDependency();
        }
      } else {
        await this.fetchInfoIndex();
        await this.fetchStatsIndex();
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch file/table/view metadata from QSYS2.SYSTABLES
   * Retrieves comprehensive information including creation date, owner, journaling status, etc.
   */
  async fetchInfoFile(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns =new Map<string, string>([
        ['TABLE_SCHEMA', vscode.l10n.t('SQL schema name')],
        ['TABLE_NAME', vscode.l10n.t('SQL table name')],
        ['SQL_OBJECT_TYPE', vscode.l10n.t('SQL object type')],
        ['COLUMN_COUNT', vscode.l10n.t('Column count')],
        ['IS_INSERTABLE_INTO', vscode.l10n.t('Is insertable into')],
        ['TABLE_TEXT', vscode.l10n.t('Text')],
        ['TABLE_OWNER', vscode.l10n.t('Owner')],
        ['TABLE_DEFINER', vscode.l10n.t('Created by user')],
        ['OBJCREATED', vscode.l10n.t('Creation date/time')],
        ['LAST_ALTERED_TIMESTAMP', vscode.l10n.t('Last altered date/time')],
        ['LAST_USED_TIMESTAMP', vscode.l10n.t('Last used date')],
        ['DAYS_USED_COUNT', vscode.l10n.t('Days used count')],
        ['OBJSIZE', vscode.l10n.t('Object size')],
        ['IASP_NAME', vscode.l10n.t('iASP')],
        ['JOURNALED', vscode.l10n.t('Currently journaled')],
        ['JOURNAL_NAME', vscode.l10n.t('Current or last journal')],
        ['ENABLED', vscode.l10n.t('Enabled')],
        ['MAINTENANCE', vscode.l10n.t('Maintained by')],
        ['REFRESH', vscode.l10n.t('Refresh type')],
        ['REFRESH_TIME', vscode.l10n.t('Last refresh date/time')],
        ['MQT_DEFINITION', vscode.l10n.t('MQT definition')],
        ['ISOLATION', vscode.l10n.t('Isolation level')]
      ]);

      this.file = await executeSqlIfExists(
        connection,
        `SELECT TABLE_SCHEMA,
            TABLE_NAME,
            X.SQL_OBJECT_TYPE,
            COLUMN_COUNT,
            TABLE_TEXT,
            TABLE_OWNER,
            TABLE_DEFINER,
            TO_CHAR(OBJCREATED, 'yyyy-mm-dd HH24:mi') AS OBJCREATED,
            TO_CHAR(LAST_ALTERED_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS LAST_ALTERED_TIMESTAMP,
            TO_CHAR(LAST_USED_TIMESTAMP, 'yyyy-mm-dd') AS LAST_USED_TIMESTAMP,
            X.DAYS_USED_COUNT,
            IS_INSERTABLE_INTO,
            X.OBJSIZE,
            X.IASP_NAME,
            X.JOURNALED,
            JOURNAL_LIBRARY CONCAT '/' CONCAT X.JOURNAL_NAME AS JOURNAL_NAME,
            ENABLED,
            MAINTENANCE,
            "REFRESH",
            TO_CHAR(REFRESH_TIME, 'yyyy-mm-dd HH24:mi') AS REFRESH_TIME,
            MQT_DEFINITION,
            "ISOLATION"
          FROM QSYS2.SYSTABLES,
              TABLE (
                  QSYS2.OBJECT_STATISTICS('${this.library}', 'FILE', '${this.name}')
              ) X
          WHERE SYSTEM_TABLE_SCHEMA = '${this.library}'
                AND SYSTEM_TABLE_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'SYSTABLES',
        'VIEW'
      );

      if (this.file === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSTABLES"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch view-specific information from QSYS2.SYSVIEWS
   * Retrieves view definition and update/delete capabilities
   */
  async fetchInfoView(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columnsview =new Map<string, string>([
        ['VIEW_DEFINITION', vscode.l10n.t('View definition')],
        ['IS_INSERTABLE_INTO', vscode.l10n.t('Is insertable into')],
        ['IS_UPDATABLE', vscode.l10n.t('Is updatable')],
        ['IS_DELETABLE', vscode.l10n.t('Is deletable')]
      ]);

      this.view = await executeSqlIfExists(
        connection,
        `SELECT VIEW_DEFINITION,
            IS_INSERTABLE_INTO,
            CASE
                WHEN IS_UPDATABLE = 'Y' THEN 'YES'
                ELSE 'NO'
            END IS_UPDATABLE,
            CASE
                WHEN IS_DELETABLE = 'Y' THEN 'YES'
                ELSE 'NO'
            END IS_DELETABLE
          FROM QSYS2.SYSVIEWS
          WHERE SYSTEM_VIEW_SCHEMA = '${this.library}'
                    AND SYSTEM_VIEW_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'SYSVIEWS',
        'VIEW'
      );

      if (this.view === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSVIEWS"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch file statistics from QSYS2.SYSTABLESTAT
   * Retrieves detailed statistics including row counts, operations, and I/O metrics
   */
  async fetchStatsFile(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columnsstats = await getColumns(connection, 'SYSTABLESTAT');

      // Use executeSqlIfExists to check and execute in one call
      this.stats = await executeSqlIfExists(
        connection,
        `SELECT NUMBER_PARTITIONS,
          NUMBER_ROWS,
          NUMBER_DELETED_ROWS,
          DATA_SIZE,
          MAINTAINED_TEMPORARY_INDEX_SIZE,
          NUMBER_DISTINCT_INDEXES,
          OPEN_OPERATIONS,
          CLOSE_OPERATIONS,
          INSERT_OPERATIONS,
          BLOCKED_INSERT_OPERATIONS,
          BLOCKED_INSERT_ROWS,
          UPDATE_OPERATIONS,
          DELETE_OPERATIONS,
          CLEAR_OPERATIONS,
          COPY_OPERATIONS,
          REORGANIZE_OPERATIONS,
          INDEX_BUILDS,
          LOGICAL_READS,
          PHYSICAL_READS,
          SEQUENTIAL_READS,
          RANDOM_READS,
          TO_CHAR(LAST_CHANGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS LAST_CHANGE_TIMESTAMP,
          TO_CHAR(LAST_SAVE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS LAST_SAVE_TIMESTAMP,
          TO_CHAR(LAST_RESTORE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS LAST_RESTORE_TIMESTAMP
        FROM QSYS2.SYSTABLESTAT
          WHERE SYSTEM_TABLE_SCHEMA = '${this.library}'
                AND SYSTEM_TABLE_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'SYSTABLESTAT',
        'VIEW'
      );

      // If stats is null, the view doesn't exist or query failed
      if (this.stats === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSTABLESTAT"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch dependent objects using SYSTOOLS.RELATED_OBJECTS
   * Retrieves all objects that depend on or are related to this file
   */
  async fetchDependency(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.depobjs.length=0;
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT SQL_OBJECT_TYPE,
          SCHEMA_NAME,
          SQL_NAME,
          OBJECT_OWNER,
          OBJECT_TEXT,
          TO_CHAR(LAST_ALTERED, 'yyyy-mm-dd HH24:mi') AS LAST_ALTERED
        FROM TABLE (
          SYSTOOLS.RELATED_OBJECTS(LIBRARY_NAME => '${this.library}', FILE_NAME => '${this.name}')
          )`,
        'SYSTOOLS',
        'RELATED_OBJECTS',
        'FUNCTION'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "SYSTOOLS", "RELATED_OBJECTS"));
        return;
      }

      this.depobjs.push(...entryRows.map(this.toDepObj));
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch file members from QSYS2.SYSMEMBERSTAT
   * Retrieves member-level statistics including row counts and sizes
   */
  async fetchMembers(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.members.length=0;
      const entryRows = await executeSqlIfExists(
        connection,
        `SELECT SYSTEM_TABLE_MEMBER,
          TO_CHAR(LAST_CHANGE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS LAST_CHANGE_TIMESTAMP,
          NUMBER_ROWS,
          NUMBER_DELETED_ROWS,
          DATA_SIZE,
          TEXT_DESCRIPTION
        FROM QSYS2.SYSMEMBERSTAT
        WHERE TABLE_SCHEMA = '${this.library}'
              AND TABLE_NAME = '${this.name}'`,
        'QSYS2',
        'SYSMEMBERSTAT',
        'VIEW'
      );

      if (entryRows === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSMEMBERSTAT"));
        return;
      }

      this.members.push(...entryRows.map(this.toMember));
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch index metadata from QSYS2.SYSINDEXES
   * Retrieves comprehensive index information including creation date, owner, journaling status
   */
  async fetchInfoIndex(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns =new Map<string, string>([
        ['INDEX_SCHEMA', vscode.l10n.t('SQL schema name')],
        ['INDEX_NAME', vscode.l10n.t('SQL index name')],
        ['SQL_OBJECT_TYPE', vscode.l10n.t('SQL object type')],
        ['COLUMN_COUNT', vscode.l10n.t('Column count')],
        ['INDEX_TEXT', vscode.l10n.t('Text')],
        ['INDEX_OWNER', vscode.l10n.t('Owner')],
        ['INDEX_DEFINER', vscode.l10n.t('Created by user')],
        ['OBJCREATED', vscode.l10n.t('Creation date/time')],
        ['LAST_USED_TIMESTAMP', vscode.l10n.t('Last used date')],
        ['DAYS_USED_COUNT', vscode.l10n.t('Days used count')],
        ['OBJSIZE', vscode.l10n.t('Object size')],
        ['IASP_NAME', vscode.l10n.t('iASP')],
        ['JOURNALED', vscode.l10n.t('Currently journaled')],
        ['JOURNAL_NAME', vscode.l10n.t('Current or last journal')]
      ]);

      this.file = await executeSqlIfExists(
        connection,
        `SELECT INDEX_SCHEMA,
            INDEX_NAME,
            X.SQL_OBJECT_TYPE,
            COLUMN_COUNT,
            INDEX_TEXT,
            INDEX_OWNER,
            INDEX_DEFINER,
            TO_CHAR(OBJCREATED, 'yyyy-mm-dd HH24:mi') AS OBJCREATED,
            TO_CHAR(LAST_USED_TIMESTAMP, 'yyyy-mm-dd') AS LAST_USED_TIMESTAMP,
            X.DAYS_USED_COUNT,
            X.OBJSIZE,
            X.IASP_NAME,
            X.JOURNALED,
            JOURNAL_LIBRARY CONCAT '/' CONCAT X.JOURNAL_NAME AS JOURNAL_NAME
          FROM QSYS2.SYSINDEXES,
            TABLE (
                QSYS2.OBJECT_STATISTICS('${this.library}', 'FILE', '${this.name}')
            ) X
          WHERE SYSTEM_INDEX_SCHEMA = '${this.library}'
                AND SYSTEM_INDEX_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'SYSINDEXES',
        'VIEW'
      );

      if (this.file === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSINDEXES"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Fetch index statistics from QSYS2.SYSINDEXSTAT
   * Retrieves detailed index statistics including key counts, build times, and usage metrics
   */
  async fetchStatsIndex(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columnsstats = await getColumns(connection, 'SYSINDEXSTAT');
      
      this.stats = await executeSqlIfExists(
        connection,
        `SELECT INDEX_VALID,
            to_char(INDEX_CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS INDEX_CREATE_TIMESTAMP,
            to_char(LAST_BUILD_TIMESTAMP, 'yyyy-mm-dd HH24:mi') LAST_BUILD_TIMESTAMP,
            to_char(LAST_QUERY_USE, 'yyyy-mm-dd HH24:mi') LAST_QUERY_USE,
            to_char(LAST_STATISTICS_USE, 'yyyy-mm-dd HH24:mi') LAST_STATISTICS_USE,
            QUERY_USE_COUNT,
            QUERY_STATISTICS_COUNT,
            NUMBER_KEY_COLUMNS,
            COLUMN_NAMES,
            NUMBER_KEYS,
            INDEX_SIZE,
            "UNIQUE",
            "PARTITIONED",
            ACCPTH_TYPE,
            ESTIMATED_BUILD_TIME,
            LAST_BUILD_TIME,
            LAST_BUILD_KEYS,
            LAST_BUILD_DEGREE,
            to_char(LAST_INVALIDATION_TIMESTAMP, 'yyyy-mm-dd HH24:mi') LAST_INVALIDATION_TIMESTAMP,
            INDEX_HELD,
            MAINTENANCE,
            DELAYED_MAINT_KEYS,
            "RECOVERY",
            LOGICAL_READS,
            SEQUENTIAL_READS,
            RANDOM_READS,
            SEARCH_CONDITION,
            SEARCH_CONDITION_HAS_UDF,
            KEEP_IN_MEMORY,
            MEDIA_PREFERENCE,
            INCLUDE_EXPRESSION,
            trim(SYSTEM_TABLE_SCHEMA) concat '/' concat trim(SYSTEM_TABLE_NAME) concat ', ' concat trim(SYSTEM_TABLE_MEMBER) as SYSTEM_TABLE_MEMBER
          FROM QSYS2.SYSINDEXSTAT
          WHERE SYSTEM_INDEX_SCHEMA = '${this.library}'
                AND SYSTEM_INDEX_NAME = '${this.name}'
          Fetch first row only`,
        'QSYS2',
        'SYSINDEXSTAT',
        'VIEW'
      );

      if (this.stats === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "SYSINDEXSTAT"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the file view with multiple tabs
   * Creates tabs for Detail, View Info (if view), Statistics, Dependent Objects, and Members
   * @returns HTML string containing all panels with appropriate badges
   */
  generateHTML(): string {

    const panels: Components.Panel[] = [
      { title: vscode.l10n.t("Detail"), content: this.renderMainPanel() },
    ];

    if(this.objtype === 'VIEW') {
      panels.push({ title: vscode.l10n.t("View info"), content: this.renderViewPanel() })
    }

    if(this.stats) {
      panels.push({ title: vscode.l10n.t("Statistics"), content: this.renderStatsPanel() })
    }

    if(this.depobjs.length>0){
      panels.push({ title: vscode.l10n.t("Dependent objects"), content: this.renderDepObjs(), badge:this.depobjs.length });
    }

    if(this.members.length>0){
      panels.push({ title: vscode.l10n.t("Members"), content: this.renderMembers(), badge:this.members.length });
    }

    return Components.panels(panels);
  }

  /**
   * Render the main file information panel
   * Displays comprehensive file/table/view/index configuration and attributes
   * @returns HTML string for the detail table
   * @private
   */
  private renderMainPanel(): string {
    // Generate the detail table with file information
    return generateDetailTable({
      title: vscode.l10n.t("File: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t('File Information'),
      columns: this.columns,
      data: this.file,
      codeColumns:['MQT_DEFINITION'],
      hideNullValues: true
    });
  }

  /**
   * Render the view information panel
   * Displays view definition and capabilities (insertable, updatable, deletable)
   * @returns HTML string for the view detail table
   * @private
   */
  private renderViewPanel(): string {
    // Generate the detail table with view information
    return generateDetailTable({
      title: ``,
      subtitle: '',
      columns: this.columnsview,
      data: this.view,
      codeColumns:['VIEW_DEFINITION'],
      hideNullValues: true
    });
  }

  /**
   * Render the statistics panel
   * Displays file or index statistics including operations, I/O metrics, and timestamps
   * @returns HTML string for the statistics table
   * @private
   */
  private renderStatsPanel(): string {
    // Generate the detail table with statistics information
    return generateDetailTable({
      title: ``,
      subtitle: '',
      columns: this.columnsstats,
      data: this.stats,
      codeColumns:['COLUMN_NAMES'],
      hideNullValues: true
    });
  }
  /**
   * Convert a database row to a DepObj object
   * @param row - Database row from SYSTOOLS.RELATED_OBJECTS
   * @returns DepObj object representing a dependent object
   * @private
   */
  private toDepObj(row: Tools.DB2Row): DepObj {
    return {
      type: String(row.SQL_OBJECT_TYPE),
      schema: String(row.SCHEMA_NAME),
      name: String(row.SQL_NAME),
      owner: String(row.OBJECT_OWNER),
      text: String(row.OBJECT_TEXT),
      altered: String(row.LAST_ALTERED),
    };
  }

  /**
   * Convert a database row to a Member object
   * @param row - Database row from QSYS2.SYSMEMBERSTAT
   * @returns Member object representing a file member
   * @private
   */
  private toMember(row: Tools.DB2Row): Member {
    return {
      member: String(row.SYSTEM_TABLE_MEMBER),
      lastchg: String(row.LAST_CHANGE_TIMESTAMP),
      rows: Number(row.NUMBER_ROWS),
      delrows: Number(row.NUMBER_DELETED_ROWS),
      size: Number(row.DATA_SIZE),
      text: String(row.TEXT_DESCRIPTION)
    };
  }
  /**
   * Render the dependent objects table
   * Displays all objects that depend on or are related to this file
   * @returns HTML string for the fast table component
   * @private
   */
  renderDepObjs() {
    // Define table columns with their properties
    const columns: FastTableColumn<DepObj>[] = [
      { title: vscode.l10n.t("Schema"), width: "1fr", getValue: e => e.schema },
      { title: vscode.l10n.t("Name"), width: "1fr", getValue: e => e.name },
      { title: vscode.l10n.t("SQL type"), width: "0.7fr", getValue: e => e.type },
      { title: vscode.l10n.t("Owner"), width: "0.7fr", getValue: e => e.owner },
      { title: vscode.l10n.t("Text"), width: "2fr", getValue: e => e.text },
      { title: vscode.l10n.t("Last altered"), width: "0.7fr", getValue: e => e.altered }
    ];

    // Generate and return the complete table HTML
    return generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: this.depobjs,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t('No dependent objects found'),
    }) + ``;
  }

  /**
   * Render the file members table
   * Displays all members of the file with their statistics
   * @returns HTML string for the fast table component
   * @private
   */
  renderMembers() {
    // Define table columns with their properties
    const columns: FastTableColumn<Member>[] = [
      { title: vscode.l10n.t("Member"), width: "1fr", getValue: e => e.member  },
      { title: vscode.l10n.t("Rows"), width: "0.7fr", getValue: e => e.rows },
      { title: vscode.l10n.t("Deleted rows"), width: "0.7fr", getValue: e => e.delrows },
      { title: vscode.l10n.t("Size"), width: "0.7fr", getValue: e => e.size },
      { title: vscode.l10n.t("Last change"), width: "1fr", getValue: e => e.lastchg },
      { title: vscode.l10n.t("Text"), width: "1fr", getValue: e => e.text }
    ];

    // Generate and return the complete table HTML
    return generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: this.members,
      stickyHeader: true,
      emptyMessage: vscode.l10n.t('No members objects found'),
    }) + ``;
  }

  /**
   * Handle user actions from the webview
   * Currently no actions are implemented for file objects (read-only view)
   * @param data - Action data from the webview
   * @returns Empty action result
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    return { };
  }

  /**
   * Save changes (not applicable for file objects)
   * File objects are read-only in this view
   * All modifications are done through IBM i commands or SQL DDL
   */
  async save(): Promise<void> {
    // Files are read-only in this view
    // All modifications are done through IBM i commands (CHGPF, etc.) or SQL DDL
  }
}
