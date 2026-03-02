/**
 * Webview Toolkit utilities for generating HTML pages with VS Code webview components
 * Uses the @vscode-elements/elements for consistent UI components
 */

const webToolKit = require("@vscode-elements/elements/dist/bundled.js");

/** HTML head section with styles and webview toolkit script */
const head = /*html*/`
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${webToolKit}</script>
  <style>
    vscode-tab-panel {
      flex-direction: column;
    }
    .center-screen {
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      min-height: 100vh;
    }

    .keyValueGrid {
      display: table;
    }

    .keyValueGrid p {
      display: table-row;
    }

    .cellKey {
      font-weight: bold;
      display: table-cell;
      padding-bottom: 5px;
      width: 1%;
      white-space: nowrap;
    }

    .cellValue {
      display: table-cell;
      padding-left: 10px;
      background-color: transparent;
    }
  </style>`;

/** HTML footer section with JavaScript for handling user interactions */
const footer = /*html*/`
  <script defer>
    /**
     * Get all input bindings from elements with readonly="false"
     * @returns Object with input IDs and their current values
     */
    function getBindings() {
      let bindings = {};

      for (const input of document.querySelectorAll('[readonly="false"]')) {
        const id = input.getAttribute('id');
        if (id) {
          bindings[id] = input.getAttribute('current-value');
        }
      }

      return bindings;
    }

    const vscode = acquireVsCodeApi();

    // Handle click events on action links
    for (const link of document.querySelectorAll('[href^="action:"]')) {
      link.addEventListener('click', () => {
        let data = {};
        link.getAttributeNames().forEach(attr => {
          data[attr] = link.getAttribute(attr);
        });

        data.bindings = getBindings();

        vscode.postMessage(data);
      });
    }

    // Handle change events on input elements
    for (const link of document.querySelectorAll('[change^="action:"]')) {
      const data = {
        id: link.id,
        value: ''
      }
      
      console.log(link)
      console.log(link.dataset.action)
      
      if(link.dataset.action === "checkbox"){
        link.addEventListener('click', (event) => {
          data.value = !event.target.currentChecked;
          vscode.postMessage(data);
        });
      }
      else{
        link.addEventListener('input', (event) => {
          data.value = event.target.currentValue;
          vscode.postMessage(data);
        });
      }
    }

    // Save and restore active tab using vscode state (persists across webview reloads)
    (function() {
      const tabs = document.querySelector('vscode-tabs');
      if (tabs) {
        // Get the current state from vscode
        const state = vscode.getState() || {};
        
        // Check if this is a search/pagination restore (flag set by search/pagination events)
        const isSearchRestore = state.isSearchRestore === true;
        
        if (isSearchRestore) {
          // Restore previously active tab only if coming from search/pagination
          const savedIndex = state.activeTabIndex;
          if (savedIndex !== undefined && savedIndex !== null) {
            const index = parseInt(savedIndex);
            if (!isNaN(index) && index >= 0) {
              // Set the selected index immediately (the attribute is available before rendering)
              tabs.setAttribute('selected-index', index.toString());
              
              // Also set it after a delay as a fallback to ensure it's applied
              setTimeout(() => {
                tabs.setAttribute('selected-index', index.toString());
              }, 100);
            }
          }
          // DON'T clear the flag here - it will be cleared after scroll is done
        } else {
          // New document opened, clear saved tab to start from first tab
          state.activeTabIndex = undefined;
          vscode.setState(state);
        }
        
        // Save active tab when it changes (for future search/pagination)
        tabs.addEventListener('vsc-select', (event) => {
          const selectedIndex = event.detail.selectedIndex;
          if (selectedIndex !== undefined && selectedIndex !== null) {
            const currentState = vscode.getState() || {};
            currentState.activeTabIndex = selectedIndex;
            vscode.setState(currentState);
          }
        });
      }
    })();

    // Scroll to top after pagination or search
    (function() {
      const state = vscode.getState() || {};
      const isSearchRestore = state.isSearchRestore === true;
      
      if (isSearchRestore) {
        // Wait for tabs to be fully rendered before scrolling
        // This ensures the tab restoration happens first
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 200);
        
        // Clear the flag after all operations are complete
        setTimeout(() => {
          const currentState = vscode.getState() || {};
          currentState.isSearchRestore = false;
          vscode.setState(currentState);
        }, 250);
      }
    })();

    window.addEventListener("message", (event) => {
      // Handle messages from extension
    });
  </script>
`;

