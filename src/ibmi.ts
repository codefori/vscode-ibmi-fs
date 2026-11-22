import { CodeForIBMi } from "@halcyontech/vscode-ibmi-types";
import Instance from "@halcyontech/vscode-ibmi-types/Instance";
import { VscodeTools } from "@halcyontech/vscode-ibmi-types/ui/Tools";
import { FrontendTables } from "@halcyontech/vscode-ibmi-types/ui/frontendTables";
import { ExtensionContext, Extension, extensions, l10n, Webview, WebviewPanel, commands as vscodeCommands } from "vscode";
import { ClassInfoComponent } from "./connection/components/classInfo";
import { PgmRefsComponent } from "./connection/components/pgmRefs";
import { QwcrclsiComponent } from "./connection/components/qwcrclsi";

/** Reference to the base Code for IBM i extension */
let baseExtension: Extension<CodeForIBMi> | undefined;
/** Whether this extension's components have already been registered with the base extension */
let componentsRegistered = false;

/**
 * Load and return the base Code for IBM i extension
 *
 * @param context - The extension context; when provided (i.e. called from `activate`), this
 * extension's {@link IBMiComponent}s are registered with the base extension's component registry.
 * @returns The CodeForIBMi extension API if available, undefined otherwise
 */
export function loadBase(context?: ExtensionContext): CodeForIBMi | undefined {
  if (!baseExtension) {
    baseExtension = (extensions ? extensions.getExtension(`halcyontechltd.code-for-ibmi`) : undefined);
  }

  const base = (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports : undefined);

  if (base && context && !componentsRegistered) {
    base.componentRegistry.registerComponent(context, new QwcrclsiComponent());
    base.componentRegistry.registerComponent(context, new ClassInfoComponent());
    base.componentRegistry.registerComponent(context, new PgmRefsComponent());
    componentsRegistered = true;
  }

  return base;
}

/**
 * Get the current IBM i connection instance
 * @returns The active Instance if available, undefined otherwise
 */
export function getInstance(): Instance | undefined {
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.instance : undefined);
}

/**
 * Get the VS Code tools from the base extension
 * @returns The VscodeTools if available, undefined otherwise
 */
export function getVSCodeTools(): typeof VscodeTools | undefined {
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.tools : undefined);
}

/** Column definition for FastTable, re-exported from the base extension's frontendTables API */
export type FastTableColumn<T> = FrontendTables.FastTableColumn<T>;
/** Options for generating a FastTable, re-exported from the base extension's frontendTables API */
export type FastTableOptions<T> = FrontendTables.FastTableOptions<T>;
/** Options for generating a detail table, re-exported from the base extension's frontendTables API */
export type DetailTableOptions = FrontendTables.DetailTableOptions;
/** Action button configuration for detail tables, re-exported from the base extension's frontendTables API */
export type DetailTableAction = FrontendTables.DetailTableAction;
/** Options for building an incremental table update, re-exported from the base extension's frontendTables API */
export type FastTableUpdateOptions<T> = FrontendTables.FastTableUpdateOptions<T>;
/** Message that replaces a live table's rows, re-exported from the base extension's frontendTables API */
export type FastTableUpdate = FrontendTables.FastTableUpdate;

/**
 * An action offered on a table row through VS Code's context menu (right click, Shift+F10,
 * the context menu key); the primary one also runs on a double click or Enter.
 *
 * Mirrors the base extension's `FrontendTables.FastTableRowAction`, which the published
 * types don't carry yet, plus the `label` used by the fallback buttons (see
 * {@link generateFastTable}). The context menu entry itself is a `webview/context` item in
 * package.json, bound to the `vscode-ibmi-fs.rowAction.<action>` command.
 */
export interface RowAction<T> {
  /** Action identifier: the part after `action:` in the href handed to `handleAction` */
  action: string;
  /** Button text when the base extension has no row actions */
  label: string;
  /** Run on double click / Enter. When several are visible on a row, the first one wins. */
  primary?: boolean;
  /** Ends, deletes or removes something: never run by a double click or Enter */
  destructive?: boolean;
  /** Whether the action applies to the row (default: always) */
  visible?: (row: T) => boolean;
}

/** Row actions of a table, passed alike to {@link generateFastTable} and {@link generateFastTableUpdate} */
export interface RowActions<T> {
  /** Query string appended to every action of the row, e.g. `entry=...` */
  getArgs: (row: T) => string;
  actions: RowAction<T>[];
  /** Width of the fallback Actions column (default 1fr) */
  fallbackWidth?: string;
}

