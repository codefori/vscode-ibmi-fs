import { CodeForIBMi } from "@halcyontech/vscode-ibmi-types";
import Instance from "@halcyontech/vscode-ibmi-types/Instance";
import { Extension, ExtensionContext, extensions } from "vscode";

let baseExtension: Extension<CodeForIBMi>|undefined;

export function loadBase(context: ExtensionContext): CodeForIBMi|undefined {
  if (!baseExtension) {
    baseExtension = (extensions ? extensions.getExtension(`halcyontechltd.code-for-ibmi`) : undefined);

    if (!baseExtension) {  
      throw new Error("halcyontechltd.code-for-ibmi not found or cannot be activated");
    }
  }
  
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports : undefined);
}

export function getBase(): CodeForIBMi|undefined {
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports : undefined);
}

export function getInstance(): Instance|undefined {
  return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.instance : undefined);
}