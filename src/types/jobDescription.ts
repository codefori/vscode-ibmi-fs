/**
 * Job Description Management Module
 *
 * This module provides functionality for viewing IBM i Job Descriptions (JOBD).
 * Job Descriptions define the runtime environment and attributes for batch jobs,
 * including job queues, output queues, libraries, and other job-related settings.
 *
 * Key Features:
 * - Display job description information and attributes
 * - View job queue associations
 * - View output queue settings
 * - View library list configuration
 * - View job accounting and logging settings
 * - Read-only view (no modification capabilities)
 *
 * @module jobdescription
 */

import Base from "./base";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable, checkViewExists } from "../tools";
import * as vscode from 'vscode';

/**
 * Job Description (JOBD) object class
 * Handles display of IBM i Job Description information
 */
export default class Jobd extends Base {
  /** Job description information from database */
  private jobd?: any;
  /** Column definitions for display */
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  /**
   * Fetch job description information from IBM i
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if JOB_DESCRIPTION_INFO view exists
      const viewExists = await checkViewExists(connection, 'QSYS2', 'JOB_DESCRIPTION_INFO');
      if (!viewExists) {
        vscode.window.showErrorMessage(t("SQL object {0} {1}/{2} not found", "VIEW", "QSYS2", "JOB_DESCRIPTION_INFO"));
        return;
      }

      this.columns = await getColumns(connection, 'JOB_DESCRIPTION_INFO');

      this.jobd = await connection.runSQL(
        `SELECT AUTHORIZATION_NAME, JOB_DATE, ACCOUNTING_CODE, ROUTING_DATA, REQUEST_DATA,
          LIBRARY_LIST_COUNT, LIBRARY_LIST, JOB_SWITCHES, TEXT_DESCRIPTION, JOB_QUEUE_LIBRARY CONCAT '/' CONCAT JOB_QUEUE AS JOB_QUEUE, JOB_QUEUE_PRIORITY,
          HOLD_ON_JOB_QUEUE, OUTPUT_QUEUE_LIBRARY CONCAT '/' CONCAT OUTPUT_QUEUE AS OUTPUT_QUEUE, OUTPUT_QUEUE_PRIORITY, SPOOLED_FILE_ACTION, PRINTER_DEVICE,
          PRINT_TEXT, JOB_MESSAGE_QUEUE_MAXIMUM_SIZE, JOB_MESSAGE_QUEUE_FULL_ACTION, SYNTAX_CHECK_SEVERITY, JOB_END_SEVERITY,
          JOBLOG_OUTPUT, INQUIRY_MESSAGE_REPLY, MESSAGE_LOGGING_LEVEL, MESSAGE_LOGGING_SEVERITY, MESSAGE_LOGGING_TEXT,
          LOG_CL_PROGRAM_COMMANDS, DEVICE_RECOVERY_ACTION, TIME_SLICE_END_POOL, ALLOW_MULTIPLE_THREADS, WORKLOAD_GROUP, ASPGRP,
          DDM_CONVERSATION
          FROM QSYS2.JOB_DESCRIPTION_INFO
          WHERE JOB_DESCRIPTION = '${this.name}' AND JOB_DESCRIPTION_LIBRARY = '${this.library}'
          Fetch first row only`)
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the job description view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: `Job Description: ${this.library}/${this.name}`,
      subtitle: 'Job Description Information',
      columns: this.columns,
      data: this.jobd
    });
  }

  /**
   * Handle user actions from the webview
   * @param data - Action data from the webview
   * @returns Empty action result (no actions available)
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for job descriptions
    return {};
  }

  /**
   * Save changes (not applicable for job descriptions)
   */
  async save(): Promise<void> {
    // Job descriptions are read-only in this view
  }
}
