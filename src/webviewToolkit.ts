/** @ts-ignore */
import * as WebToolkit from "@vscode/webview-ui-toolkit/dist/toolkit.min.js";

const head = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${WebToolkit}</script>
  <style>
  </style>`;

const footer = /*html*/`
  <script defer>
  const vscode = acquireVsCodeApi();

  console.log(document.querySelectorAll('[href^="action:"]'));
  for (const link of document.querySelectorAll('[href^="action:"]')) {
    link.addEventListener('click', () => {
      let data = {};
      link.getAttributeNames().forEach(attr => {
        data[attr] = link.getAttribute(attr);
      });

      console.log(link);
      console.log(data);

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