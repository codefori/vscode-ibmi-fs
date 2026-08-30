import IBMi from '@halcyontech/vscode-ibmi-types/api/IBMi';
import { ObjectFilters } from '@halcyontech/vscode-ibmi-types';
import * as vscode from 'vscode';

/** Regular expression for validating IBM i object names */
export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

/**
 * Generate a random string of 10 alphabetic characters
 * @returns A random 10-character string (only letters, no numbers)
 */
export function generateRandomString(len: number): string {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';

  for (let i = 0; i < len; i++) {
    const randomIndex = Math.floor(Math.random() * letters.length);
    result += letters[randomIndex];
  }

  return result;
}

/**
 * Generate a QSYS file system path for an IBM i object
 * @param library - Library name
 * @param name - Object name
 * @param type - Object type
 * @param member - Optional member name
 * @param iasp - Optional independent ASP name
 * @returns The formatted QSYS path
 */
export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
  return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}

/**
 * Check if a library is protected based on configured object filters
 * When multiple filters match the library, selects the most specific rule
 * (filters with more restrictive types or name patterns take precedence over '*ALL')
 * @param connection - IBM i connection instance
 * @param lib - Library name to check
 * @returns true if the library is protected, false otherwise
 */
export function getProtected(connection: IBMi, lib: string): boolean {

  let isProtected = true;
  let rule: ObjectFilters;

  connection.getConfig().objectFilters.forEach(element => {
    if (element.library == lib || (element.library.endsWith('*') && lib.startsWith(element.library.substring(0, element.library.length - 1)))) {
      if (rule) {
        if ((element.types[0] !== '*ALL' && rule.types[0] === '*ALL') || (element.object !== '*' && rule.object === '*')) {
          rule = element;
          isProtected = element.protected;
        }
      } else {
        rule = element;
        isProtected = element.protected;
      }
    }
  });

  return isProtected;
}

/**
 * Retrieve column information from a system table
 * Reference: https://www.ibm.com/docs/en/i/7.4?topic=views-syscolumns2
 * @param ibmi - IBM i connection instance
 * @param table - Table name
 * @param schema - Schema name (default: QSYS2)
 * @returns Map of column names to their headings
 */
export async function getColumns(ibmi: IBMi, table: String, schema = 'QSYS2') {
  let columns: Map<string, string> = new Map();
  const columnDetail = await ibmi.runSQL(`Select COLUMN_NAME, "COLUMN_HEADING", CCSID, LENGTH From QSYS2.SYSCOLUMNS2 Where TABLE_NAME = '${table}' AND TABLE_SCHEMA = '${schema}'`);

  columnDetail.forEach((column) => {
    const name = column.COLUMN_NAME!.toString();
    const heading = parseHeading(column.COLUMN_HEADING!.toString());
    const length = Number(column.LENGTH);
    // Translate using the column name as key (more stable than heading).
    // l10n.t() returns the key untranslated when the bundle has no entry, so use the heading instead.
    const translatedLabel = vscode.l10n.t(name);
    columns.set(name, translatedLabel === name ? (heading || name) : translatedLabel);
  });

  return columns;
}

/**
 * Parse and format column heading by splitting into 20-character parts
 * @param rawHeading - Raw heading string from database
 * @returns Formatted heading string
 */
function parseHeading(rawHeading: string): string {
  const partSize = 20;
  const parts = Math.ceil(rawHeading.length / partSize);
  let heading = "";
  for (let part = 0; part < parts; part++) {
    heading += rawHeading.substring(partSize * part, partSize * (part + 1)).trim() + " ";
  }
  return heading.trimEnd();
}

/**
 * Cast column to VARCHAR if needed for SQL queries
 * @param columnName - Column name
 * @param length - Column length
 * @param hasFullSQL - Whether full SQL support is available
 * @returns SQL cast expression or original column name
 */
function castIfNeeded(columnName: string, length: number, hasFullSQL?: boolean): string {
  return hasFullSQL ? columnName : `Cast(${columnName} As VarChar(${length}) CCSID 37) As ${columnName}`;
}

/**
 * Check if a SQL object (view, table function, procedure, etc.) exists in the system
 * Uses QSYS2.SYSTABLES for views and tables, QSYS2.SYSPROCS for procedures
 * @param ibmi - IBM i connection instance
 * @param schema - Schema/library name
 * @param objectName - Object name to check
 * @param objectType - Type of object: 'VIEW', 'TABLE', 'FUNCTION', 'PROCEDURE', 'ALIAS'
 * @returns Promise<boolean> - True if object exists, false otherwise
 */