/**
 * Generate a complete HTML page with the webview toolkit
 * @param body - HTML body content
 * @returns Complete HTML page string
 */
export function generatePage(body: string) {
  return /*html*/ `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      ${head}
    </head>
    <body>
      ${body}
    </body>
    ${footer}
  </html>
`;
}

/**
 * Generate an error page
 * @param text - Error message to display
 * @returns Complete HTML error page string
 */
export function generateError(text: string) {
  return /*html*/ `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      ${head}
    </head>
    <body>
      <div class="center-screen">
        <p>${text}</p>
      </div>
    </body>
  </html>
`;
}

/**
 * Components namespace for generating VS Code webview UI toolkit components
 * Reference: https://github.com/vscode-elements/elements
 */
export namespace Components {
  /** Base component interface with common properties */
  interface Component {
    class?: string
    style?: string
  }

  /** Text field component interface */
  interface TextField extends Component {
    autofocus: boolean
    disabled: boolean
    maxlength: number
    placeholder: string
    readonly: boolean
    size: number
    type: 'Text' | 'Email' | 'Password' | 'Tel' | 'Text' | 'Url'
    value: string
  }

  /** Text area component interface */
  interface TextArea extends Component {
    autofocus: boolean
    cols: number
    disabled: boolean
    form: string
    maxlength: number
    placeholder: string
    readonly: boolean
    resize: 'None' | 'Both' | 'Horizontal' | 'Vertical'
    rows: number
    value: string
  }

  /** Checkbox component interface */
  interface Checkbox extends Component {
    autofocus: boolean
    checked: boolean
    disabled: boolean
    readonly: boolean
    required: boolean
    value: string
  }

  /** Button component interface */
  interface Button extends Component {
    appearance: "primary" | "secondary" | "icon"
    ariaLabel: string
    gautofocus: boolean
    disabled: boolean
    form: string
    formaction: string
    formenctype: string
    formmethod: string
    formnovalidate: string
    formtarget: string
    type: string
    value: string
    icon: ButtonIcon,
    action: string
  }

  /** Button icon interface */
  interface ButtonIcon extends Component {
    name: string
    left?: boolean
  }

  /** Divider component interface */
  interface Divider extends Component {
    role: 'presentation' | 'separator'
  }

  /** Data grid component interface */
  interface DataGrid<T> extends Component {
    stickyHeader?: boolean
    generateHeader?: "default" | "sticky" | "none"
    headerClass?: string
    columns: Column<T>[]
    rowClass?: (row: T) => string
  }

  /** Column definition for data grids */
  export interface Column<T> {
    cellValue: (row: T) => string
    title?: string
    size?: string
    cellClass?: (row: T) => string
  }

  /** Dropdown component interface */
  interface DropDown extends Component {
    disabled: boolean
    open: boolean
    position: 'above' | 'below'
    items: string[]
    indicator: string
  }

  /** Panel interface for tabbed views */
  export interface Panel extends Component {
    title: string
    badge?: number
    content: string
  }

