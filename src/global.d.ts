/**
 * Result interface for action handlers
 * Used to communicate the outcome of user actions in custom editors
 */
interface HandleActionResult {
  /** Indicates if the document has been modified and needs to be saved */
  dirty?: boolean;
  /** Indicates if the view needs to be re-rendered */
  rerender?: boolean;
}