export async function checkSqlObjectExists(
  ibmi: IBMi,
  schema: string,
  objectName: string,
  objectType: 'VIEW' | 'TABLE' | 'FUNCTION' | 'PROCEDURE' | 'ALIAS'
): Promise<boolean> {
  try {
    let query: string;

    switch (objectType) {
      case 'VIEW':
        // Check in SYSVIEWS for views
        query = `
          SELECT COUNT(*) as OBJECT_COUNT
          FROM QSYS2.SYSVIEWS
          WHERE TABLE_SCHEMA = '${schema.toUpperCase()}'
            AND TABLE_NAME = '${objectName.toUpperCase()}'
        `;
        break
      case 'TABLE':
      case 'ALIAS':
        // Check in SYSTABLES tables and aliases
        query = `
          SELECT COUNT(*) as OBJECT_COUNT
          FROM QSYS2.SYSTABLES
          WHERE TABLE_SCHEMA = '${schema.toUpperCase()}'
            AND TABLE_NAME = '${objectName.toUpperCase()}'
            AND TABLE_TYPE = '${objectType}'
        `;
        break;

      case 'FUNCTION':
        // Check in SYSFUNCS for functions (including table functions)
        query = `
          SELECT COUNT(*) as OBJECT_COUNT
          FROM QSYS2.SYSFUNCS
          WHERE ROUTINE_SCHEMA = '${schema.toUpperCase()}'
            AND ROUTINE_NAME = '${objectName.toUpperCase()}'
        `;
        break;

      case 'PROCEDURE':
        // Check in SYSPROCS for procedures
        query = `
          SELECT COUNT(*) as OBJECT_COUNT
          FROM QSYS2.SYSPROCS
          WHERE ROUTINE_SCHEMA = '${schema.toUpperCase()}'
            AND ROUTINE_NAME = '${objectName.toUpperCase()}'
        `;
        break;

      default:
        throw new Error(`Unsupported object type: ${objectType}`);
    }

    const result = await ibmi.runSQL(query);

    if (result && result.length > 0) {
      const count = Number(result[0].OBJECT_COUNT);
      return count > 0;
    }

    return false;
  } catch (error) {
    console.error(`Error checking SQL object existence: ${error}`);
    return false;
  }
}

/**
 * Check if a view exists in the system
 * @param ibmi - IBM i connection instance
 * @param schema - Schema/library name
 * @param viewName - View name to check
 * @returns Promise<boolean> - True if view exists, false otherwise
 */
export async function checkViewExists(ibmi: IBMi, schema: string, viewName: string): Promise<boolean> {
  return checkSqlObjectExists(ibmi, schema, viewName, 'VIEW');
}

/**
 * Check if a table function exists in the system
 * @param ibmi - IBM i connection instance
 * @param schema - Schema/library name
 * @param functionName - Function name to check
 * @returns Promise<boolean> - True if function exists, false otherwise
 */
export async function checkTableFunctionExists(ibmi: IBMi, schema: string, functionName: string): Promise<boolean> {
  return checkSqlObjectExists(ibmi, schema, functionName, 'FUNCTION');
}

/**
 * Check if a procedure exists in the system
 * @param ibmi - IBM i connection instance
 * @param schema - Schema/library name
 * @param procedureName - Procedure name to check
 * @returns Promise<boolean> - True if procedure exists, false otherwise
 */
export async function checkProcedureExists(ibmi: IBMi, schema: string, procedureName: string): Promise<boolean> {
  return checkSqlObjectExists(ibmi, schema, procedureName, 'PROCEDURE');
}

/**
 * Execute SQL statement with automatic object existence check
 * Verifies that the specified SQL object exists before executing the query
 * Returns null if the object doesn't exist or if execution fails
 *
 * @param ibmi - IBM i connection instance
 * @param sqlStatement - SQL statement to execute
 * @param schema - Schema/library name of the object to check
 * @param objectName - Name of the object to check
 * @param objectType - Type of object: 'VIEW', 'TABLE', 'FUNCTION', 'PROCEDURE', 'ALIAS'
 * @returns Promise<any[] | null> - Query results or null if object doesn't exist or error occurs
 *
 * @example
 * ```typescript
 * const result = await executeSqlIfExists(ibmi, 'SELECT * FROM MYLIB.MYVIEW', 'MYLIB', 'MYVIEW', 'VIEW');
 * if (result === null) {
 *   console.log('View does not exist or query failed');
 * } else {
 *   console.log('Query successful:', result);
 * }
 * ```
 */
