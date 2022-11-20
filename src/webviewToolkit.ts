/** @ts-ignore */
import * as WebToolkit from "@vscode/webview-ui-toolkit/dist/toolkit.min.js";

const head = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${WebToolkit}</script>
  <style>
    section {
      width: 100%;
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
    link.addEventListener('input', () => {
      console.log(link);
      let data = {
        change: link.getAttribute('change'),
        id: link.getAttribute('id'),
        value: link.getAttribute('current-value')
      };

      vscode.postMessage(data);
    });
  }

  window.addEventListener("message", (event) => {
  });
  </script>
`;

export default function generatePage(body: string) {
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