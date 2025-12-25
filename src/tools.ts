import IBMi from '@halcyontech/vscode-ibmi-types/api/IBMi';
import { getInstance } from "./ibmi";
import { Components } from "./webviewToolkit";

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
  let html = `<vscode-data-grid>`;

  columns.forEach((label, key) => {
    if (key in obj[0]) {
      let value = obj[0][key as keyof typeof obj];
      if (!value)
        value = "-"
      html = html.trim() + `<vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1"><b>${label}</b></vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${infoValue(value)}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
    }
  });

  html = html.trim() + `</vscode-data-grid>`;

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

  let html = `<vscode-data-grid>`;

  columns.forEach((label, key) => {
    if (key in obj[0]) {
      let value = obj[0][key as keyof typeof obj];
      if (!value)
        value = "-"
      html = html.trim() + `<vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1"><b>${label}</b></vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${lblarray.includes(key) ? '<code>' + value + '</code>' : value}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
    }
  });

  html = html.trim() + `</vscode-data-grid>`;

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
    actions = []
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
      // Non sostituire 0 con "-", gestisci solo null/undefined/stringa vuota
      if (value === null || value === undefined || value === '') value = "-";
      
      const displayValue = codeColumns.includes(key)
        ? `<code style="background: var(--vscode-textCodeBlock-background); padding: 2px 6px; border-radius: 3px; font-family: var(--vscode-editor-font-family);">${escapeHtml(value)}</code>`
        : escapeHtml(value);
      
      rows.push(`
      <vscode-data-grid-row>
        <vscode-data-grid-cell grid-column="1" style="font-weight: 600; color: var(--vscode-descriptionForeground);">${escapeHtml(label)}</vscode-data-grid-cell>
        <vscode-data-grid-cell grid-column="2">${displayValue}</vscode-data-grid-cell>
      </vscode-data-grid-row>`);
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
        display: block;
        position: relative;
        height: auto;
        overflow: visible;
      }
      
      .detail-table-container vscode-data-grid {
        border: 1px solid var(--vscode-panel-border);
        border-radius: 4px;
        display: grid !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }
      
      .detail-table-container vscode-data-grid-row {
        border-bottom: 1px solid var(--vscode-panel-border);
      }
      
      .detail-table-container vscode-data-grid-row:last-child {
        border-bottom: none;
      }
      
      .detail-table-container vscode-data-grid-row:hover {
        background-color: var(--vscode-list-hoverBackground);
      }
      
      .detail-table-container vscode-data-grid-cell[grid-column="1"] {
        padding: 12px 16px;
        font-weight: 600;
        color: var(--vscode-descriptionForeground);
      }
      
      .detail-table-container vscode-data-grid-cell[grid-column="2"] {
        padding: 12px 16px;
        word-break: break-word;
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
    <div style="margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid var(--vscode-panel-border);">
      ${title ? `<h1 style="margin: 0 0 8px 0; font-size: 1.8em; font-weight: 600;">${escapeHtml(title)}</h1>` : ''}
      ${subtitle ? `<div style="color: var(--vscode-descriptionForeground); font-size: 0.95em;">${escapeHtml(subtitle)}</div>` : ''}
    </div>
    ` : ''}
    
    <vscode-data-grid grid-template-columns="30% 70%">
      ${rows.join('')}
    </vscode-data-grid>
    
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

  // Generate grid-template-columns CSS
  const gridTemplateColumns = columns.map(col => col.width || 'auto').join(' ');

  // Generate table rows
  const rows = data.map(row => {
    const cells = columns.map((col, index) => {
      const value = col.getValue(row);
      const cellClass = col.cellClass ? ` class="${col.cellClass}"` : '';
      const gridCol = col.gridColumn || (index + 1);
      return `<vscode-data-grid-cell grid-column="${gridCol}"${cellClass}>${escapeHtml(value)}</vscode-data-grid-cell>`;
    }).join('\n        ');
    
    return `<vscode-data-grid-row>
        ${cells}
      </vscode-data-grid-row>`;
  }).join('\n      ');

  // Generate table header
  const headerCells = columns.map((col, index) => {
    const gridCol = col.gridColumn || (index + 1);
    return `<vscode-data-grid-cell cell-type="columnheader" grid-column="${gridCol}">${escapeHtml(col.title)}</vscode-data-grid-cell>`;
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
    
    vscode-data-grid {
      width: 100%;
      height: calc(100vh - 120px);
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
      <vscode-data-grid
        ${stickyHeader ? 'generate-header="sticky"' : ''}
        grid-template-columns="${gridTemplateColumns}"
        aria-label="${escapeHtml(title)}">
        <vscode-data-grid-row row-type="header">
          ${headerCells}
        </vscode-data-grid-row>
        ${rows}
      </vscode-data-grid>
    ` : `
      <div class="empty-state">
        <p>${escapeHtml(emptyMessage)}</p>
      </div>
    `}
  </div>
  
  <script type="module">
    import {
      provideVSCodeDesignSystem,
      vsCodeDataGrid,
      vsCodeDataGridRow,
      vsCodeDataGridCell
    } from '@vscode/webview-ui-toolkit';
    
    // Register FAST Element components
    provideVSCodeDesignSystem().register(
      vsCodeDataGrid(),
      vsCodeDataGridRow(),
      vsCodeDataGridCell()
    );
    
    ${customScript}
  </script>
</body>
</html>
`;
}