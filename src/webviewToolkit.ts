const webToolKit = require("@vscode-elements/elements/dist/bundled");

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

// https://vscode-elements.github.io/components/
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
    secondary: boolean;
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
    icon: string,
    iconAfter: string;
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

  export function panels(panels: Panel[], attributes?: Component, activeTab?: number): string {
    return /*html*/ `<vscode-tabs ${renderAttributes(attributes)} ${activeTab ? `selected-index="${activeTab}"` : ""}>

      ${panels.map((panel, index) => /*html*/ `
        <vscode-tab-header slot="header">
          ${panel.title.toUpperCase()}${panel.badge ? badge(panel.badge, true) : ''}
        </vscode-tab-header>
        <vscode-tab-panel>
          ${panel.content}
        </vscode-tab-panel>
      `).join("")}
    </vscode-tabs>`;
  }

  export function dataGrid<T>(grid: DataGrid<T>, content: T[]): string {
    return /*html*/ `<vscode-table ${renderAttributes(grid, "columns", "stickyHeader", "rowClass", "headerClass")}>
        ${renderHeader(grid)}

        <vscode-table-body slot="body">
          ${content.map(row => renderRow(grid, row)).join("")}
        </vscode-table-body>
      </vscode-table>`;
  }

  function renderHeader<T>(grid: DataGrid<T>) {
    if (grid.columns.filter(col => col.title).length) {
      // TODO: support sticky-header. We need custom css for sticky header
      return /*html*/ `<vscode-table-header row-type="${grid.stickyHeader ? "header" : "header"}" class="${grid.headerClass}"}>
        ${grid.columns.map((col) => /*html*/ `<vscode-table-header-cell>${col.title || ""}</vscode-table-header-cell>`).join("")}
      </vscode-table-header>`;
    }
    else {
      return "";
    }
  }

  function renderRow<T>(grid: DataGrid<T>, row: T) {
    return /*html*/ `<vscode-table-row class="${grid.rowClass?.(row)}">
        ${grid.columns.map((col) => /*html*/ `<vscode-table-cell class="${col.cellClass?.(row) || ''}">${col.cellValue(row)}</vscode-table-cell>`).join("")}        
      </vscode-table-row>`;
  }

  export function divider(options?: Partial<Divider>) {
    return /* html */`<vscode-divider ${renderAttributes(options)}></vscode-divider>`;
  }

  export function dropDown(id: string, dropDown: Partial<DropDown>, noChangeListener?: boolean) {
    return /*html*/ `<vscode-single-select id="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(dropDown, "indicator")}>
      ${dropDown.indicator ? /*html*/ _icon(dropDown.indicator, "indicator") : ''}
      ${dropDown.items?.map(item => /*html*/ `<option value="${item}">${item}</option>`).join("")}
    </vscode-single-select>`;
  }

  export function textField(id: string, label?: string, options?: Partial<TextField>, noChangeListener?: boolean) {
    return /* html */`<vscode-textfield id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-textfield>`;
  }

  export function textArea(id: string, label?: string, options?: Partial<TextArea>, noChangeListener?: boolean) {
    return /* html */`<vscode-textarea id="${id}" name="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-textarea>`;
  }

  export function checkbox(id: string, label?: string, options?: Partial<Checkbox>, noChangeListener?: boolean) {
    return /* html */`<vscode-checkbox id="${id}" value="${id}" ${renderChangeListener("checkbox", noChangeListener)} ${renderAttributes(options)}>${label || ''}</vscode-checkbox>`;
  }

  export function button(label?: string, options?: Partial<Button>) {
    return /* html */`<vscode-button ${renderAttributes(options, "icon", "action")} ${options?.action ? `href="action:${options.action}"` : ""}>
      ${label || ''}
      </vscode-button>`;
  }

  export function badge(count: number, variant?: boolean) {
    return /* html */`<vscode-badge ${variant ? `variant="${variant}"` : ''}>${count}</vscode-badge>`;
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