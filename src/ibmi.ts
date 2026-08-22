import { CodeForIBMi } from "@halcyontech/vscode-ibmi-types";
import Instance from "@halcyontech/vscode-ibmi-types/Instance";
import { VscodeTools } from "@halcyontech/vscode-ibmi-types/ui/Tools";
import { FrontendTables } from "@halcyontech/vscode-ibmi-types/ui/frontendTables";
import { ExtensionContext, Extension, extensions } from "vscode";
import { ClassInfoComponent } from "./connection/components/classInfo";
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
 * Generate an enhanced detail table (key-value pairs) via the base extension's frontendTables API
 * @param options - Detail table configuration options
 * @returns Complete HTML page string
 */
export function generateDetailTable(options: DetailTableOptions): string {
  return loadBase()!.frontendTables.generateDetailTable(options);
}

/**
 * Generate a complete HTML page with a FAST Element table via the base extension's frontendTables API
 * @param options - Table configuration options
 * @returns Complete HTML page string
 */
export function generateFastTable<T>(options: FastTableOptions<T>): string {
  return loadBase()!.frontendTables.generateFastTable(options);
}

/**
 * Build the message that replaces the rows of a table already on screen, via the base
 * extension's frontendTables API.
 *
 * Post this instead of reassigning `webview.html`: rebuilding the page recreates the search
 * box (dropping keyboard focus and restoring the term as it was when the query started) and
 * resets the active tab.
 *
 * @param options - The new data plus the pagination state it corresponds to
 * @returns Message to pass to `webview.postMessage`
 */
export function generateFastTableUpdate<T>(options: FastTableUpdateOptions<T>): FastTableUpdate {
  return loadBase()!.frontendTables.generateFastTableUpdate(options);
}