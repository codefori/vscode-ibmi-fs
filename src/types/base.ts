import { CustomDocument, Uri } from "vscode";
import {} from "@halcyontech/vscode-ibmi-types/api/IBMi";
import { getItemsPerPage } from "../config";
import { FastTableUpdate } from "../ibmi";

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
   * Whether the open panel should reload itself on a timer. Off by default: it only makes
   * sense for objects whose contents change without the user doing anything (queues,
   * subsystems), and every enabled document costs one query per interval.
   *
   * The interval itself comes from `code-for-ibmi.views.autoRefreshInterval` (see
   * `ObjectProvider.resolveCustomEditor`), which also disables the refresh entirely when
   * set to 0. Types implementing {@link generateTableUpdate} get their rows patched in
   * place; the others have their page rebuilt, which is more disruptive.
   */
  public autoRefresh: boolean = false;

  /** Current search term for server-side filtering */
  protected searchTerm: string = '';
  
  /** Current page number for server-side pagination */
  protected currentPage: number = 1;
  
  /** Items per page for server-side pagination, from `code-for-ibmi.tables.itemsPerPage` */
  protected itemsPerPage: number = getItemsPerPage();
  
  /** Total items count for server-side pagination */
  protected totalItems: number = 0;

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
   * Fetch only searchable/paginatable data (for partial refresh)
   * By default calls fetch(), but can be overridden for multi-tab documents
   * to avoid reloading all tabs when only search/pagination changes
   */
  async fetchSearchData(): Promise<void> {
    await this.fetch();
  }

  /**
   * Generate the HTML for the custom editor
   * Uses the @vscode-elements/elements framework for components
   * Reference: https://github.com/vscode-elements/elements
   * @returns HTML string to be displayed in the webview
   */
  abstract generateHTML(): string;

  /**
   * Build the message that replaces the rows of a table already on screen, instead of
   * rebuilding the whole page.
   *
   * Implemented only by the types that search or paginate server-side, or that auto-refresh;
   * the ones that don't leave it undefined and `ObjectProvider` falls back to reassigning
   * `webview.html`. Implementations must reuse the same column list as `generateHTML`, and
   * pass the same `tableId` the table was rendered with — an update carrying any other id is
   * discarded by every table on the page.
   *
   * Returning an array patches several tables at once, which is what a document hosting more
   * than one needs on a refresh. Return undefined to ask for a full rebuild instead — the
   * right answer when the page structure itself changed, since patching rows cannot make a
   * missing tab appear.
   *
   * @param tableId - Which table to update; when omitted, every table the document hosts
   * @returns The update message(s), or undefined to fall back to a rebuild
   */
  generateTableUpdate?(tableId?: string): FastTableUpdate | FastTableUpdate[] | undefined;

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