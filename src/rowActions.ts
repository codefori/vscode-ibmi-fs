import * as vscode from "vscode";
import { generateFastTableRowAction } from "./ibmi";

/**
 * Prefix of the commands behind the fast table rows' context menu. Each one is contributed
 * in package.json as `vscode-ibmi-fs.rowAction.<action>`, with a `webview/context` entry
 * whose `when` is `webviewSection == fastTableRow && ftAction_<action>`.
 */
const ROW_ACTION_COMMAND_PREFIX = `vscode-ibmi-fs.rowAction.`;

/** Open webviews that can hold fast tables with row actions */
const webviews = new Set<vscode.Webview>();

/**
 * Make a panel's fast tables reachable from their rows' context menu.
 * @param panel - Webview panel showing fast tables with `rowActions`
 */
export function trackRowActions(panel: vscode.WebviewPanel) {
  webviews.add(panel.webview);
  panel.onDidDispose(() => webviews.delete(panel.webview));
}

/**
 * Register one command per row action contributed in package.json. A command only relays
 * the pick to the page, which runs it as a click on `href="action:..."`: the action then
 * reaches the page's usual handler (handleAction, onDidReceiveMessage) like a button would.
 * @param context - Extension context
 */
export function registerRowActionCommands(context: vscode.ExtensionContext) {
  const commands: { command: string }[] = context.extension.packageJSON.contributes.commands;

  for (const { command } of commands.filter(c => c.command.startsWith(ROW_ACTION_COMMAND_PREFIX))) {
    const action = command.substring(ROW_ACTION_COMMAND_PREFIX.length);

    context.subscriptions.push(vscode.commands.registerCommand(command, async (rowContext: unknown) => {
      const message = generateFastTableRowAction(action, rowContext);
      if (!message) {
        return;
      }

      // The context names the table instance the menu was opened on, not its webview:
      // every page gets the message, and only the one holding that table acts on it.
      await Promise.allSettled([...webviews].map(webview => webview.postMessage(message)));
    }));
  }
}
