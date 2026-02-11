import { CodeForIBMi } from "@halcyontech/vscode-ibmi-types";
import { CustomUI } from "@halcyontech/vscode-ibmi-types/webviews/CustomUI";
import Instance from "@halcyontech/vscode-ibmi-types/Instance";
import { VscodeTools } from "@halcyontech/vscode-ibmi-types/ui/Tools";
import { DeployTools } from "@halcyontech/vscode-ibmi-types/filesystems/local/deployTools";
import { Extension, extensions } from "vscode";

/** Reference to the base Code for IBM i extension */
let baseExtension: Extension<CodeForIBMi> | undefined;

/**
 * Load and return the base Code for IBM i extension
 * @returns The CodeForIBMi extension API if available, undefined otherwise
 */
export function loadBase(): CodeForIBMi | undefined {
  if (!baseExtension) {
    baseExtension = (extensions ? extensions.getExtension(`halcyontechltd.code-for-ibmi`) : undefined);
  }

  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports : undefined);
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