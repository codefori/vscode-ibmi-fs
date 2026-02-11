import IBMi from '@halcyontech/vscode-ibmi-types/api/IBMi';
import { getInstance } from "./ibmi";
import { Components } from "./webviewToolkit";
import { ObjectFilters } from '@halcyontech/vscode-ibmi-types';
import * as vscode from 'vscode';

/**
 * Column definition for FastTable
 */
export interface FastTableColumn<T> {
  /** Column title in header */
  title: string;
  /** Function to extract value from row */
  getValue: (row: T) => string | number;
  /** Column number (optional, auto-assigned if omitted) */
  gridColumn?: number;
  /** Column width - supports: "100px", "20%", "1fr", "2fr", "auto", "minmax(100px, 1fr)" */
  width?: string;
  /** Custom CSS class for cells (optional) */
  cellClass?: string;
}

/**
 * Options for generating a FastTable
 */
export interface FastTableOptions<T> {
  /** Page title */
  title: string;
  /** Subtitle or additional info (optional) */
  subtitle?: string;
  /** Table columns */
  columns: FastTableColumn<T>[];
  /** Data to display */
  data: T[];
  /** Sticky header (default: true) */
  stickyHeader?: boolean;
  /** Message when no data (optional) */
  emptyMessage?: string;
  /** Additional custom CSS (optional) */
  customStyles?: string;
  /** Custom JavaScript (optional) */
  customScript?: string;
}

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
export function getProtected(connection: IBMi, lib: string) : boolean {

  let isProtected=false;
  let rule : ObjectFilters;

  connection.getConfig().objectFilters.forEach(element => {
    if(element.library==lib){
      if(rule){
        if((element.types[0]!=='*ALL'&&rule.types[0]==='*ALL')||(element.object!=='*'&&rule.object==='*')){
          rule=element;
          isProtected=element.protected;
        }
      } else {
        rule=element;
        isProtected=element.protected;
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
    columns.set(name, heading);
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
 * Generate HTML table from columns and data object
 * @param columns - Map of column names to labels
 * @param obj - Data object array
 * @returns HTML string for the table
 */
export function generateTableHtml(columns: Map<string, string>, obj: any): string {
  let html = `<vscode-table bordered>`;

  columns.forEach((label, key) => {
    if (key in obj[0]) {
      let value = obj[0][key as keyof typeof obj];
      if (!value)
        value = "-"
      html = html.trim() + `<vscode-table-row>
        <vscode-table-cell><b>${label}</b></vscode-table-cell>
        <vscode-table-cell>${infoValue(value)}</vscode-table-cell>
        </vscode-table-row>`;
    }
  });

  html = html.trim() + `</vscode-table>`;

  return html;
}

/**
 * Generate HTML table with code formatting for specified columns
 * @param columns - Map of column names to labels
 * @param obj - Data object array
 * @param inJson - JSON string array of column names to format as code
 * @returns HTML string for the table
 */
export function generateTableHtmlCode(columns: Map<string, string>, obj: any, inJson: string): string {
  let lblarray: string[] = JSON.parse(inJson)

  let html = `<vscode-table bordered>`;

  columns.forEach((label, key) => {
    if (key in obj[0]) {
      let value = obj[0][key as keyof typeof obj];
      if (!value)
        value = "-"
      html = html.trim() + `<vscode-table-row>
        <vscode-table-cell><b>${label}</b></vscode-table-cell>
        <vscode-table-cell>${lblarray.includes(key) ? '<code>' + value + '</code>' : value}</vscode-table-cell>
        </vscode-table-row>`;
    }
  });

  html = html.trim() + `</vscode-table>`;

  return html;
}

/**
 * Options for generating a detail table (key-value pairs)
 */
export interface DetailTableOptions {
  /** Page title */
  title?: string;
  /** Subtitle or additional info (optional) */
  subtitle?: string;
  /** Column definitions (keys and labels) */
  columns: Map<string, string>;
  /** Data object to display */
  data: any;
  /** Array of column names to format as code (optional) */
  codeColumns?: string[];
  /** Additional custom CSS (optional) */
  customStyles?: string;
  /** Custom JavaScript (optional) */
  customScript?: string;
  /** Show action buttons (optional) */
  actions?: DetailTableAction[];
  /** Hide fields with null values (optional, default: false) */
  hideNullValues?: boolean;
}

/**
 * Action button configuration for detail tables
 */
export interface DetailTableAction {
  /** Button label */
  label: string;
  /** Action identifier */
  action: string;
  /** Button appearance (primary, secondary, etc.) */
  appearance?: string;
  /** Custom CSS style */
  style?: string;
}

/**
 * Generate an enhanced detail table (key-value pairs) using Fast components
 * This is a modern replacement for generateTableHtml and generateTableHtmlCode
 * @param options - Detail table configuration options
 * @returns Complete HTML page string
 */
export function generateDetailTable(options: DetailTableOptions): string {
  const {
    title = '',
    subtitle = '',
    columns,
    data,
    codeColumns = [],
    customStyles = '',
    customScript = '',
    actions = [],
    hideNullValues = false
  } = options;

  // Escape HTML for security
  const escapeHtml = (text: string | number): string => {
    if (text === 0) return '0';
    if (text === null || text === undefined || text === '') return '-';
    const str = String(text);
    if (str === 'null' || str === 'undefined' || str.trim() === '') return '-';
    const map: {[key: string]: string} = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  };

  // Generate table rows
  const rows: string[] = [];
  columns.forEach((label, key) => {
    if (key in data[0]) {
      let value = data[0][key as keyof typeof data];
      
      // Skip null/undefined/empty values if hideNullValues is enabled
      if (hideNullValues && (value === null || value === undefined || value.toString().trim() === '')) {
        return;
      }
      
      // Non sostituire 0 con "-", gestisci solo null/undefined/stringa vuota
      if (value === null || value === undefined || value.toString().trim() === '') value = "-";
      
      const displayValue = codeColumns.includes(key)
        ? `<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; font-family: var(--vscode-editor-font-family);">${escapeHtml(value)}</code>`
        : escapeHtml(value);
      
      rows.push(`
      <vscode-table-row>
        <vscode-table-cell style="font-weight: 600; color: var(--vscode-descriptionForeground);">${escapeHtml(label)}</vscode-table-cell>
        <vscode-table-cell>${displayValue}</vscode-table-cell>
      </vscode-table-row>`);
    }
  });

  // Generate action buttons using Components.button for proper event handling
  const actionButtons = actions.map((action, index) => {
    const marginTop = index === 0 ? '0' : '10px';
    return Components.button(action.label, {
      action: action.action,
      appearance: action.appearance as any || 'primary',
      style: `width: 100%; text-align: center; display: block; margin-top: ${marginTop};`
    });
  }).join('\n');

  return /*html*/`
  <div class="detail-table-container">
    <style>
      .detail-table-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0 20px;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
      }
      
      .detail-table-container vscode-table {
        width: 100%;
      }
      
      .detail-table-container vscode-table-cell:first-child {
        padding: 12px 16px;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
        white-space: normal;
        word-wrap: break-word;
      }
      
      .detail-table-container vscode-table-cell:last-child {
        padding: 12px 16px;
        word-break: break-word;
        white-space: normal;
        word-wrap: break-word;
      }
      
      .detail-table-container code {
        font-family: var(--vscode-editor-font-family);
        font-size: 0.95em;
      }
      
      .detail-table-actions {
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid var(--vscode-panel-border);
        clear: both;
      }
      
      ${customStyles}
    </style>
    
    ${title || subtitle ? `
    <div style="margin-top: 20px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--vscode-panel-border); width: 100%;">
      ${title ? `<h1 style="margin: 0 0 8px 0; font-size: 1.8em; font-weight: 600;">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<div style="color: var(--vscode-descriptionForeground); font-size: 0.95em;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ` : ''}
    
    <vscode-table columns='["30%", "70%"]'>
      ${rows.join('')}
    </vscode-table>
    
    ${actions.length > 0 ? `
    <div class="detail-table-actions">
      ${actionButtons}
    </div>
    ` : ''}
  </div>
`;
}

/**
 * Format a value for display in the UI
 * @param value - Value to format (string, number, or boolean)
 * @returns Formatted value as string or HTML component
 */
export function infoValue(value: string | number | boolean) {
  if (typeof value === "boolean") {
    return value ? "✔" : "✖"; // Note: Can't display codicons in this context
  }
  else if (typeof value === "number") {
    return Components.badge(value);
  }
  else {
    return value;
  }
}

/**
 * Generate a complete HTML page with FAST Element table
 * Optimized for displaying large datasets with better performance
 * @param options - Table configuration options
 * @returns Complete HTML page string
 */
export function generateFastTable<T>(options: FastTableOptions<T>): string {
  const {
    title,
    subtitle,
    columns,
    data,
    stickyHeader = true,
    emptyMessage = 'No data available.',
    customStyles = '',
    customScript = ''
  } = options;

  // Escape HTML for security and handle null/undefined
  const escapeHtml = (text: string | number): string => {
    // Gestisci esplicitamente lo zero come valore valido
    if (text === 0) return '0';
    if (text === null || text === undefined || text === '') return '-';
    const str = String(text);
    // Check for string representations of null/undefined
    if (str === 'null' || str === 'undefined' || str.trim() === '') return '-';
    const map: {[key: string]: string} = {
      '&': '&',
      '<': '<',
      '>': '>',
      '"': '"',
      "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, m => map[m]);
  };

  // Calculate total fr units
  const totalFr = columns.reduce((sum, col) => {
    if (col.width && col.width.includes('fr')) {
      const frValue = parseFloat(col.width.replace('fr', ''));
      return sum + frValue;
    }
    return sum;
  }, 0);
  
  // Generate columns array for vscode-table, converting fr to percentages
  const columnsArray = columns.map(col => {
    if (!col.width) return 'auto';
    
    if (col.width.includes('fr') && totalFr > 0) {
      const frValue = parseFloat(col.width.replace('fr', ''));
      const percentage = (frValue / totalFr) * 100;
      return `${percentage.toFixed(2)}%`;
    }
    
    return col.width;
  });

  // Generate table rows
  const rows = data.map(row => {
    const cells = columns.map((col, index) => {
      const value = col.getValue(row);
      const cellClass = col.cellClass ? ` class="${col.cellClass}"` : '';
      return `<vscode-table-cell${cellClass}>${escapeHtml(value)}</vscode-table-cell>`;
    }).join('\n        ');
    
    return `<vscode-table-row>
        ${cells}
      </vscode-table-row>`;
  }).join('\n      ');

  // Generate table header
  const headerCells = columns.map((col, index) => {
    return `<vscode-table-header-cell>${escapeHtml(col.title)}</vscode-table-header-cell>`;
  }).join('\n        ');

  return /*html*/`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    body {
      padding: 0;
      margin: 0;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    
    .container {
      padding: 20px;
    }
    
    .header {
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 1.5em;
      font-weight: 600;
    }
    
    .header .info {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    
    vscode-table {
      width: 100%;
    }
    
    vscode-table-cell {
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    
    vscode-table-header-cell {
      white-space: normal;
      word-wrap: break-word;
    }
    
    /* Add spacing between buttons in action columns */
    vscode-table-cell vscode-button {
      margin-right: 8px;
    }
    
    vscode-table-cell vscode-button:last-child {
      margin-right: 0;
    }
    
    .empty-state {
      text-align: center;
      padding: 40px;
      color: var(--vscode-descriptionForeground);
    }
    
    ${customStyles}
  </style>
</head>
<body>
  <div class="container">
    ${title || subtitle ? `
    <div class="header">
      ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<div class="info">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ` : ''}
    
    ${data.length > 0 ? `
      <vscode-table
        bordered-rows
        columns='${JSON.stringify(columnsArray)}'
        aria-label="${escapeHtml(title)}">
        <vscode-table-header>
          ${headerCells}
        </vscode-table-header>
        <vscode-table-body>
          ${rows}
        </vscode-table-body>
      </vscode-table>
    ` : `
      <div class="empty-state">
        <p>${escapeHtml(emptyMessage)}</p>
      </div>
    `}
  </div>
  
  <script type="module">
    // Components are automatically registered by @vscode-elements/elements bundle
    ${customScript}
  </script>
</body>
</html>
`;
}

/**
 * Open a new untitled SQL document with pre-written SQL statement
 * This is a utility function that can be called from any component
 * @param sqlStatement - The SQL statement to pre-populate in the new document
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export async function openSqlTemplate(sqlStatement: string): Promise<boolean> {
  try {
    // Create a new untitled document with SQL language
    const document = await vscode.workspace.openTextDocument({
      language: 'sql',
      content: sqlStatement
    });
    
    // Show the document in a new editor
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open SQL template: ${error}`);
    return false;
  }
}

/**
 * Open a new untitled document with pre-written content
 * Similar to openSqlTemplate but for any language/content
 * @param content - The content to pre-populate in the new document
 * @param language - The language ID for syntax highlighting (default: 'plaintext')
 * @returns Promise<boolean> - True if successful, false otherwise
 */
export async function openTextTemplate(content: string, language: string = 'plaintext'): Promise<boolean> {
  try {
    // Create a new untitled document with specified language
    const document = await vscode.workspace.openTextDocument({
      language: language,
      content: content
    });
    
    // Show the document in a new editor
    await vscode.window.showTextDocument(document, {
      preview: false,
      viewColumn: vscode.ViewColumn.Active
    });

    return true;
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open text template: ${error}`);
    return false;
  }
}