  /**
   * Generate a tabbed panel view
   * @param panels - Array of panel definitions
   * @param attributes - Optional component attributes
   * @param activeid - Optional active tab ID
   * @returns HTML string for the panels
   */
  export function panels(panels: Panel[], attributes?: Component, activeid?: number): string {
    return /*html*/ `<vscode-tabs ${renderAttributes(attributes)} ${activeid ? `selected-index="${activeid - 1}"` : ""}>
      ${panels.map((panel, index) => /*html*/ `<vscode-tab-header slot="header">${panel.title.toUpperCase()}${panel.badge ? ' ' + badge(panel.badge, true) : ''}</vscode-tab-header>`).join("")}
      ${panels.map((panel, index) => /*html*/ `<vscode-tab-panel ${panel.class ? `class="${panel.class}"` : ''}>${panel.content}</vscode-tab-panel>`).join("")}
    </vscode-tabs>`;
  }

  /**
   * Generate a table component (replaces data grid)
   * @param grid - Grid configuration
   * @param content - Array of data to display
   * @returns HTML string for the table
   */
  export function dataGrid<T>(grid: DataGrid<T>, content: T[]): string {
    const columnsArray = grid.columns.map(col => col.size || 'auto');
    return /*html*/ `<vscode-table ${renderAttributes(grid, "columns", "stickyHeader", "rowClass", "headerClass")} bordered columns='${JSON.stringify(columnsArray)}'>
        ${renderHeader(grid)}
        <vscode-table-body>
          ${content.map(row => renderRow(grid, row)).join("")}
        </vscode-table-body>
      </vscode-table>`;
  }

  /**
   * Render the header row for a table
   * @param grid - Grid configuration
   * @returns HTML string for the header row
   */
  function renderHeader<T>(grid: DataGrid<T>) {
    if (grid.columns.filter(col => col.title).length) {
      return /*html*/ `<vscode-table-header class="${grid.headerClass || ''}">
        ${grid.columns.map((col, index) => /*html*/ `<vscode-table-header-cell>${col.title || ""}</vscode-table-header-cell>`).join("")}
      </vscode-table-header>`;
    }
    else {
      return "";
    }
  }

  /**
   * Render a data row for a table
   * @param grid - Grid configuration
   * @param row - Data row to render
   * @returns HTML string for the data row
   */
  function renderRow<T>(grid: DataGrid<T>, row: T) {
    return /*html*/ `<vscode-table-row class="${grid.rowClass?.(row) || ''}">
        ${grid.columns.map((col, index) => /*html*/ `<vscode-table-cell class="${col.cellClass?.(row) || ''}">${col.cellValue(row)}</vscode-table-cell>`).join("")}
      </vscode-table-row>`;
  }

  /**
   * Generate a divider component
   * @param options - Optional divider options
   * @returns HTML string for the divider
   */
  export function divider(options?: Partial<Divider>) {
    return /* html */`<vscode-divider ${renderAttributes(options)}></vscode-divider>`;
  }

  /**
   * Generate a dropdown component
   * @param id - Element ID
   * @param dropDown - Dropdown configuration
   * @param noChangeListener - Whether to skip change listener
   * @returns HTML string for the dropdown
   */
  export function dropDown(id: string, dropDown: Partial<DropDown>, noChangeListener?: boolean) {
    return /*html*/ `<vscode-dropdown id="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(dropDown, "indicator")}>
      ${dropDown.indicator ? /*html*/ _icon(dropDown.indicator, "indicator") : ''}
      ${dropDown.items?.map(item => /*html*/ `<vscode-option>${item}</vscode-option>`).join("")}
    </vscode-dropdown>`;
  }

  /**
   * Generate a text field component
   * @param id - Element ID
   * @param label - Optional label text
   * @param options - Optional text field options
   * @param noChangeListener - Whether to skip change listener
   * @returns HTML string for the text field
   */
  export function textField(id: string, label?: string, options?: Partial<TextField>, noChangeListener?: boolean) {
    return /* html */`<vscode-text-field id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-text-field>`;
  }

  /**
   * Generate a text area component
   * @param id - Element ID
   * @param label - Optional label text
   * @param options - Optional text area options
   * @param noChangeListener - Whether to skip change listener
   * @returns HTML string for the text area
   */
  export function textArea(id: string, label?: string, options?: Partial<TextArea>, noChangeListener?: boolean) {
    return /* html */`<vscode-text-area id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-text-area>`;
  }

