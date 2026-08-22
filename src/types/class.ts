/**
 * Class Management Module
 *
 * This module provides functionality for viewing IBM i Class objects (CLS).
 * Classes define the runtime attributes for batch jobs, including run priority,
 * time slice, and resource limits (CPU time, temporary storage, threads).
 *
 * Key Features:
 * - Display class information and attributes
 * - View run priority and time slice settings
 * - View resource limits (CPU time, temporary storage, threads)
 * - View default wait time settings
 * - View purge eligibility status
 * - View usage statistics (last used date, days used count)
 * - Automatic installation of the required SQL objects (stored procedure, table function)
 * - Read-only view (no modification capabilities)
 *
 * Technical Implementation:
 * - Uses the QWCRCLSI API to retrieve class information, wrapped as an
 *   {@link QwcrclsiComponent IBMi component} installed on demand
 * - Queries the {@link ClassInfoComponent CLASS_INFO table function}, also installed on demand,
 *   which combines QWCRCLSI with OBJECT_STATISTICS for a single class
 *
 * @module class
 */

import * as vscode from 'vscode';
import { getInstance } from "../ibmi";
import { generateDetailTable } from "../ibmi";
import { ClassInfoComponent } from "../connection/components/classInfo";
import Base from "./base";

/**
 * Class (CLS) object class
 * Handles display of IBM i Class information and attributes
 *
 * Classes define runtime attributes for batch jobs including:
 * - Run priority (1-99, lower = higher priority)
 * - Time slice (milliseconds of CPU time per time slice)
 * - Resource limits (CPU time, temporary storage, active threads)
 * - Default wait time for locks
 * - Purge eligibility
 */
export default class Cls extends Base {
  /** Class information retrieved from database */
  private cls?: any;
  /** Column definitions for display table */
  columns: Map<string, string> = new Map();
  /** SQL SELECT clause (unused in current implementation) */
  selectClause: string | undefined;

  /**
   * Fetch class information from IBM i
   *
   * This method performs the following steps:
   * 1. Ensures the {@link ClassInfoComponent CLASS_INFO table function} (and, transitively, the
   *    QWCRCLSI procedure it depends on) is installed in the connection's temporary library
   * 2. Queries it for the specific class
   *
   * @throws Will show error message if the required components cannot be installed
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      const tempLib = connection.getConfig().tempLibrary;

      // Define column mappings for display
      // Maps database column names to user-friendly display labels
      this.columns = new Map<string, string>([
        ['TEXT_DESCRIPTION', vscode.l10n.t('Text')],
        ['LAST_USED_TIMESTAMP', vscode.l10n.t('Last used date')],
        ['USE_COUNT', vscode.l10n.t('Days used count')],
        ['RUN_PRIORITY', vscode.l10n.t('Run priority')],
        ['TIME_SLICE', vscode.l10n.t('Time slice in ms')],
        ['ELIGIBLE_PURGE', vscode.l10n.t('Eligible for purge')],
        ['DEFAULT_WAIT', vscode.l10n.t('Default wait time in s')],
        ['MAXIMUM_CPU_TIME', vscode.l10n.t('Maximum CPU time in ms')],
        ['MAXIMUM_TEMPORARY_STORAGE_ALLOWED', vscode.l10n.t('Maximum temporary storage in MB')],
        ['MAXIMUM_ACTIVE_THREADS', vscode.l10n.t('Maximum threads')]
      ])

      // Query the class information for the specific class
      this.cls = await connection.runSQL(
        `SELECT TEXT_DESCRIPTION,
          to_char(LAST_USED, 'yyyy-mm-dd') as LAST_USED_TIMESTAMP,
          USE_COUNT,
          RUN_PRIORITY,
          TIME_SLICE,
          ELIGIBLE_PURGE,
          DEFAULT_WAIT,
          MAXIMUM_CPU_TIME,
          MAXIMUM_TEMPORARY_STORAGE_ALLOWED,
          MAXIMUM_ACTIVE_THREADS
        FROM TABLE(${tempLib}.${ClassInfoComponent.FUNCTION_NAME}('${this.library}', '${this.name}')) X`)
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the class information view
   *
   * Creates a detailed table displaying all class attributes including:
   * - Text description
   * - Usage statistics (last used date, days used count)
   * - Run priority and time slice
   * - Resource limits (CPU time, temporary storage, threads)
   * - Default wait time and purge eligibility
   *
   * @returns HTML string containing the formatted class information table
   */
  generateHTML(): string {
    return generateDetailTable({
      title: vscode.l10n.t("Class: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t('Class Information'),
      columns: this.columns,
      data: this.cls,
      hideNullValues: true
    });
  }

  /**
   * Handle user actions from the webview
   *
   * Classes are read-only objects in this implementation,
   * so no actions are available to the user.
   *
   * @param data - Action data from the webview (unused)
   * @returns Empty action result indicating no actions were performed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for classes (read-only view)
    return {};
  }

  /**
   * Save changes to the class object
   *
   * This method is not implemented as classes are displayed
   * in read-only mode. Class attributes should be modified
   * using the CHGCLS (Change Class) CL command.
   */
  async save(): Promise<void> {
    // Classes are read-only in this view
    // Use CHGCLS command to modify class attributes
  }
}
