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
  /** Enable search bar (default: false) */
  enableSearch?: boolean;
  /** Search placeholder text (optional) */
  searchPlaceholder?: string;
  /** Enable pagination (default: false) */
  enablePagination?: boolean;
  /** Items per page (default: 50) */
  itemsPerPage?: number;
  /** Total items count (for server-side pagination) */
  totalItems?: number;
  /** Current page (for server-side pagination, default: 1) */
  currentPage?: number;
  /** Current search term (for server-side search) */
  searchTerm?: string;
  /** Table identifier for multi-table documents (e.g., SaveFile with objects/members/spools) */
  tableId?: string;
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
    // Translate using the column name as key (more stable than heading)
    // Falls back to heading if no translation exists for column name
    const translatedLabel = vscode.l10n.t(name, heading);
    columns.set(name, translatedLabel);
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

  // Format value with icons and styling
  const formatValue = (value: any, isCodeColumn: boolean): string => {
    if (value === null || value === undefined || value.toString().trim() === '') {
      return '<span style="color: var(--vscode-descriptionForeground); font-style: italic;">—</span>';
    }
    
    const strValue = String(value).trim();
    
    // Handle YES/NO values with icons
    if (strValue === 'YES') {
      return '<span style="color: var(--vscode-testing-iconPassed, #73c991); font-weight: 600;">✓ YES</span>';
    }
    if (strValue === 'NO') {
      return '<span style="color: var(--vscode-testing-iconFailed, #f48771); font-weight: 600;">✗ NO</span>';
    }
    
    // Handle numeric values with formatting
    if (!isNaN(Number(strValue)) && strValue !== '' && !isCodeColumn) {
      const num = Number(strValue);
      if (Number.isInteger(num)) {
        return `<span style="font-family: var(--vscode-editor-font-family); color: var(--vscode-charts-blue);">${num.toLocaleString()}</span>`;
      }
    }
    
    // Handle code columns
    if (isCodeColumn) {
      return `<code style="background: var(--vscode-textCodeBlock-background); padding: 4px 8px; border-radius: 4px; font-family: var(--vscode-editor-font-family); border: 1px solid var(--vscode-panel-border); display: inline-block; max-width: 100%; overflow-x: auto;">${escapeHtml(value)}</code>`;
    }
    
    return escapeHtml(value);
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
      
      const displayValue = formatValue(value, codeColumns.includes(key));
      
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
        align-items: stretch;
        padding: 0 20px;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
        box-sizing: border-box;
      }
      
      .detail-table-container vscode-table {
        width: 100%;
        min-width: 100%;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
        table-layout: fixed;
      }
      
      .detail-table-container vscode-table-row {
        display: grid !important;
        grid-template-columns: 30% 70% !important;
        width: 100% !important;
        min-height: 48px;
        align-items: center;
      }
      
      .detail-table-container vscode-table-row:nth-child(even) {
        background-color: var(--vscode-editor-background);
      }
      
      .detail-table-container vscode-table-row:hover {
        background-color: inherit !important;
        transform: none !important;
      }
      
      .detail-table-container vscode-table-cell:hover {
        background-color: inherit !important;
      }
      
      .detail-table-container vscode-table-cell:first-child {
        padding: 16px 20px;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
        white-space: normal;
        word-wrap: break-word;
        background-color: rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.05);
        border-right: 2px solid var(--vscode-panel-border);
        min-height: 48px;
        display: flex;
        align-items: center;
      }
      
      .detail-table-container vscode-table-cell:last-child {
        padding: 16px 20px;
        word-break: break-word;
        white-space: normal;
        word-wrap: break-word;
        font-family: var(--vscode-font-family);
        min-height: 48px;
        display: flex;
        align-items: center;
        min-width: 0;
        overflow-x: auto;
      }
      
      .detail-table-container code {
        font-family: var(--vscode-editor-font-family);
        font-size: 0.95em;
        background: var(--vscode-textCodeBlock-background);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid var(--vscode-panel-border);
        max-width: 100%;
        overflow-x: auto;
        white-space: pre;
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
    <div style="margin-top: 20px; margin-bottom: 24px; padding: 16px 20px; background: linear-gradient(135deg, var(--vscode-editor-background) 0%, rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.03) 100%); border-left: 4px solid var(--vscode-focusBorder); border-radius: 4px; width: 100%; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);">
      ${title ? `<h1 style="margin: 0 0 8px 0; font-size: 1.8em; font-weight: 600; color: var(--vscode-foreground);">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<div style="color: var(--vscode-descriptionForeground); font-size: 0.95em; margin-top: 4px;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ` : ''}
    
    <vscode-table columns='["35%", "65%"]'>
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
    customScript = '',
    enableSearch = false,
    searchPlaceholder = 'Search...',
    enablePagination = false,
    itemsPerPage = 50,
    totalItems = data.length,
    currentPage = 1,
    searchTerm = '',
    tableId = undefined
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

  // Format value with icons and styling for FastTable
  const formatFastValue = (value: string | number): string => {
    if (value === null || value === undefined || value === '') {
      return '<span style="color: var(--vscode-descriptionForeground); font-style: italic;">—</span>';
    }
    
    const strValue = String(value).trim();
    
    // Handle YES/NO values with icons
    if (strValue === 'YES') {
      return '<span style="color: var(--vscode-testing-iconPassed, #73c991); font-weight: 600;">✓ YES</span>';
    }
    if (strValue === 'NO') {
      return '<span style="color: var(--vscode-testing-iconFailed, #f48771); font-weight: 600;">✗ NO</span>';
    }
    
    // Handle numeric values with formatting
    if (!isNaN(Number(strValue)) && strValue !== '') {
      const num = Number(strValue);
      if (Number.isInteger(num) && num !== 0) {
        return `<span style="font-family: var(--vscode-editor-font-family); color: var(--vscode-charts-blue);">${num.toLocaleString()}</span>`;
      }
    }
    
    return escapeHtml(value);
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
  const rows = data.map((row, rowIndex) => {
    const cells = columns.map((col, index) => {
      const value = col.getValue(row);
      const cellClass = col.cellClass ? ` class="${col.cellClass}"` : '';
      return `<vscode-table-cell${cellClass}>${formatFastValue(value)}</vscode-table-cell>`;
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
      margin-top: 0;
      margin-bottom: 24px;
      padding: 16px 20px;
      background: linear-gradient(135deg, var(--vscode-editor-background) 0%, rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.03) 100%);
      border-left: 4px solid var(--vscode-focusBorder);
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
    
    .header h1 {
      margin: 0 0 8px 0;
      font-size: 1.8em;
      font-weight: 600;
      color: var(--vscode-foreground);
    }
    
    .header .info {
      color: var(--vscode-descriptionForeground);
      font-size: 0.95em;
      margin-top: 4px;
    }

    .search-bar {
      margin-bottom: 20px;
      padding: 16px;
      background: rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.03);
      border-radius: 6px;
      border: 1px solid rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.1);
    }

    .search-bar-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 600;
      font-size: 0.9em;
      color: var(--vscode-foreground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .search-bar vscode-text-field {
      width: 100%;
    }

    .pagination-controls {
      margin-top: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.03);
      border-radius: 4px;
    }

    .pagination-info {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }

    .pagination-buttons {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .page-input-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .page-input-container vscode-text-field {
      width: 80px;
    }
    
    vscode-table {
      width: 100%;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24);
    }
    
    vscode-table-header {
      background: linear-gradient(180deg, rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.08) 0%, rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.05) 100%);
      border-bottom: 2px solid var(--vscode-focusBorder);
    }
    
    vscode-table-header-cell {
      white-space: normal;
      word-wrap: break-word;
      padding: 14px 16px;
      font-weight: 700;
      font-size: 0.95em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-foreground);
    }
    
    vscode-table-row {
      transition: background-color 0.2s ease, transform 0.1s ease;
    }
    
    vscode-table-row:nth-child(even) {
      background-color: rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.02);
    }
    
    vscode-table-row:hover {
      background-color: var(--vscode-list-hoverBackground);
      transform: translateX(2px);
    }
    
    vscode-table-cell {
      white-space: normal;
      word-wrap: break-word;
      overflow-wrap: break-word;
      padding: 12px 16px;
      border-bottom: 1px solid rgba(var(--vscode-editor-foreground-rgb, 204, 204, 204), 0.08);
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

    .hidden {
      display: none !important;
    }
    
    ${customStyles}
  </style>
  <div class="container">
    ${title || subtitle ? `
    <div class="header">
      ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<div class="info" id="subtitle-info">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ` : ''}
    
    ${enableSearch ? `
    <div class="search-bar">
      <label class="search-bar-label" for="search-input">
        <span class="codicon codicon-search"></span> ${vscode.l10n.t('Search')}
      </label>
      <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 4px;">
        <span class="codicon codicon-search" style="color: var(--vscode-input-placeholderForeground);"></span>
        <input
          type="text"
          id="search-input"
          placeholder="${escapeHtml(searchPlaceholder)}"
          value="${searchTerm && searchTerm !== '-' ? escapeHtml(searchTerm) : ''}"
          style="flex: 1; background: transparent; border: none; outline: none; color: var(--vscode-input-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); padding: 4px 0;">
      </div>
    </div>
    ` : ''}
    
    ${data.length > 0 ? `
      <vscode-table
        id="data-table"
        bordered-rows
        columns='${JSON.stringify(columnsArray)}'
        aria-label="${escapeHtml(title)}">
        <vscode-table-header>
          ${headerCells}
        </vscode-table-header>
        <vscode-table-body id="table-body">
          ${rows}
        </vscode-table-body>
      </vscode-table>

      ${enablePagination ? `
      <div class="pagination-controls">
        <div class="pagination-info" id="pagination-info${tableId ? `-${tableId}` : ''}"></div>
        <div class="pagination-buttons">
          <vscode-button id="first-page${tableId ? `-${tableId}` : ''}" appearance="icon" aria-label="First page">
            <span class="codicon codicon-chevron-left"></span>
            <span class="codicon codicon-chevron-left"></span>
          </vscode-button>
          <vscode-button id="prev-page${tableId ? `-${tableId}` : ''}" appearance="icon" aria-label="Previous page">
            <span class="codicon codicon-chevron-left"></span>
          </vscode-button>
          <div class="page-input-container">
            <span>Page</span>
            <input
              type="number"
              id="page-input${tableId ? `-${tableId}` : ''}"
              min="1"
              style="width: 60px; padding: 4px 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); border-radius: 3px; color: var(--vscode-input-foreground); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); text-align: center;">
            <span id="total-pages-label${tableId ? `-${tableId}` : ''}"></span>
          </div>
          <vscode-button id="next-page${tableId ? `-${tableId}` : ''}" appearance="icon" aria-label="Next page">
            <span class="codicon codicon-chevron-right"></span>
          </vscode-button>
          <vscode-button id="last-page${tableId ? `-${tableId}` : ''}" appearance="icon" aria-label="Last page">
            <span class="codicon codicon-chevron-right"></span>
            <span class="codicon codicon-chevron-right"></span>
          </vscode-button>
        </div>
      </div>
      ` : ''}
    ` : `
      <div class="empty-state">
        <p>${escapeHtml(emptyMessage)}</p>
      </div>
    `}
  </div>
  
  <script defer>
    ${tableId ? `(function() {` : ''}
    // Use the global vscode API acquired by webviewToolkit
    // Note: This script runs after the footer script from webviewToolkit.ts
    
    // State management${tableId ? ` for table: ${tableId}` : ''}
    let currentPage = ${currentPage};
    let currentSearchTerm = '${escapeHtml(searchTerm)}';
    const itemsPerPage = ${itemsPerPage};
    const totalItems = ${totalItems};
    const enableSearch = ${enableSearch};
    const enablePagination = ${enablePagination};

    // Get DOM elements
    const searchInput = document.getElementById('search-input${tableId ? `-${tableId}` : ''}');
    const paginationInfo = document.getElementById('pagination-info${tableId ? `-${tableId}` : ''}');
    const pageInput = document.getElementById('page-input${tableId ? `-${tableId}` : ''}');
    const totalPagesLabel = document.getElementById('total-pages-label${tableId ? `-${tableId}` : ''}');
    const firstPageBtn = document.getElementById('first-page${tableId ? `-${tableId}` : ''}');
    const prevPageBtn = document.getElementById('prev-page${tableId ? `-${tableId}` : ''}');
    const nextPageBtn = document.getElementById('next-page${tableId ? `-${tableId}` : ''}');
    const lastPageBtn = document.getElementById('last-page${tableId ? `-${tableId}` : ''}');

    // Calculate total pages
    const totalPages = enablePagination ? Math.ceil(totalItems / itemsPerPage) : 1;

    // Search functionality - sends message to extension
    let searchTimeout;
    function performSearch(searchTerm) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentSearchTerm = searchTerm;
        currentPage = 1;
        // Set flag to indicate this is a search/pagination operation (preserve tab)
        // IMPORTANT: Save BOTH the flag AND the current tab index BEFORE sending message
        const state = vscode.getState() || {};
        state.isSearchRestore = true;
        
        // Save the current active tab index
        const tabs = document.querySelector('vscode-tabs');
        if (tabs) {
          const currentTabIndex = tabs.getAttribute('selected-index');
          if (currentTabIndex !== null) {
            state.activeTabIndex = parseInt(currentTabIndex);
          }
        }
        
        vscode.setState(state);
        const message = {
          command: 'search',
          searchTerm: searchTerm,
          page: 1,
          itemsPerPage: itemsPerPage
        };
        ${tableId ? `message.tableId = '${tableId}';` : ''}
        vscode.postMessage(message);
      }, 500); // Debounce 500ms
    }

    // Pagination functionality - sends message to extension
    function changePage(newPage) {
      if (newPage < 1 || newPage > totalPages) return;
      currentPage = newPage;
      // Set flag to indicate this is a search/pagination operation (preserve tab)
      // IMPORTANT: Save BOTH the flag AND the current tab index BEFORE sending message
      const state = vscode.getState() || {};
      state.isSearchRestore = true;
      
      // Save the current active tab index
      const tabs = document.querySelector('vscode-tabs');
      if (tabs) {
        const currentTabIndex = tabs.getAttribute('selected-index');
        if (currentTabIndex !== null) {
          state.activeTabIndex = parseInt(currentTabIndex);
        }
      }
      
      vscode.setState(state);
      const message = {
        command: 'paginate',
        searchTerm: currentSearchTerm,
        page: newPage,
        itemsPerPage: itemsPerPage
      };
      ${tableId ? `message.tableId = '${tableId}';` : ''}
      vscode.postMessage(message);
    }

    // Update pagination display
    function updatePaginationDisplay() {
      if (enablePagination && paginationInfo) {
        const displayStart = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const displayEnd = Math.min(currentPage * itemsPerPage, totalItems);
        paginationInfo.textContent = \`Showing \${displayStart}-\${displayEnd} of \${totalItems} items\`;
        
        if (pageInput) {
          pageInput.value = currentPage;
          pageInput.max = totalPages;
        }
        
        if (totalPagesLabel) {
          totalPagesLabel.textContent = \`of \${totalPages}\`;
        }

        // Update button states
        if (firstPageBtn) firstPageBtn.disabled = currentPage === 1;
        if (prevPageBtn) prevPageBtn.disabled = currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
        if (lastPageBtn) lastPageBtn.disabled = currentPage === totalPages || totalPages === 0;
      }
    }

    // Event listeners
    if (enableSearch && searchInput) {
      searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value);
      });
    }

    if (enablePagination) {
      if (firstPageBtn) {
        firstPageBtn.addEventListener('click', () => {
          changePage(1);
        });
      }

      if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
          changePage(currentPage - 1);
        });
      }

      if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
          changePage(currentPage + 1);
        });
      }

      if (lastPageBtn) {
        lastPageBtn.addEventListener('click', () => {
          changePage(totalPages);
        });
      }

      if (pageInput) {
        pageInput.addEventListener('change', (e) => {
          const newPage = parseInt(e.target.value);
          if (newPage >= 1 && newPage <= totalPages) {
            changePage(newPage);
          } else {
            e.target.value = currentPage;
          }
        });
      }
    }

    // Initial display update
    updatePaginationDisplay();

    // Custom script
    ${customScript}
    ${tableId ? `})();` : ''}
  </script>
  </div>
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
 * Check if a table exists in the system
 * @param ibmi - IBM i connection instance
 * @param schema - Schema/library name
 * @param tableName - Table name to check
 * @returns Promise<boolean> - True if table exists, false otherwise
 */
export async function checkTableExists(ibmi: IBMi, schema: string, tableName: string): Promise<boolean> {
  return checkSqlObjectExists(ibmi, schema, tableName, 'TABLE');
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
      return null;
    }
    
    // Object exists, execute the SQL
    const result = await ibmi.runSQL(sqlStatement);
    return result;
    
  } catch (error) {
    return null;
  }
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