  /**
   * Generate a checkbox component
   * @param id - Element ID
   * @param label - Optional label text
   * @param options - Optional checkbox options
   * @param noChangeListener - Whether to skip change listener
   * @returns HTML string for the checkbox
   */
  export function checkbox(id: string, label?: string, options?: Partial<Checkbox>, noChangeListener?: boolean) {
    return /* html */`<vscode-checkbox id="${id}" value="${id}" ${renderChangeListener("checkbox", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-checkbox>`;
  }

  /**
   * Generate a button component
   * @param label - Optional button label
   * @param options - Optional button options
   * @returns HTML string for the button
   */
  export function button(label?: string, options?: Partial<Button>) {
    return /* html */`<vscode-button ${renderAttributes(options, "icon", "action")} ${options?.action ? `href="action:${options.action}"` : ""}>
      ${label || ''}
      ${options?.icon ? /* html */ _icon(options.icon.name, options.icon.left ? "start" : "") : ''}
      </vscode-button>`;
  }

  /**
   * Generate a badge component
   * @param count - Badge count
   * @param secondary - Whether to use secondary appearance
   * @returns HTML string for the badge
   */
  export function badge(count: number, secondary?: boolean) {
    return /* html */`<vscode-badge ${secondary ? 'appearance="secondary"' : ''}>${count}</vscode-badge>`;
  }

  /**
   * Generate a key-value table
   * @param getKey - Function to extract key from entry
   * @param getValue - Function to extract value from entry
   * @param entries - Array of entries
   * @returns HTML string for the key-value table
   */
  export function keyValueTable<T>(getKey: (e: T) => string, getValue: (e: T) => string, entries: T[]) {
    return /* html */ `<div class="keyValueGrid">
      ${entries.map(entry => {
      return /* html */ `<p><span class="cellKey">${getKey(entry)}:</span><code class="cellValue">${getValue(entry)}</code></p>`;
    }).join(``)}
    </div>`;
  }

  /**
   * Generate an icon element
   * @param icon - Icon name (codicon)
   * @param slot - Optional slot attribute
   * @returns HTML string for the icon
   */
  function _icon(icon: string, slot?: string) {
    return /* html */`<span class="codicon codicon-${icon}" ${slot ? `slot="${slot}"` : ''}></span>`;
  }

  /**
   * Render HTML attributes from an options object
   * @param options - Options object
   * @param skipped - Array of property names to skip
   * @returns HTML attributes string
   */
  function renderAttributes(options?: Object, ...skipped: string[]) {
    if (options) {
      return `${Object.entries(options).filter(e => skipped.indexOf(e[0]) === -1)
        .map(e => renderAttribute(e[0], e[1]))
        .join(" ")}`.trim();
    }
    else {
      return '';
    }
  }

  /**
   * Render change listener attributes
   * @param type - Listener type (input or checkbox)
   * @param noRender - Whether to skip rendering
   * @returns HTML attributes string
   */
  function renderChangeListener(type: 'input' | 'checkbox', noRender?: boolean) {
    if (!noRender) {
      return `change='action:change' data-action='${type}'`;
    }
    else {
      return '';
    }
  }

  /**
   * Render a single HTML attribute
   * @param name - Attribute name
   * @param value - Attribute value
   * @returns HTML attribute string
   */
  function renderAttribute(name: string, value: any) {
    const attribute = kebabize(name);
    switch (typeof value) {
      case "boolean": return value ? attribute : '';
      default: return `${attribute}="${String(value)}"`;
    }
  }

  /**
   * Convert camelCase to kebab-case
   * @param name - String in camelCase
   * @returns String in kebab-case
   */
  function kebabize(name: string) {
    return name.split('').map((letter) => letter.toUpperCase() === letter ? `-${letter.toLowerCase()}` : letter).join('');
  }
}