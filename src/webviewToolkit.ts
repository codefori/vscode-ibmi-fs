/** @ts-ignore */
import * as WebToolkit from "@vscode/webview-ui-toolkit/dist/toolkit.min.js";

//@TODO: Badge

const head = /*html*/`
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${WebToolkit}</script>
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

    function getInputs() {
      let data = {};
      // Text filed
      for (const input of document.querySelectorAll('vscode-text-field')) {
        data[input.id] = input.value;
      }

      // Checkbox
      for (const input of document.querySelectorAll('vscode-checkbox')) {
        data[input.id] = input.checked;
      }

      // Dropdown
      for (const input of document.querySelectorAll('vscode-dropdown')) {
        const selectElement = document.querySelector('#' + input.id);
        data[input.id] = selectElement.options[selectElement.selectedIndex].value;
      }
      
      // Radio
      for (const input of document.querySelectorAll('vscode-radio-group')) {
        const radioElement = document.getElementsByName(input.name);
        for(i = 0; i < radioElement.length; i++) {
          if(radioElement[i].checked) {
            data[input.name] = radioElement[i].textContent;
            break;
          }
        }
      }

      return data;
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

    const saveButton = document.getElementById("saveData");
    if (saveButton) {
      saveButton.addEventListener("click", () => {
          const data = getInputs();
          vscode.postMessage({data})
      }
      );
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

export namespace Components {
  interface Component {
    class?: string
  }

  interface TextField extends Component {
    autofocus: boolean
    disabled: boolean
    maxlength: number
    placeholder: string
    readonly: boolean
    size: number
    type: 'Text' | 'Email' | 'Password' | 'Tel' | 'Url'
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
    icon: ButtonIcon
  }

  interface ButtonIcon extends Component {
    name: string
    left: boolean
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

  interface Column<T> {
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

  interface RadioGroup extends Component {
    disabled: boolean
    name: string
    orientation: 'horiztonal' | 'vertical'
    items: string[]
    readonly: boolean
    label: string
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
    return /*html*/ `<vscode-data-grid-row class="${grid.headerClass}" class="${grid.rowClass?.(row)}"}>
        ${grid.columns.map((col, index) => /*html*/ `<vscode-data-grid-cell grid-column="${index + 1}" class="${col.cellClass?.(row) || ''}">${col.cellValue(row)}</vscode-data-grid-cell>`).join("")}        
      </vscode-data-grid-row>`;
  }

  export function divider(options?: Partial<Divider>) {
    return /* html */`<vscode-divider ${renderAttributes(options)}></vscode-divider>`;
  }

  export function dropDown(id: string, dropDown: Partial<DropDown>, label?: string, noChangeListener?: boolean) {
    return /*html*/ `${label ? /*html*/ `<label for="${id}">${label}:</label><br>`: ''}
    <vscode-dropdown id="${id}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(dropDown, "indicator")}>
      ${dropDown.indicator ? /*html*/ `<span slot="indicator" class="codicon codicon-${dropDown.indicator}"></span>` : ''}
      ${dropDown.items?.map(item => /*html*/ `<vscode-option>${item}</vscode-option>`).join("")}
    </vscode-dropdown>`;
  }

  export function radioGroup(name: string, radioGroup: Partial<RadioGroup>, noChangeListener?: boolean) {
    return /*html*/ `<vscode-radio-group name="${name}" ${renderChangeListener("input", noChangeListener)} ${renderAttributes(radioGroup, "indicator")}>
      <label slot="label">${radioGroup.label || ""}</label>
      ${radioGroup.items?.map(item => /*html*/ `<vscode-radio>${item}</vscode-radio>`).join("")}
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

  export function button(id: string, label?: string, options?: Partial<Button>) {
    return /* html */`<vscode-button id="${id}" name="${id}" ${renderAttributes(options, "icon")}>
      ${label || ''}
      ${options?.icon ? /* html */ `<span class="codicon codicon-${options.icon.name}"${options.icon.left ? ' slot="start"' : ''}></span>` : ''}
      </vscode-button>`;
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