const webToolKit = require("@vscode/webview-ui-toolkit/dist/toolkit.min.js");

const head = /*html*/`
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${webToolKit}</script>
  <style>
    vscode-panel-view {
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

const footer = /*html*/`
  <script defer>
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

    window.addEventListener("message", (event) => {
    });
  </script>
`;

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

//https://github.com/microsoft/vscode-webview-ui-toolkit/blob/main/docs/components.md
export namespace Components {
  interface Component {
    class?: string
    style?: string
  }

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

  interface Checkbox extends Component {
    autofocus: boolean
    checked: boolean
    disabled: boolean
    readonly: boolean
    required: boolean
    value: string
  }

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

  interface ButtonIcon extends Component {
    name: string
    left?: boolean
  }

  interface Divider extends Component {
    role: 'presentation' | 'separator'
  }

  interface DataGrid<T> extends Component {
    stickyHeader?: boolean
    generateHeader?: "default" | "sticky" | "none"
    headerClass?: string
    columns: Column<T>[]
    rowClass?: (row: T) => string
  }

  export interface Column<T> {
    cellValue: (row: T) => string
    title?: string
    size?: string
    cellClass?: (row: T) => string
  }

  interface DropDown extends Component {
    disabled: boolean
    open: boolean
    position: 'above' | 'below'
    items: string[]
    indicator: string
  }

  export interface Panel extends Component {
    title: string
    badge?: number
    content: string
  }

  export function panels(panels: Panel[], attributes?: Component, activeid?: number): string {
    return /*html*/ `<vscode-panels ${renderAttributes(attributes)} ${activeid ? `activeid="tab-${activeid}"` : ""}>
      ${panels.map((panel, index) => /*html*/ `<vscode-panel-tab id="tab-${index + 1}">${panel.title.toUpperCase()}${panel.badge ? badge(panel.badge, true) : ''}</vscode-panel-tab>`).join("")}
      ${panels.map((panel, index) => /*html*/ `<vscode-panel-view id="view-${index + 1}" ${panel.class ? `class="${panel.class}"` : ''}>${panel.content}</vscode-panel-view>`).join("")}
    </vscode-panels>`;
  }

  export function dataGrid<T>(grid: DataGrid<T>, content: T[]): string {
    return /*html*/ `<vscode-data-grid ${renderAttributes(grid, "columns", "stickyHeader", "rowClass", "headerClass")} ${gridTemplateColumns(grid)}>
        ${renderHeader(grid)}
        ${content.map(row => renderRow(grid, row)).join("")}    
      </vscode-data-grid>`;
  }

  function gridTemplateColumns<T>(grid: DataGrid<T>) {
    const attemptToSize = grid.columns.some(col => col.size);
    if (attemptToSize) {
      return `grid-template-columns="${grid.columns.map(col => col.size ? col.size : "auto").join(" ")}"`;
    } else {
      return ``;
    }
  }

  function renderHeader<T>(grid: DataGrid<T>) {
    if (grid.columns.filter(col => col.title).length) {
      return /*html*/ `<vscode-data-grid-row row-type="${grid.stickyHeader ? "sticky-header" : "header"}" class="${grid.headerClass}"}>
        ${grid.columns.map((col, index) => /*html*/ `<vscode-data-grid-cell cell-type="columnheader" grid-column="${index + 1}">${col.title || ""}</vscode-data-grid-cell>`).join("")}
      </vscode-data-grid-row>`;
    }
    else {
      return "";
    }
  }

  function renderRow<T>(grid: DataGrid<T>, row: T) {
    return /*html*/ `<vscode-data-grid-row class="${grid.rowClass?.(row)}"}>
        ${grid.columns.map((col, index) => /*html*/ `<vscode-data-grid-cell grid-column="${index + 1}" class="${col.cellClass?.(row) || ''}">${col.cellValue(row)}</vscode-data-grid-cell>`).join("")}        
      </vscode-data-grid-row>`;
  }

  export function divider(options?: Partial<Divider>) {
    return /* html */`<vscode-divider ${renderAttributes(options)}></vscode-divider>`;
  }

  export function dropDown(id: string, dropDown: Partial<DropDown>, noChangeListener?: boolean) {
    return /*html*/ `<vscode-dropdown id="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(dropDown, "indicator")}>
      ${dropDown.indicator ? /*html*/ _icon(dropDown.indicator, "indicator") : ''}
      ${dropDown.items?.map(item => /*html*/ `<vscode-option>${item}</vscode-option>`).join("")}
    </vscode-dropdown>`;
  }

  export function textField(id: string, label?: string, options?: Partial<TextField>, noChangeListener?: boolean) {
    return /* html */`<vscode-text-field id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-text-field>`;
  }

  export function textArea(id: string, label?: string, options?: Partial<TextArea>, noChangeListener?: boolean) {
    return /* html */`<vscode-text-area id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-text-area>`;
  }

  export function checkbox(id: string, label?: string, options?: Partial<Checkbox>, noChangeListener?: boolean) {
    return /* html */`<vscode-checkbox id="${id}" value="${id}" ${renderChangeListener("checkbox", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-checkbox>`;
  }

  export function button(label?: string, options?: Partial<Button>) {
    return /* html */`<vscode-button ${renderAttributes(options, "icon", "action")} ${options?.action ? `href="action:${options.action}"` : ""}>
      ${label || ''}
      ${options?.icon ? /* html */ _icon(options.icon.name, options.icon.left ? "start" : "") : ''}
      </vscode-button>`;
  }

  export function badge(count: number, secondary?: boolean) {
    return /* html */`<vscode-badge ${secondary ? 'appearance="secondary"' : ''}>${count}</vscode-badge>`;
  }

  export function keyValueTable<T>(getKey: (e: T) => string, getValue: (e: T) => string, entries: T[]) {
    return /* html */ `<div class="keyValueGrid">
      ${entries.map(entry => {
      return /* html */ `<p><span class="cellKey">${getKey(entry)}:</span><code class="cellValue">${getValue(entry)}</code></p>`;
    }).join(``)}
    </div>`;
  }


  function _icon(icon: string, slot?: string) {
    return /* html */`<span class="codicon codicon-${icon}" ${slot ? `slot="${slot}"` : ''}></span>`;
  }

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

  function renderChangeListener(type: 'input' | 'checkbox', noRender?: boolean) {
    if (!noRender) {
      return `change='action:change' data-action='${type}'`;
    }
    else {
      return '';
    }
  }

  function renderAttribute(name: string, value: any) {
    const attribute = kebabize(name);
    switch (typeof value) {
      case "boolean": return value ? attribute : '';
      default: return `${attribute}="${String(value)}"`;
    }
  }

  function kebabize(name: string) {
    return name.split('').map((letter) => letter.toUpperCase() === letter ? `-${letter.toLowerCase()}` : letter).join('');
  }
}