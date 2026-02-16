import { CustomDocument, Uri, extensions } from "vscode";
import {} from "@halcyontech/vscode-ibmi-types/api/IBMi";

/**
 * Abstract base class for all IBM i object types
 * Implements the CustomDocument interface for VS Code custom editors
 */
export default abstract class Base implements CustomDocument {
  /** Flag indicating if the initial data fetch failed */
  public failedFetch: boolean = false;
  
  /** Flag indicating if the webview should auto-close (used for text editor redirects) */
  public shouldAutoClose: boolean = false;

  /**
   * Constructor for Base class
   * @param uri - The URI of the document
   * @param library - The IBM i library name
   * @param name - The IBM i object name
   */
  constructor(readonly uri: Uri, readonly library: string, readonly name: string) {
  }

  /**
   * Dispose of the document resources
   */
  dispose(): void {
    // No resources to dispose
  }

  /**
   * Fetch data from the remote IBM i system
   * This method is called first when opening the document and when reverting changes.
   * Data should be stored in private properties of the extended class.
   */
  abstract fetch(): Promise<void>;

  /**
   * Generate the HTML for the custom editor
   * Uses the @vscode-elements/elements framework for components
   * Reference: https://github.com/vscode-elements/elements
   * @returns HTML string to be displayed in the webview
   */
  abstract generateHTML(): string;

  /**
   * Handle user actions from the webview
   * Called when any link, button or other element with `href="action:..."` is clicked.
   * Attributes from the clicked element are passed in the data parameter.
   *
   * Example usage:
   * ```html
   * <vscode-link href="action:create">Create</vscode-link>
   * <vscode-link href="action:delete" item="${node.name}">Delete</vscode-link>
   * ```
   *
   * Elements with `readonly="false"` are passed into a `bindings` property.
   * Use `change="action:<someid>"` on input elements to trigger this method on value changes.
   *
   * @param data - Data from the clicked element including attributes and bindings
   * @returns Object indicating if document is dirty or needs re-rendering
   *
   * Note: Returning `dirty: true` sets document to dirty and may trigger save.
   * Returning `rerender: true` calls generateHTML and updates the view.
   * When rerender is true, all user inputs are reset to default values.
   */
  abstract handleAction(data: any): Promise<HandleActionResult>;

  /**
   * Save changes to the IBM i object
   * Run remote commands to update the object based on private properties.
   * Throw an error with a meaningful message if the save fails.
   * When successful, the document is marked as no longer dirty.
   */
  abstract save(): Promise<void>;
}