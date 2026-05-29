/**
 * Common Operations Module
 *
 * This module provides shared functionality for managing IBM i jobs and spooled files.
 * These functions are used across different object types (Job Queues, Output Queues,
 * Subsystem Descriptions, etc.) to avoid code duplication and maintain consistency.
 *
 * Key Features:
 * - Job operations: hold, release, end, debug
 * - Spool operations: delete, download as PDF
 * - Consistent error handling and user feedback
 * - Connection validation
 *
 * @module commonOperations
 */

import * as vscode from 'vscode';
import { CommandResult } from '@halcyontech/vscode-ibmi-types';
import { getInstance } from './ibmi';
import { checkTableFunctionExists } from './tools';
import { posix } from 'path';

/**
 * Interface representing a job identifier
 */
export interface JobIdentifier {
  /** Qualified job name in format: number/user/name */
  job: string;
}

/**
 * Interface representing a spooled file identifier
 */
export interface SpoolIdentifier {
  /** Spooled file name */
  spoolname: string;
  /** Spooled file number */
  nbr: number;
  /** Qualified job name that created the spool */
  job: string;
}

/**
 * Namespace containing common job operations
 */
export namespace JobOperations {
  /**
   * Hold a job
   * Prevents the job from executing until it is released
   * @param jobId - Job identifier containing the qualified job name
   * @param showConfirmation - Whether to show confirmation dialog (default: true)
   * @returns True if successful, false otherwise
   */
  export const holdJob = async (jobId: JobIdentifier, showConfirmation: boolean = true): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    // Show confirmation dialog if requested
    if (showConfirmation) {
      const confirmed = await vscode.window.showWarningMessage(
        vscode.l10n.t("Are you sure you want to hold job {0}?", jobId.job),
        { modal: true },
        vscode.l10n.t("Hold job")
      );
      if (!confirmed) {
        return false;
      }
    }

    try {
      // Execute HLDJOB command on IBM i
      const cmdrun: CommandResult = await connection.runCommand({
        command: `QSYS/HLDJOB JOB(${jobId.job})`,
        environment: `ile`
      });

      // Check command execution result
      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("Job held."));
        return true;
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t("Unable to hold selected job:\n{0}", String(cmdrun.stderr))
        );
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error holding job: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * Release a job
   * Allows a previously held job to execute
   * @param jobId - Job identifier containing the qualified job name
   * @param showConfirmation - Whether to show confirmation dialog (default: true)
   * @returns True if successful, false otherwise
   */
  export const releaseJob = async (jobId: JobIdentifier, showConfirmation: boolean = true): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    // Show confirmation dialog if requested
    if (showConfirmation) {
      const confirmed = await vscode.window.showWarningMessage(
        vscode.l10n.t("Are you sure you want to release job {0}?", jobId.job),
        { modal: true },
        vscode.l10n.t("Release job")
      );
      if (!confirmed) {
        return false;
      }
    }

    try {
      // Execute RLSJOB command on IBM i
      const cmdrun: CommandResult = await connection.runCommand({
        command: `QSYS/RLSJOB JOB(${jobId.job})`,
        environment: `ile`
      });

      // Check command execution result
      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("Job released."));
        return true;
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t("Unable to release selected job:\n{0}", String(cmdrun.stderr))
        );
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error releasing job: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * End a job
   * Terminates the job execution
   * @param jobId - Job identifier containing the qualified job name
   * @param option - End option: *CNTRLD (controlled) or *IMMED (immediate). Default: *CNTRLD
   * @param showConfirmation - Whether to show confirmation dialog (default: true)
   * @returns True if successful, false otherwise
   */
  export const endJob = async (
    jobId: JobIdentifier,
    option: '*CNTRLD' | '*IMMED' = '*CNTRLD',
    showConfirmation: boolean = true
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    // Show confirmation dialog if requested
    if (showConfirmation) {
      const confirmed = await vscode.window.showWarningMessage(
        vscode.l10n.t("Are you sure you want to end job {0}?", jobId.job),
        { modal: true },
        vscode.l10n.t("End job")
      );
      if (!confirmed) {
        return false;
      }
    }

    try {
      // Execute ENDJOB command on IBM i
      const cmdrun: CommandResult = await connection.runCommand({
        command: `QSYS/ENDJOB JOB(${jobId.job}) OPTION(${option})`,
        environment: `ile`
      });

      // Check command execution result
      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("Job ended."));
        return true;
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t("Unable to end selected job:\n{0}", String(cmdrun.stderr))
        );
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error ending job: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * Debug a job
   * Attaches the debugger to an active job
   * @param jobId - Job identifier containing the qualified job name
   * @returns True if successful, false otherwise
   */
  export const debugJob = async (job: JobIdentifier): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {

      const dbgjob = job.job

      // Start debug session
      const debugConfig: vscode.DebugConfiguration = {
        type: "IBMiDebug",
        request: "attach",
        name: `IBM i Debug: Attach to job ${dbgjob}`,
        user: connection.currentUser.toUpperCase(),
        password: "${command:AskForPassword}",
        host: connection.currentHost,
        port: connection.getConfig().debugPort,
        jobId: dbgjob
      };

      const debugResult = await vscode.debug.startDebugging(undefined, debugConfig, undefined);

      if (debugResult) {
        vscode.window.showInformationMessage(
          vscode.l10n.t("Debug session started for job {0}", dbgjob)
        );
        return true;
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t("Failed to start debug session for job {0}", dbgjob)
        );
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error starting debug session: {0}", String(error))
      );
      return false;
    }
  };
}

