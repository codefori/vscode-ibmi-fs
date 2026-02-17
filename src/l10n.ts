import * as vscode from 'vscode';

/**
 * L10N (Localization) module for managing translations
 * Uses the native VSCode l10n API with English text as keys
 */

/**
 * Get a localized string by key (English text)
 * @param key - The English text to translate
 * @param args - Optional arguments for string interpolation using {0}, {1}, etc.
 * @returns The localized string
 * 
 * @example
 * t("Not connected to IBM i") // Returns translated text based on user's locale
 * t("Data Queue {0}/{1} cleared.", library, name) // With parameters
 */
export function t(key: string, ...args: (string | number)[]): string {
  return vscode.l10n.t(key, ...args);
}

/**
 * Export the t function as default for convenience
 */
export default t;