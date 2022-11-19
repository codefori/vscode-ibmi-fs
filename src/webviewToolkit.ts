/** @ts-ignore */
import * as WebToolkit from "@vscode/webview-ui-toolkit/dist/toolkit.min.js";

const head = /*html*/`
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script defer type="module">${WebToolkit}</script>
  <style>
  </style>`;

export default function generatePage(body: string) {
  return /*html*/ `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      ${head}
      <script>
        window.addEventListener("message", (event) => {
        });
      </script>
    </head>
    <body>
      ${body}
    </body>
  </html>
`;
}