export async function executeSqlIfExists(
  ibmi: IBMi,
  sqlStatement: string,
  schema: string,
  objectName: string,
  objectType: 'VIEW' | 'TABLE' | 'FUNCTION' | 'PROCEDURE' | 'ALIAS'
): Promise<any[] | null> {
  try {
    // Check if the object exists
    const exists = await checkSqlObjectExists(ibmi, schema, objectName, objectType);

    if (!exists) {
      console.log(`checkObjectExists failed for ${schema}, ${objectName},${objectType}`);
      return null;
    }

    // Object exists, execute the SQL
    const result = await ibmi.runSQL(sqlStatement);
    return result;

  } catch (error) {
    console.log(`checkObjectExists SQL statement failed ${sqlStatement}`);
    return null;
  }
}

/**
 * Ask the user which user profile a view should be filtered on.
 *
 * Accepts a user profile name or the special value `*CURRENT` (the profile of the current
 * connection); see {@link resolveUserFilter} for turning the answer into a value a QSYS2
 * service can be given.
 *
 * @param title - Title shown on the input box
 * @param defaultValue - Pre-filled value, `*CURRENT` unless stated otherwise
 * @returns The uppercased user filter, or undefined when the user dismissed the prompt
 */
export async function promptForUserFilter(title: string, defaultValue: string = '*CURRENT'): Promise<string | undefined> {
  const user = await vscode.window.showInputBox({
    title,
    prompt: vscode.l10n.t("User profile name, *CURRENT for the connected user"),
    placeHolder: "*CURRENT",
    value: defaultValue,
    validateInput: (value) => {
      const candidate = (value || '').trim().toUpperCase();
      if (candidate.length === 0) {
        return vscode.l10n.t("User is required");
      }
      if (candidate === '*CURRENT') {
        return null;
      }
      if (!IBMI_OBJECT_NAME.test(candidate)) {
        return vscode.l10n.t("Enter a valid user profile name, *CURRENT");
      }
      return null;
    }
  });

  return user ? user.trim().toUpperCase() : undefined;
}

/**
 * Turn a user filter coming from {@link promptForUserFilter} into the value to pass to a QSYS2
 * service. `*CURRENT` is resolved here rather than handed over as-is because not every service
 * accepts it as a special value, while every one of them accepts a plain user profile name.
 * @param connection - IBM i connection instance
 * @param userFilter - `*CURRENT` or a user profile name
 * @returns The user profile name to filter on
 */
export function resolveUserFilter(connection: IBMi, userFilter: string): string {
  const filter = userFilter.trim().toUpperCase();
  return filter === '*CURRENT' ? connection.currentUser.toUpperCase() : filter;
}

/**
 * Validate and execute SQL with object existence check
 * This function checks if the required SQL objects exist before executing the query
 * @param ibmi - IBM i connection instance
 * @param sqlStatement - SQL statement to execute
 * @param requiredObjects - Array of objects to check before execution
 * @returns Promise with execution result or error
 */
export async function executeSqlWithValidation(
  ibmi: IBMi,
  sqlStatement: string,
  requiredObjects: Array<{
    schema: string;
    name: string;
    type: 'VIEW' | 'TABLE' | 'FUNCTION' | 'PROCEDURE' | 'ALIAS';
  }>
): Promise<{ success: boolean; data?: any[]; error?: string; missingObjects?: string[] }> {
  try {
    // Check all required objects
    const missingObjects: string[] = [];

    for (const obj of requiredObjects) {
      const exists = await checkSqlObjectExists(ibmi, obj.schema, obj.name, obj.type);
      if (!exists) {
        missingObjects.push(`${obj.schema}.${obj.name} (${obj.type})`);
      }
    }

    // If any objects are missing, return error
    if (missingObjects.length > 0) {
      return {
        success: false,
        error: `Missing SQL objects: ${missingObjects.join(', ')}`,
        missingObjects
      };
    }

    // All objects exist, execute the SQL
    const result = await ibmi.runSQL(sqlStatement);
    return {
      success: true,
      data: result
    };

  } catch (error) {
    return {
      success: false,
      error: `SQL execution error: ${error}`
    };
  }
}