/**
 * Namespace containing common spooled file operations
 */
export namespace SpoolOperations {
  /**
   * Delete a spooled file
   * @param spoolId - Spooled file identifier
   * @param showConfirmation - Whether to show confirmation dialog (default: true)
   * @returns True if successful, false otherwise
   */
  export const deleteSpool = async (
    spoolId: SpoolIdentifier,
    showConfirmation: boolean = true
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    // Show confirmation dialog if requested
    if (showConfirmation) {
      const confirmed = await vscode.window.showWarningMessage(
        vscode.l10n.t(
          "Are you sure you want to delete spool {0} number {1} of job {2}?",
          spoolId.spoolname,
          String(spoolId.nbr),
          spoolId.job
        ),
        { modal: true },
        vscode.l10n.t("Delete spool")
      );
      if (!confirmed) {
        return false;
      }
    }

    try {
      // Execute DLTSPLF command on IBM i
      const cmdrun: CommandResult = await connection.runCommand({
        command: `QSYS/DLTSPLF FILE(${spoolId.spoolname}) JOB(${spoolId.job}) SPLNBR(${spoolId.nbr})`,
        environment: `ile`
      });

      // Check command execution result
      if (cmdrun.code === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t("Spool deleted."));
        return true;
      } else {
        vscode.window.showErrorMessage(
          vscode.l10n.t("Unable to delete selected spool:\n{0}", String(cmdrun.stderr))
        );
        return false;
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error deleting spool: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * Open a spooled file in VS Code editor
   * Copies the spool to a temporary stream file and opens it in the editor
   * @param spoolId - Spooled file identifier
   * @returns True if successful, false otherwise
   */
  export const openSpool = async (
    spoolId: SpoolIdentifier,
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    try {
      // Create a temporary directory and copy the spool file to it
      return connection.withTempDirectory(async (tempDir) : Promise<boolean> => {
        // Generate temporary file path for the spool content
        const tempSourcePath = posix.join(tempDir, `spool.txt`);

        // Execute CPYSPLF command to copy spool to stream file
        const result = await connection.runCommand({
          command: `QSYS/CPYSPLF FILE(${spoolId.spoolname}) JOB(${spoolId.job}) SPLNBR(${spoolId.nbr}) TOFILE(*TOSTMF) TOSTMF('${tempSourcePath}')
            CPY OBJ('${tempSourcePath}') TOOBJ('${tempSourcePath}') TOCCSID(*PCASCII) DTAFMT(*TEXT) REPLACE(*YES)`,
          environment: 'ile'
        });

        if(result.code===0){
          // Create URI for the temporary file and open it in VS Code as readonly
          const uri = vscode.Uri.parse(tempSourcePath).with({
            scheme: `streamfile`
          });
          await vscode.commands.executeCommand(`vscode.open`, uri, {
            preview: false,
            preserveFocus: false
          });
          
          return true;
        } else {
          vscode.window.showErrorMessage(
            vscode.l10n.t("Error opening spool: {0}", String(result.stderr))
          );
          return false;
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Error opening spool: {0}", String(error))
      );
      return false;
    }
  };

  /**
   * Generate and download a PDF from a spooled file
   * Uses the SYSTOOLS.GENERATE_PDF function to convert the spool to PDF format
   * @param spoolId - Spooled file identifier
   * @param defaultFileName - Default file name for the PDF (without extension)
   * @returns True if successful, false otherwise
   */
  export const downloadSpoolAsPdf = async (
    spoolId: SpoolIdentifier,
    defaultFileName: string = 'generatedPDF'
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return false;
    }

    // Check if GENERATE_PDF function exists
    const functionExists = await checkTableFunctionExists(connection, 'SYSTOOLS', 'GENERATE_PDF');
    if (!functionExists) {
      vscode.window.showErrorMessage(
        vscode.l10n.t("SQL {0} {1}/{2} not found. Please check your IBM i system.", "FUNCTION", "SYSTOOLS", "GENERATE_PDF")
      );
      return false;
    }

    // Show save dialog
    const saveLocation = await vscode.window.showSaveDialog({
      title: vscode.l10n.t("Download PDF File"),
      defaultUri: vscode.Uri.file(`${defaultFileName}.pdf`),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      filters: { 'PDF': ["pdf"] }
    });

    if (!saveLocation) {
      return false;
    }

    // Generate and download PDF with progress indicator
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: vscode.l10n.t("PDF generation")
    }, async progress => {
      const result = {
        successful: true,
        error: ''
      };

      try {
        const config = connection.getConfig();
        const tempRemotePath = config.tempDir + '/' + 
          spoolId.job.replaceAll("/", "_") + '_' + 
          spoolId.spoolname + '_' + 
          spoolId.nbr + '.pdf';

        // Generate PDF on IBM i
        progress.report({ message: vscode.l10n.t("Generating PDF...") });
        const genpdf = await connection.runSQL(`
          SELECT SYSTOOLS.GENERATE_PDF(
            JOB_NAME            => '${spoolId.job}',
            SPOOLED_FILE_NAME   => '${spoolId.spoolname}',
            SPOOLED_FILE_NUMBER => ${spoolId.nbr},
            PATH_NAME           => '${tempRemotePath}'
          ) as SENT
          FROM SYSIBM.SYSDUMMY1
        `);

        if (genpdf[0].SENT === 1) {
          try {
            // Download PDF from IBM i
            progress.report({ message: vscode.l10n.t("Downloading PDF...") });
            await connection.client.getFile(saveLocation.fsPath, tempRemotePath);
          } catch (error) {
            result.successful = false;
            result.error = String(error);
          } finally {
            // Clean up temporary file on IBM i
            await connection.runCommand({
              command: `rm -f ${tempRemotePath}`,
              environment: `pase`
            });
          }
        } else {
          result.successful = false;
          result.error = vscode.l10n.t("PDF generation failed");
        }
      } catch (error) {
        result.successful = false;
        result.error = String(error);
      }

      return result;
    });

    // Show result to user
    if (result.successful) {
      vscode.window.showInformationMessage(vscode.l10n.t("PDF successfully generated."));
      return true;
    } else {
      vscode.window.showErrorMessage(
        vscode.l10n.t("Failed to generate PDF: {0}", result.error)
      );
      return false;
    }
  };
}