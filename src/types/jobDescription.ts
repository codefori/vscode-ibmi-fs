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
import { getColumns, executeSqlIfExists, getProtected } from "../tools";
import { generateDetailTable } from "../ibmi";
import * as vscode from 'vscode';
import { CommandResult, IBMiObject } from "@halcyontech/vscode-ibmi-types";
import ObjectProvider from "../objectProvider";

/**
 * Namespace containing actions for Journal objects
 */
export namespace JobDescriptionActions {
  /**
   * Register Journal commands with VS Code
   * @param context - Extension context for command registration
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand("vscode-ibmi-fs.changeJobd", async (item?: IBMiObject | vscode.Uri) => {
        if (item instanceof vscode.Uri) {
          const parts = item.path.split('/');
          if (parts.length >= 3) {
            const library = parts[1];
            const nameWithExt = parts[2];
            const name = nameWithExt.substring(0, nameWithExt.lastIndexOf('.'));
            const result = await chgJobd({ library, name } as IBMiObject);
            if (result) {
              await ObjectProvider.refreshDocument(item);
            }
            return result;
          }
        } else if (item) {
          return chgJobd(item);
        }
      })
    );
  };

  /**
   * Change a Job Description
   * @param item - The Job Description object or IBMiObject
   * @returns True if successful, false otherwise
   */
  export const chgJobd = async (item: IBMiObject | Jobd): Promise<boolean> => {

    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {

      if (getProtected(connection, item.library)) {
        vscode.window.showWarningMessage(vscode.l10n.t("Unable to perform object action because it is protected."));
        return false;
      }

      const clPrompterExt = vscode.extensions.getExtension('CozziResearch.clprompter');
      if (clPrompterExt) {
        // Use CLPrompter for advanced prompting
        if (!clPrompterExt.isActive) {
          await clPrompterExt.activate();
        }
        const { CLPrompter } = clPrompterExt.exports;
        let command = await CLPrompter(`QSYS/CHGJOBD JOBD(${item.library}/${item.name})`);

        if (await vscode.window.showWarningMessage(vscode.l10n.t("Are you sure you want to change Job Description {0}/{1}?", item.library, item.name), { modal: true }, vscode.l10n.t("Change JOBD"))) {
          const cmdrun: CommandResult = await connection.runCommand({
            command: command,
            environment: `ile`
          });

          if (cmdrun.code === 0) {
            vscode.window.showInformationMessage(vscode.l10n.t("Job description changed successfully."));
            return true;
          } else {
            vscode.window.showErrorMessage(vscode.l10n.t("Unable to change job description:\n{0}", String(cmdrun.stderr)));
            return false;
          }
        } else {
          return false;
        }
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t(`This action requires "Bob Cozzi's CL Prompter and Formatter for IBM i" extension`));
        return false;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }
  }
}

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
      this.columns = await getColumns(connection, 'JOB_DESCRIPTION_INFO');

      this.jobd = await executeSqlIfExists(
        connection,
        `SELECT AUTHORIZATION_NAME, JOB_DATE, ACCOUNTING_CODE, ROUTING_DATA, REQUEST_DATA,
          LIBRARY_LIST_COUNT, LIBRARY_LIST, JOB_SWITCHES, TEXT_DESCRIPTION, JOB_QUEUE_LIBRARY CONCAT '/' CONCAT JOB_QUEUE AS JOB_QUEUE, JOB_QUEUE_PRIORITY,
          HOLD_ON_JOB_QUEUE, OUTPUT_QUEUE_LIBRARY CONCAT '/' CONCAT OUTPUT_QUEUE AS OUTPUT_QUEUE, OUTPUT_QUEUE_PRIORITY, SPOOLED_FILE_ACTION, PRINTER_DEVICE,
          PRINT_TEXT, JOB_MESSAGE_QUEUE_MAXIMUM_SIZE, JOB_MESSAGE_QUEUE_FULL_ACTION, SYNTAX_CHECK_SEVERITY, JOB_END_SEVERITY,
          JOBLOG_OUTPUT, INQUIRY_MESSAGE_REPLY, MESSAGE_LOGGING_LEVEL, MESSAGE_LOGGING_SEVERITY, MESSAGE_LOGGING_TEXT,
          LOG_CL_PROGRAM_COMMANDS, DEVICE_RECOVERY_ACTION, TIME_SLICE_END_POOL, ALLOW_MULTIPLE_THREADS,
          ASPGRP,
          DDM_CONVERSATION
          FROM TABLE(QSYS2.JOB_DESCRIPTION_INFO(
                              JOB_DESCRIPTION => '${this.name}',
                              JOB_DESCRIPTION_LIBRARY => '${this.library}'))`,
        'QSYS2',
        'JOB_DESCRIPTION_INFO',
        'VIEW'
      );

      if (this.jobd === null) {
        vscode.window.showErrorMessage(vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "VIEW", "QSYS2", "JOB_DESCRIPTION_INFO"));
        return;
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Generate HTML for the job description view
   * @returns HTML string
   */
  generateHTML(): string {
    return generateDetailTable({
      title: vscode.l10n.t("Job Description: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t('Job Description Information'),
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