/** Prefix of the commands that relay a context menu pick back to the page (see {@link registerRowActionCommands}) */
const ROW_ACTION_COMMAND_PREFIX = 'vscode-ibmi-fs.rowAction.';

/** Webviews showing tables with row actions, which a context menu pick may have come from */
const rowActionWebviews = new Set<Webview>();

/**
 * Whether the base extension renders row actions itself (context menu, double click).
 * Older releases ignore `rowActions`, so the actions are rendered as buttons instead.
 */
function supportsRowActions(): boolean {
  return typeof (loadBase()?.frontendTables as any)?.generateFastTableRowAction === 'function';
}

/**
 * Translate this extension's row actions for the base extension: passed through when it
 * supports them, otherwise turned into a trailing Actions column of buttons with the same
 * hrefs, so `handleAction` receives exactly the same messages either way.
 */
function applyRowActions<T, O extends { columns: FastTableColumn<T>[], rowActions?: RowActions<T> }>(options: O): O {
  const { rowActions } = options;
  if (!rowActions || supportsRowActions()) {
    return options;
  }

  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const actionsColumn: FastTableColumn<T> = {
    title: l10n.t("Actions"),
    width: rowActions.fallbackWidth ?? '1fr',
    getValue: row => {
      const args = rowActions.getArgs(row);
      const buttons = rowActions.actions
        .filter(action => !action.visible || action.visible(row))
        .map(action => `<vscode-button appearance="${action.primary ? 'primary' : 'secondary'}" href="action:${escapeHtml(action.action)}${args ? `?${escapeHtml(args)}` : ''}">${escapeHtml(action.label)}</vscode-button>`)
        .join(' ');
      return buttons || '&nbsp;';
    }
  };

  return { ...options, columns: [...options.columns, actionsColumn], rowActions: undefined };
}

/**
 * Make a panel's tables reachable from the row action commands. Call once per panel that
 * shows a table with row actions; it is forgotten when the panel is disposed.
 * @param panel - The panel hosting the tables
 */
export function trackRowActionPanel(panel: WebviewPanel): void {
  const webview = panel.webview;
  rowActionWebviews.add(webview);
  panel.onDidDispose(() => rowActionWebviews.delete(webview));
}

/**
 * Register one command per `vscode-ibmi-fs.rowAction.<action>` command declared in
 * package.json. Each posts the picked action to every tracked page; only the table the
 * menu was opened on (identified by a token in the menu context) runs it.
 * @param context - The extension context
 */
export function registerRowActionCommands(context: ExtensionContext): void {
  const commands: { command: string }[] = context.extension.packageJSON?.contributes?.commands ?? [];
  for (const { command } of commands) {
    if (!command.startsWith(ROW_ACTION_COMMAND_PREFIX)) {
      continue;
    }
    const action = command.substring(ROW_ACTION_COMMAND_PREFIX.length);
    context.subscriptions.push(vscodeCommands.registerCommand(command, async (menuContext: unknown) => {
      const message = (loadBase()?.frontendTables as any)?.generateFastTableRowAction?.(action, menuContext);
      if (!message) {
        return;
      }
      await Promise.all([...rowActionWebviews].map(webview => webview.postMessage(message).then(undefined, () => false)));
    }));
  }
}

/**
 * Generate an enhanced detail table (key-value pairs) via the base extension's frontendTables API
 * @param options - Detail table configuration options
 * @returns Complete HTML page string
 */
export function generateDetailTable(options: DetailTableOptions): string {
  return loadBase()!.frontendTables.generateDetailTable(options);
}

/**
 * Generate a complete HTML page with a FAST Element table via the base extension's frontendTables API
 * @param options - Table configuration options; `rowActions` become context menu entries,
 * or buttons in a trailing Actions column when the base extension predates them
 * @returns Complete HTML page string
 */
export function generateFastTable<T>(options: FastTableOptions<T> & { rowActions?: RowActions<T> }): string {
  return loadBase()!.frontendTables.generateFastTable(applyRowActions<T, typeof options>(options));
}

/**
 * Build the message that replaces the rows of a table already on screen, via the base
 * extension's frontendTables API.
 *
 * Post this instead of reassigning `webview.html`: rebuilding the page recreates the search
 * box (dropping keyboard focus and restoring the term as it was when the query started) and
 * resets the active tab.
 *
 * @param options - The new data plus the pagination state it corresponds to, with the same
 * `rowActions` the table was rendered with
 * @returns Message to pass to `webview.postMessage`
 */
export function generateFastTableUpdate<T>(options: FastTableUpdateOptions<T> & { rowActions?: RowActions<T> }): FastTableUpdate {
  return loadBase()!.frontendTables.generateFastTableUpdate(applyRowActions<T, typeof options>(options));
}