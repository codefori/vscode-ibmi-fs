/**
 * Save File Management Module
 *
 * This module provides comprehensive functionality for managing IBM i Save Files (SAVF).
 * Save Files are special file objects used to store saved objects, libraries, or IFS data.
 *
 * Key Features:
 * - Download save files from IBM i to local system
 * - Upload save files from local system to IBM i
 * - Clear save file contents
 * - Save objects, libraries, or IFS data to save files
 * - Restore objects, libraries, or IFS data from save files
 * - Display save file contents (objects, members, spooled files, IFS objects)
 * - Interactive command building with validation
 * - Support for SAV, SAVLIB, and SAVOBJ operations
 *
 * @module savefile
 */

import {
  CommandResult,
  FilteredItem,
  IBMiObject,
} from "@halcyontech/vscode-ibmi-types";
import { basename } from "path";
import * as vscode from "vscode";
import {
  FastTableColumn,
  IBMI_OBJECT_NAME,
  generateDetailTable,
  generateFastTable,
  getQSYSObjectPath,
} from "../tools";
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance, getVSCodeTools } from "../ibmi";
import { Tools } from "@halcyontech/vscode-ibmi-types/api/Tools";
import path = require("path");

/**
 * Namespace containing all Save File related actions and commands
 */
export namespace SaveFileActions {
  /**
   * Registers all save file commands with the VSCode extension context
   * @param context - The VSCode extension context
   */
  export const register = (context: vscode.ExtensionContext) => {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "vscode-ibmi-fs.downloadSavf",
        downloadSavf,
      ),
      vscode.commands.registerCommand("vscode-ibmi-fs.uploadSavf", uploadSavf),
      vscode.commands.registerCommand("vscode-ibmi-fs.clearSavf", clearSavf),
      vscode.commands.registerCommand("vscode-ibmi-fs.savf", save),
      vscode.commands.registerCommand("vscode-ibmi-fs.restore", restore),
    );
  };

  /**
   * Downloads a save file from IBM i to the local file system
   * @param target - The IBM i object or SaveFile to download
   */
  export const downloadSavf = async (target: IBMiObject | SaveFile) => {
    const library = target.library.toUpperCase();
    const name = target.name.toUpperCase();
    const qsysPath = getQSYSObjectPath(library, name, "file");

    // Prompt user to select save location
    const saveLocation = await vscode.window.showSaveDialog({
      title: "Download Save File",
      defaultUri: vscode.Uri.file(`${name}.savf`),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      filters: { SaveFile: ["savf"] },
    });

    if (saveLocation) {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Downloading ${library}/${name}`,
        },
        async (progress) => {
          const result = {
            successful: true,
            error: "",
          };

          const ibmi = getInstance();
          const connection = ibmi?.getConnection();
          if (connection) {
            const config = connection.getConfig();
            const tempRemotePath = `${config.tempDir}/${library}_${name}.savf`;

            // Step 1: Copy save file to temporary stream file
            progress.report({ message: "Copying to temporary stream file..." });
            const copyToStreamFile: CommandResult = await connection.runCommand(
              {
                command: `CPYTOSTMF FROMMBR('${qsysPath}') TOSTMF('${tempRemotePath}') STMFOPT(*REPLACE)`,
                environment: `ile`,
              },
            );

            if (copyToStreamFile.code === 0) {
              try {
                // Step 2: Download the stream file to local system
                progress.report({ message: "downloading stream file..." });
                await connection.client.getFile(
                  saveLocation.fsPath,
                  tempRemotePath,
                );
              } catch (error) {
                result.successful = false;
                result.error = String(error);
              } finally {
                // Step 3: Clean up temporary file
                await connection.runCommand({
                  command: `rm -f ${tempRemotePath}`,
                  environment: `pase`,
                });
              }
            } else {
              result.successful = false;
              result.error = `CPYTOSTMF failed.\n${copyToStreamFile.stderr}`;
            }
          } else {
            result.successful = false;
            result.error = `No connection`;
          }
          return result;
        },
      );

      // Display result to user
      if (result.successful) {
        vscode.window.showInformationMessage(
          `Save File ${library}/${name} successfully downloaded.`,
        );
      } else {
        vscode.window.showErrorMessage(
          `Failed to download ${library}/${name}: ${result.error}`,
        );
      }
    }
  };

  /**
   * Uploads a local save file to IBM i
   * @param target - The target IBM i object or SaveFile
   * @returns Promise<boolean> - True if upload was successful
   */
  export const uploadSavf = async (
    target: IBMiObject | SaveFile,
  ): Promise<boolean> => {
    // Prompt user to select file(s) to upload
    const saveFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      title: "Upload Save File(s)",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      filters: { SaveFile: ["savf"], "All files": ["*"] },
    });

    if (saveFiles) {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Uploading Save File: `,
        },
        async (progress) => {
          const result = {
            successful: true,
            error: "",
          };

          const ibmi = getInstance();
          const connection = ibmi?.getConnection();

          if (connection) {
            let lclpath = saveFiles[0].path;
            let rmtpath = path.posix.join(
              connection.getConfig().tempDir,
              path.basename(lclpath),
            );

            // Step 1: Upload file to temporary location
            progress.report({ message: `Uploading Save File...` });
            await connection.getContent().uploadFiles([
              {
                local: lclpath,
                remote: rmtpath,
              },
            ]);
            progress.report({ message: `Save File uploaded...` });

            // Step 2: Copy from stream file to save file member
            progress.report({ message: `Copying Save File...` });
            const copyFromStreamFile = await connection.runCommand({
              command: `CPYFRMSTMF FROMSTMF('${rmtpath}') TOMBR('${getQSYSObjectPath(target.library, target.name, "FILE")}') MBROPT(*REPLACE)`,
            });

            if (copyFromStreamFile.code !== 0) {
              result.successful = false;
              result.error =
                "Unable to copy Save File: " + copyFromStreamFile.stderr;
            } else {
              result.successful = true;
              result.error = "";
              progress.report({ message: `Save File copied...` });
            }

            // Step 3: Clean up temporary file
            await connection.runCommand({
              command: `rm -f ${rmtpath}`,
              environment: `pase`,
            });
          } else {
            result.successful = false;
            result.error = "Unable to connect to IBM i";
          }
          return result;
        },
      );

      // Display result to user
      if (result.successful) {
        vscode.window.showInformationMessage(`Successfully uploaded Save File`);
      } else {
        vscode.window.showErrorMessage(
          `Failed to upload Save File: ${result.error}`,
        );
      }

      return result.successful;
    } else {
      return false;
    }
  };

  /**
   * Clears the contents of a save file
   * @param target - The IBM i object or SaveFile to clear
   * @returns Promise<boolean> - True if clear was successful
   */
  export const clearSavf = async (
    target: IBMiObject | SaveFile,
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const clrsavf = await connection.runCommand({
        command: `CLRSAVF FILE(${target.library}/${target.name})`,
      });

      if (clrsavf.code !== 0) {
        vscode.window.showErrorMessage(`Failed to clear Save File`);
        return false;
      } else {
        vscode.window.showInformationMessage(`Successfully cleared Save File`);
        return true;
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  };

  /**
   * Restores objects from a save file
   * @param target - The IBM i object or SaveFile to restore from
   * @param saveCmd - The save command that was used (SAV, SAVLIB, SAVOBJ)
   * @returns Promise<boolean> - True if restore was successful
   */
  export const restore = async (
    target: IBMiObject | SaveFile,
    saveCmd: String,
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Restore operation:`,
        },
        async (progress) => {
          const result = {
            successful: true,
            error: "",
          };

          let lib,
            fromlib,
            object,
            objtype,
            dbmbropt,
            path,
            objdif,
            tgtpath,
            option,
            tgtlib,
            savcmd2;
          let cmd: string | undefined;

          // Get the library name from save file info if not SAV command
          if (saveCmd !== "SAV") {
            const libResult = await connection.runSQL(
              `SELECT LIBRARY_NAME 
        FROM QSYS2.SAVE_FILE_INFO WHERE
        SAVE_FILE_LIBRARY = '${target.library}' AND SAVE_FILE = '${target.name}'
        Fetch first row only`,
            );
            fromlib = libResult[0].LIBRARY_NAME
              ? libResult[0].LIBRARY_NAME.toString()
              : "";
          }

          // Determine restore command based on save command
          if (saveCmd === "SAVLIB") {
            savcmd2 = await vscode.window.showQuickPick(["RSTLIB", "RSTOBJ"], {
              placeHolder: "Command for restore",
              title: "Command for restore",
              canPickMany: false,
            });

            savcmd2 = savcmd2 === "RSTOBJ" ? "SAVOBJ" : "SAVLIB";
          } else {
            savcmd2 = saveCmd;
          }

          // Build restore command based on save type
          switch (savcmd2) {
            case "SAV":
              // Restore IFS objects
              path = await vscode.window.showInputBox({
                placeHolder: "/xxx",
                title: `Path to restore`,
                validateInput: (path) => {
                  if (path.length < 1 && !path.startsWith("/")) {
                    return `You need to specify a valid path`;
                  }
                },
              });

              tgtpath = await vscode.window.showInputBox({
                placeHolder: "/yyy",
                title: `Path on which to restore`,
                value: "*SAME",
                validateInput: (tgtpath) => {
                  if (
                    tgtpath.length < 1 &&
                    !tgtpath.startsWith("/") &&
                    tgtpath.toUpperCase() !== "*SAME"
                  ) {
                    return `You need to specify a valid path`;
                  }
                },
              });

              objdif = await vscode.window.showQuickPick(
                ["*NONE", "*ALL", "*AUTL", "*OWNER", "*PGP"],
                {
                  placeHolder: "Allow object differences",
                  title: "Allow object differences",
                  canPickMany: true,
                },
              );

              option = await vscode.window.showQuickPick(
                ["*ALL", "*NEW", "*OLD"],
                {
                  placeHolder: "Option",
                  title: "Option",
                  canPickMany: false,
                },
              );

              if (path && tgtpath && objdif && option) {
                cmd = `RST DEV('${getQSYSObjectPath(target.library, target.name, "FILE")}') OBJ(('${path}' *INCLUDE '${tgtpath}')) OPTION(${option}) ALWOBJDIF(${objdif.toString().replace(",", " ")})`;
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;

            case "SAVLIB":
              // Restore library
              lib = await vscode.window.showInputBox({
                placeHolder: "LIBXXX",
                title: `Saved library`,
                value: fromlib,
                validateInput: (lib) => {
                  if (lib.length < 1 || lib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              tgtlib = await vscode.window.showInputBox({
                placeHolder: "LIBYYY",
                title: `Restore to library`,
                value: `*SAVLIB`,
                validateInput: (tgtlib) => {
                  if (tgtlib.length < 1 || tgtlib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              objdif = await vscode.window.showQuickPick(
                [
                  "*NONE",
                  "*ALL",
                  "*COMPATIBLE",
                  "*AUTL",
                  "*FILELVL",
                  "*OWNER",
                  "*PGP",
                ],
                {
                  placeHolder: "Allow object differences",
                  title: "Allow object differences",
                  canPickMany: true,
                },
              );

              option = await vscode.window.showQuickPick(
                ["*ALL", "*NEW", "*OLD"],
                {
                  placeHolder: "Option",
                  title: "Option",
                  canPickMany: false,
                },
              );

              dbmbropt = await vscode.window.showQuickPick(
                ["*MATCH", "*ALL", "*NEW", "*OLD"],
                {
                  placeHolder: "Data base member option",
                  title: "Data base member option",
                  canPickMany: false,
                },
              );

              if (lib && tgtlib && objdif && option && dbmbropt) {
                cmd =
                  "RSTLIB SAVLIB(" +
                  lib.toUpperCase() +
                  ") DEV(*SAVF) SAVF(" +
                  target.library +
                  "/" +
                  target.name +
                  ") " +
                  "OPTION(" +
                  option +
                  ") MBROPT(" +
                  dbmbropt +
                  ") ALWOBJDIF(" +
                  objdif.toString().replace(",", " ") +
                  ") RSTLIB(" +
                  tgtlib +
                  ")";
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;

            case "SAVOBJ":
              // Restore objects
              object = await vscode.window.showInputBox({
                placeHolder: "OBJXXX",
                title: `Objects`,
                value: "*ALL",
                validateInput: (object) => {
                  if (object.length < 1 || object.length > 10) {
                    return `You need to specify a valid object name`;
                  }
                },
              });

              objtype = await vscode.window.showInputBox({
                placeHolder: "*ALL",
                title: `Object types`,
                value: "*ALL",
                validateInput: (objtype) => {
                  if (
                    objtype.length < 1 ||
                    objtype.length > 10 ||
                    !objtype.startsWith("*")
                  ) {
                    return `You need to specify a valid object type`;
                  }
                },
              });

              lib = await vscode.window.showInputBox({
                placeHolder: "LIBXXX",
                title: `Saved library`,
                value: fromlib,
                validateInput: (lib) => {
                  if (lib.length < 1 || lib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              tgtlib = await vscode.window.showInputBox({
                placeHolder: "LIBYYY",
                title: `Restore to library`,
                value: `*SAVLIB`,
                validateInput: (tgtlib) => {
                  if (tgtlib.length < 1 || tgtlib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              objdif = await vscode.window.showQuickPick(
                [
                  "*NONE",
                  "*ALL",
                  "*COMPATIBLE",
                  "*AUTL",
                  "*FILELVL",
                  "*OWNER",
                  "*PGP",
                ],
                {
                  placeHolder: "Allow object differences",
                  title: "Allow object differences",
                  canPickMany: true,
                },
              );

              option = await vscode.window.showQuickPick(
                ["*ALL", "*NEW", "*OLD"],
                {
                  placeHolder: "Option",
                  title: "Option",
                  canPickMany: false,
                },
              );

              dbmbropt = await vscode.window.showQuickPick(
                ["*MATCH", "*ALL", "*NEW", "*OLD"],
                {
                  placeHolder: "Data base member option",
                  title: "Data base member option",
                  canPickMany: false,
                },
              );

              if (
                object &&
                objtype &&
                lib &&
                tgtlib &&
                objdif &&
                option &&
                dbmbropt
              ) {
                cmd =
                  "RSTOBJ OBJ(" +
                  object.toUpperCase() +
                  ") OBJTYPE(" +
                  objtype.toUpperCase() +
                  ") SAVLIB(" +
                  lib.toUpperCase() +
                  ") DEV(*SAVF) SAVF(" +
                  target.library +
                  "/" +
                  target.name +
                  ") " +
                  "OPTION(" +
                  option +
                  ") MBROPT(" +
                  dbmbropt +
                  ") ALWOBJDIF(" +
                  objdif.toString().replace(",", " ") +
                  ") RSTLIB(" +
                  tgtlib +
                  ")";
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;
          }

          // Allow user to confirm/modify the command
          progress.report({ message: `Wait for command confirmation...` });

          cmd = await vscode.window.showInputBox({
            value: cmd,
            placeHolder: cmd,
            title: `Confirm command`,
            validateInput: (cmd) => {
              if (cmd.length < 1) {
                return `You need to specify a valid command`;
              }
            },
          });

          // Execute the restore command
          if (!cmd || cmd.length < 1) {
            result.successful = false;
            result.error = "Command not valid";
          } else {
            progress.report({ message: `Command confirmed...` });
            const savecmd = await connection.runCommand({
              command: cmd,
            });

            if (savecmd.code !== 0) {
              result.successful = false;
              result.error = "Unable to restore: " + savecmd.stderr;
            } else {
              result.successful = true;
              result.error = "";
            }
            progress.report({ message: `Restore operation completed...` });
          }

          return result;
        },
      );

      // Display result to user
      if (result.successful) {
        vscode.window.showInformationMessage(
          `Restore operation completed successfully`,
        );
      } else {
        vscode.window.showErrorMessage(`Failed to Restore: ${result.error}`);
      }

      return result.successful;
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  };

  /**
   * Saves objects to a save file
   * @param target - The target IBM i object or SaveFile
   * @returns Promise<boolean> - True if save was successful
   */
  export const save = async (
    target: IBMiObject | SaveFile,
  ): Promise<boolean> => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Save operation:`,
        },
        async (progress) => {
          const result = {
            successful: true,
            error: "",
          };

          // Prompt user to choose save type
          const choice = await vscode.window.showQuickPick(
            ["IFS", "LIBRARY", "OBJECT"],
            {
              placeHolder: "Choose your save type",
              title: "Save",
              canPickMany: false,
            },
          );

          let lib, object, objtype, spool, tgtrls, path, compression;
          let cmd: string | undefined;

          // Build save command based on type
          switch (choice) {
            case "IFS":
              // Save IFS objects
              path = await vscode.window.showInputBox({
                placeHolder: "/xxx",
                title: `Path to save`,
                validateInput: (path) => {
                  if (path.length < 1 && !path.startsWith("/")) {
                    return `You need to specify a valid path`;
                  }
                },
              });

              tgtrls = await vscode.window.showInputBox({
                placeHolder: "VXRXMX or *CURRENT or *PRV",
                title: `Target release`,
                value: "*CURRENT",
                validateInput: (tgtrls) => {
                  if (
                    tgtrls.toUpperCase() !== "*CURRENT" &&
                    tgtrls.toUpperCase() !== "*PRV" &&
                    !/^V\dR\dM\d$/.test(tgtrls.toUpperCase())
                  ) {
                    return `You need to specify a valid target release`;
                  }
                },
              });

              compression = await vscode.window.showQuickPick(
                ["*NO", "*LOW", "*MEDIUM", "*HIGH", "*ZLIB"],
                {
                  placeHolder: "Data compression",
                  title: "Data compression",
                  canPickMany: false,
                },
              );

              if (path && tgtrls && compression) {
                cmd = `SAV DEV('${getQSYSObjectPath(target.library, target.name, "FILE")}') OBJ(('${path}')) DTACPR(${compression}) TGTRLS(${tgtrls})`;
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;

            case "LIBRARY":
              // Save library
              lib = await vscode.window.showInputBox({
                placeHolder: "LIBXXX",
                title: `Library`,
                validateInput: (lib) => {
                  if (lib.length < 1 || lib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              tgtrls = await vscode.window.showInputBox({
                placeHolder: "VXRXMX or *CURRENT or *PRV",
                title: `Target release`,
                value: "*CURRENT",
                validateInput: (tgtrls) => {
                  if (
                    tgtrls.toUpperCase() !== "*CURRENT" &&
                    tgtrls.toUpperCase() !== "*PRV" &&
                    !/^V\dR\dM\d$/.test(tgtrls.toUpperCase())
                  ) {
                    return `You need to specify a valid target release`;
                  }
                },
              });

              spool = await vscode.window.showQuickPick(["*NONE", "*ALL"], {
                placeHolder: "Spooled file data",
                title: "Spooled file data",
                canPickMany: false,
              });

              compression = await vscode.window.showQuickPick(
                ["*NO", "*LOW", "*MEDIUM", "*HIGH", "*ZLIB"],
                {
                  placeHolder: "Data compression",
                  title: "Data compression",
                  canPickMany: false,
                },
              );

              if (lib && spool && tgtrls && compression) {
                cmd =
                  "SAVLIB LIB(" +
                  lib.toUpperCase() +
                  ") DEV(*SAVF) SAVF(" +
                  target.library +
                  "/" +
                  target.name +
                  ") " +
                  "SPLFDTA(" +
                  spool +
                  ") DTACPR(" +
                  compression +
                  ") TGTRLS(" +
                  tgtrls +
                  ")";
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;

            case "OBJECT":
              // Save objects
              object = await vscode.window.showInputBox({
                placeHolder: "OBJXXX",
                title: `Objects`,
                value: "*ALL",
                validateInput: (object) => {
                  if (object.length < 1 || object.length > 10) {
                    return `You need to specify a valid object name`;
                  }
                },
              });

              objtype = await vscode.window.showInputBox({
                placeHolder: "*ALL",
                title: `Object types`,
                value: "*ALL",
                validateInput: (objtype) => {
                  if (
                    objtype.length < 1 ||
                    objtype.length > 10 ||
                    !objtype.startsWith("*")
                  ) {
                    return `You need to specify a valid object type`;
                  }
                },
              });

              lib = await vscode.window.showInputBox({
                placeHolder: "LIBXXX",
                title: `Library`,
                validateInput: (lib) => {
                  if (lib.length < 1 || lib.length > 10) {
                    return `You need to specify a valid library name`;
                  }
                },
              });

              tgtrls = await vscode.window.showInputBox({
                placeHolder: "VXRXMX or *CURRENT or *PRV",
                title: `Target release`,
                value: `*CURRENT`,
                validateInput: (tgtrls) => {
                  if (
                    tgtrls.toUpperCase() !== "*CURRENT" &&
                    tgtrls.toUpperCase() !== "*PRV" &&
                    !/^V\dR\dM\d$/.test(tgtrls.toUpperCase())
                  ) {
                    return `You need to specify a valid target release`;
                  }
                },
              });

              spool = await vscode.window.showQuickPick(["*NONE", "*ALL"], {
                placeHolder: "Spooled file data",
                title: "Spooled file data",
                canPickMany: false,
              });

              compression = await vscode.window.showQuickPick(
                ["*NO", "*LOW", "*MEDIUM", "*HIGH", "*ZLIB"],
                {
                  placeHolder: "Data compression",
                  title: "Data compression",
                  canPickMany: false,
                },
              );

              if (object && objtype && lib && spool && tgtrls && compression) {
                cmd =
                  "SAVOBJ OBJ(" +
                  object.toUpperCase() +
                  ") OBJTYPE(" +
                  objtype.toUpperCase() +
                  ") LIB(" +
                  lib.toUpperCase() +
                  ") DEV(*SAVF) SAVF(" +
                  target.library +
                  "/" +
                  target.name +
                  ") " +
                  "SPLFDTA(" +
                  spool +
                  ") DTACPR(" +
                  compression +
                  ") TGTRLS(" +
                  tgtrls +
                  ")";
              } else {
                result.successful = false;
                result.error = "Some parameters are missing... ";
                return result;
              }

              break;
          }

          // Allow user to confirm/modify the command
          progress.report({ message: `Wait for command confirmation...` });

          cmd = await vscode.window.showInputBox({
            value: cmd,
            placeHolder: cmd,
            title: `Confirm command`,
            validateInput: (cmd) => {
              if (cmd.length < 1) {
                return `You need to specify a valid command`;
              }
            },
          });

          // Execute the save command
          if (!cmd || cmd.length < 1) {
            result.successful = false;
            result.error = "Command not valid";
          } else {
            progress.report({ message: `Command confirmed...` });
            const savecmd = await connection.runCommand({
              command: cmd,
            });

            if (savecmd.code !== 0) {
              result.successful = false;
              result.error = "Unable to save: " + savecmd.stderr;
            } else {
              result.successful = true;
              result.error = "";
            }
            progress.report({ message: `Save operation completed...` });
          }

          return result;
        },
      );

      // Display result to user
      if (result.successful) {
        vscode.window.showInformationMessage(
          `Save operation completed successfully`,
        );
      } else {
        vscode.window.showErrorMessage(`Failed to save: ${result.error}`);
      }

      return result.successful;
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  };
}

// Size constants for file size calculations
const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const GIGABYTE = MEGABYTE * KILOBYTE;

// Action constants for UI interactions
const ACTION_DOWNLOAD = "download";
const ACTION_CLEAR = "clear";
const ACTION_UPLOAD = "upload";
const ACTION_SAVE = "save";
const ACTION_RESTORE = "restore";

// Regular expression for parsing save file header information
const HEADER_REGEX = /^\s+([^\.]+)[\. ]*: +(?!\s*\/)(.*)$/;

/**
 * Interface representing a header entry in the save file display
 */
interface Header {
  label: string;
  value: string;
}

/**
 * Interface representing an object stored in the save file
 */
interface Object {
  name: string;
  type: string;
  attribute: string;
  text: string;
  savets: string;
  size: number;
  data: string;
  owner: string;
  iasp: string;
}

/**
 * Interface representing a file member in the save file
 */
interface FileMember {
  name: string;
  text: string;
  member: string;
}

/**
 * Interface representing a spooled file in the save file
 */
interface SpooledFile {
  name: string;
  text: string;
  spoolname: string;
  spoolnumber: number;
  job: string;
  system: string;
  creation: string;
}

/**
 * Interface representing an IFS object in the save file
 */
interface IFSObject {
  name: string;
  type: string;
  owner: string;
  size: number;
  data: string;
  allowCheckpoint: string;
  text: string;
}

/**
 * Interface representing an IFS directory with its objects
 */
interface IFSDirectory {
  path: string;
  objects: IFSObject[];
}

/**
 * SaveFile class - Main class for managing and displaying save file information
 * Extends the Base class to provide save file specific functionality
 */
export class SaveFile extends Base {
  private savf: any;
  private readonly qsysPath: string = getQSYSObjectPath(
    this.library,
    this.name,
    "FILE",
  );
  private size: string = "";

  private readonly headers: Header[] = [];
  private readonly objects: Object[] = [];
  private readonly members: FileMember[] = [];
  private readonly spooledFiles: SpooledFile[] = [];
  private readonly ifsDirectories: IFSDirectory[] = [];

  /**
   * Fetches save file information from IBM i
   * Retrieves metadata, objects, members, and spooled files
   */
  async fetch() {
    this.headers.length = 0;
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    let isIfs: boolean = false;

    if (connection) {
      // Get save file information from system catalog
      this.savf = await connection.runSQL(
        `SELECT SAVE_FILE_LIBRARY, 
        SAVE_FILE, 
        SAVE_COMMAND 
        FROM QSYS2.SAVE_FILE_INFO WHERE
        SAVE_FILE_LIBRARY = '${this.library}' AND SAVE_FILE = '${this.name}'
        Fetch first row only`,
      );

      isIfs = this.savf[0].SAVE_COMMAND === "SAV";

      // Display save file contents
      const savf: CommandResult = await connection.runCommand({
        command: `DSPSAVF FILE(${this.library}/${this.name})`,
        environment: `ile`,
      });

      if (savf.code === 0 && savf.stdout) {
        await this.parseOutput(savf.stdout, isIfs);
        // Remove first two entries (library and name) as they're redundant
        this.headers.shift();
        this.headers.shift();
      }

      // Get save file size
      const stat: CommandResult = await connection.runCommand({
        command: `ls -l ${this.qsysPath} | awk '{print $5}'`,
        environment: `pase`,
      });

      if (stat.code === 0 && stat.stdout) {
        const size = Number(stat.stdout);
        if (!isNaN(size)) {
          this.headers.unshift({
            label: "Size",
            value: `${size.toLocaleString()} bytes`,
          });
          // Format size in appropriate units
          if (size / GIGABYTE > 1) {
            this.size = `${(size / GIGABYTE).toFixed(3)} Gb`;
          } else if (size / MEGABYTE > 1) {
            this.size = `${(size / MEGABYTE).toFixed(3)} Mb`;
          } else if (size / KILOBYTE > 1) {
            this.size = `${(size / KILOBYTE).toFixed(3)} Kb`;
          } else {
            this.size = `${size} b`;
          }
        }
      }
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
    }
  }

  /**
   * Parses the output from DSPSAVF command
   * @param output - The command output to parse
   * @param isIfs - Whether this is an IFS save file
   */
  private async parseOutput(output: string, isIfs: boolean) {
    // Extract header information using regex
    output.split(/[\r\n]/g).forEach((line) => {
      const header = HEADER_REGEX.exec(line);
      if (header) {
        this.headers.push({
          label: header[1],
          value: header[2],
        });
      }
    });

    // Parse objects based on save type
    if (isIfs) {
      this.parseIFSObjects(output);
    } else {
      await this.fetchSavfLib();
    }
  }

  /**
   * Fetches library objects, members, and spooled files from the save file
   * Uses QSYS2.SAVE_FILE_OBJECTS table function
   */
  private async fetchSavfLib() {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();

    if (connection) {
      // Fetch all objects
      this.objects.length = 0;
      const objectsRows = await connection.runSQL(`
          SELECT OBJECT_NAME,
        OBJECT_TYPE,
        OBJECT_ATTRIBUTE,
        TEXT_DESCRIPTION,
        to_char(SAVE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS SAVE_TIMESTAMP,
        OBJECT_SIZE,
        DATA_SAVED,
        OBJECT_OWNER,
        IASP_NAME
        FROM TABLE (
            QSYS2.SAVE_FILE_OBJECTS(
        SAVE_FILE => '${this.name}', SAVE_FILE_LIBRARY => '${this.library}', OBJECT_TYPE_FILTER => '*ALL', DETAILED_INFO => 'NONE')
        )`);
      this.objects.push(...objectsRows.map(this.toEntryObject));

      // Fetch file members
      this.members.length = 0;
      const memberRows = await connection.runSQL(`
          SELECT OBJECT_NAME,
        TEXT_DESCRIPTION,
        MEMBER_NAME
        FROM TABLE (
            QSYS2.SAVE_FILE_OBJECTS(
        SAVE_FILE => '${this.name}', SAVE_FILE_LIBRARY => '${this.library}', OBJECT_TYPE_FILTER => '*FILE', DETAILED_INFO => 'FILE')
        )`);
      this.members.push(...memberRows.map(this.toEntryMember));

      // Fetch spooled files
      this.spooledFiles.length = 0;
      const spoolRows = await connection.runSQL(`
          SELECT OBJECT_NAME,
        TEXT_DESCRIPTION,
        SPOOLED_FILE_NAME,
        SPOOLED_FILE_NUMBER,
        QUALIFIED_JOB_NAME,
        JOB_NAME,
        JOB_USER,
        JOB_NUMBER,
        SYSTEM_NAME,
        to_char(CREATE_TIMESTAMP, 'yyyy-mm-dd HH24:mi') AS CREATE_TIMESTAMP
        FROM TABLE (
            QSYS2.SAVE_FILE_OBJECTS(
        SAVE_FILE => '${this.name}', SAVE_FILE_LIBRARY => '${this.library}', OBJECT_TYPE_FILTER => '*OUTQ', DETAILED_INFO => 'OUTQ')
        )
        WHERE SPOOLED_FILE_NAME IS NOT NULL`);
      this.spooledFiles.push(...spoolRows.map(this.toEntrySpool));
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return false;
    }
  }

  /**
   * Converts a database row to an Object interface
   * @param row - The database row to convert
   * @returns Object interface
   */
  private toEntryObject(row: Tools.DB2Row): Object {
    return {
      name: String(row.OBJECT_NAME),
      type: String(row.OBJECT_TYPE),
      attribute: String(row.OBJECT_ATTRIBUTE),
      text: String(row.TEXT_DESCRIPTION),
      savets: String(row.SAVE_TIMESTAMP),
      size: Number(row.OBJECT_SIZE),
      data: String(row.DATA_SAVED),
      owner: String(row.OBJECT_OWNER),
      iasp: String(row.IASP_NAME),
    };
  }

  /**
   * Converts a database row to a FileMember interface
   * @param row - The database row to convert
   * @returns FileMember interface
   */
  private toEntryMember(row: Tools.DB2Row): FileMember {
    return {
      name: String(row.OBJECT_NAME),
      text: String(row.TEXT_DESCRIPTION),
      member: String(row.MEMBER_NAME),
    };
  }

  /**
   * Converts a database row to a SpooledFile interface
   * @param row - The database row to convert
   * @returns SpooledFile interface
   */
  private toEntrySpool(row: Tools.DB2Row): SpooledFile {
    return {
      name: String(row.OBJECT_NAME),
      text: String(row.TEXT_DESCRIPTION),
      spoolname: String(row.SPOOLED_FILE_NAME),
      spoolnumber: Number(row.SPOOLED_FILE_NUMBER),
      job: String(row.QUALIFIED_JOB_NAME),
      system: String(row.SYSTEM_NAME),
      creation: String(row.CREATE_TIMESTAMP),
    };
  }

  /**
   * Parses IFS objects from DSPSAVF output
   * @param output - The command output containing IFS object information
   */
  private parseIFSObjects(output: string): void {
    const lines = output.split(/[\r\n]/g);
    let currentDirectory: IFSDirectory | null = null;

    const directoryRegex = /^\s+([^\.]+)[\. ]*:\s+(\/\S+.*)$/;
    const objectRegex =
      /^\s+(.+?)\s+(\*\w+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s*(.*)$/;

    for (const line of lines) {
      // Check for directory header
      const dirMatch = directoryRegex.exec(line);
      if (dirMatch) {
        if (currentDirectory) {
          this.ifsDirectories.push(currentDirectory);
        }
        currentDirectory = {
          path: dirMatch[2].trim(),
          objects: [],
        };
        continue;
      }

      // Check for object entry
      const objMatch = objectRegex.exec(line);
      if (objMatch && currentDirectory) {
        currentDirectory.objects.push({
          name: objMatch[1].trim(),
          type: objMatch[2],
          owner: objMatch[3],
          size: parseInt(objMatch[4]),
          data: objMatch[5],
          allowCheckpoint: objMatch[6],
          text: objMatch[7] || "",
        });
      }
    }

    // Add the last directory
    if (currentDirectory) {
      this.ifsDirectories.push(currentDirectory);
    }
  }

  /**
   * Renders the save file panel with header information and action buttons
   * @param size - The formatted size string
   * @param headers - Array of header entries to display
   * @returns HTML string for the panel
   */
  private renderSavfPanel(size: string, headers: Header[]): string {
    let columns: Map<string, string> = new Map();
    let tmpdata: Record<string, string> = {};

    // Build columns and data from headers
    headers.forEach((x) => {
      columns.set(x.label, x.label);
      tmpdata[x.label] = x.value;
    });

    let data = [];
    data.push(tmpdata);

    let actions = [];

    // Add appropriate action buttons based on save file state
    if (this.savf[0].SAVE_COMMAND) {
      // Save file contains data - show download, restore, and clear options
      actions.push(
        {
          label: "Download (" + this.size + ") ⬇️",
          action: ACTION_DOWNLOAD,
          appearance: "primary",
          style: "width: 100%; text-align: center;",
        },
        {
          label: "Perform restore ↪️",
          action: ACTION_RESTORE,
          appearance: "primary",
          style: "width: 100%; text-align: center;",
        },
        {
          label: "Clear 🧹",
          action: ACTION_CLEAR,
          appearance: "secondary",
          style: "width: 100%; text-align: center;",
        },
      );
    } else {
      // Save file is empty - show upload and save options
      actions.push({
        label: "Upload ⬆️",
        action: ACTION_UPLOAD,
        appearance: "primary",
        style: "width: 100%; text-align: center;",
      });

      actions.push({
        label: "Perform Save 💾",
        action: ACTION_SAVE,
        appearance: "primary",
        style: "width: 100%; text-align: center;",
      });
    }

    return generateDetailTable({
      title: `Save File: ${this.library}/${this.name}`,
      subtitle: "Save File Information",
      columns: columns,
      data: data,
      actions: actions,
    });
  }

  /**
   * Generates the complete HTML for the save file view
   * @returns HTML string containing all panels
   */
  generateHTML(): string {
    const panels: Components.Panel[] = [
      {
        title: "Detail",
        content: this.renderSavfPanel(this.size, this.headers),
      },
    ];

    // Add IFS objects panel if present
    if (this.ifsDirectories.length) {
      const totalIFSObjects = this.ifsDirectories.reduce(
        (sum, dir) => sum + dir.objects.length,
        0,
      );
      panels.push({
        title: "IFS Objects",
        badge: totalIFSObjects,
        content: renderIFSDirectories(this.ifsDirectories),
      });
    }

    // Add objects panel if present
    if (this.objects.length) {
      panels.push({
        title: "Objects",
        badge: this.objects.length,
        content: renderObjects(this.objects),
      });
    }

    // Add members panel if present
    if (this.members.length) {
      panels.push({
        title: "Members",
        badge: this.members.length,
        content: renderMembers(this.members),
      });
    }

    // Add spooled files panel if present
    if (this.spooledFiles.length) {
      panels.push({
        title: "Spooled files",
        badge: this.spooledFiles.length,
        content: renderSpooledFiles(this.spooledFiles),
      });
    }

    return Components.panels(panels);
  }

  /**
   * Handles user actions from the UI
   * @param data - Action data containing the action type
   * @returns Promise with rerender flag
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    const uri = vscode.Uri.parse(data.href);
    let refetch = false;

    // Execute appropriate action based on user selection
    switch (uri.path) {
      case ACTION_DOWNLOAD:
        SaveFileActions.downloadSavf(this);
        break;
      case ACTION_RESTORE:
        SaveFileActions.restore(this, this.savf[0].SAVE_COMMAND);
        break;
      case ACTION_UPLOAD:
        if (await SaveFileActions.uploadSavf(this)) {
          refetch = true;
        }
        break;
      case ACTION_CLEAR:
        if (await SaveFileActions.clearSavf(this)) {
          refetch = true;
        }
        break;
      case ACTION_SAVE:
        if (await SaveFileActions.save(this)) {
          refetch = true;
        }
        break;
    }

    // Refetch data if needed
    if (refetch) {
      await this.fetch();
    }
    return { rerender: refetch };
  }

  /**
   * Placeholder save method (required by base class)
   */
  async save(): Promise<void> { }
}

/**
 * Renders a table of objects from the save file
 * @param entries - Array of Object entries to display
 * @returns HTML string for the objects table
 */
function renderObjects(entries: Object[]) {
  // Define table columns with their properties
  const columns: FastTableColumn<Object>[] = [
    { title: "Name", width: "1fr", getValue: (e) => e.name },
    { title: "Type", width: "0.5fr", getValue: (e) => e.type },
    { title: "Attribute", width: "0.5fr", getValue: (e) => e.attribute },
    { title: "Description", width: "2.5fr", getValue: (e) => e.text },
    { title: "Save date", width: "1fr", getValue: (e) => e.savets },
    { title: "Size", width: "1fr", getValue: (e) => e.size },
    { title: "With Data?", width: "0.5fr", getValue: (e) => e.data },
    { title: "Owner", width: "0.7fr", getValue: (e) => e.owner },
    { title: "iASP", width: "0.7fr", getValue: (e) => e.iasp },
  ];

  // Custom CSS styles for the objects table
  const customStyles = `
      /* Highlight object names with link color for better visibility */
      .savf-object-table vscode-data-grid-cell[grid-column="1"] {
      color: var(--vscode-textLink-foreground);
      }
  `;

  // Generate and return the complete table HTML
  return (
    `<div class="savf-object-table">` +
    generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: entries,
      stickyHeader: true,
      emptyMessage: "No objects found in this savf.",
      customStyles: customStyles,
      customScript: "",
    }) +
    `</div>`
  );
}

/**
 * Renders a table of file members from the save file
 * @param entries - Array of FileMember entries to display
 * @returns HTML string for the members table
 */
function renderMembers(entries: FileMember[]) {
  // Define table columns with their properties
  const columns: FastTableColumn<FileMember>[] = [
    { title: "File Name", width: "1fr", getValue: (e) => e.name },
    { title: "File Description", width: "3fr", getValue: (e) => e.text },
    { title: "Member name", width: "1fr", getValue: (e) => e.member },
  ];

  // Generate and return the complete table HTML
  return (
    `<div>` +
    generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: entries,
      stickyHeader: true,
      emptyMessage: "No objects found in this savf.",
      customStyles: "",
      customScript: "",
    }) +
    `</div>`
  );
}

/**
 * Renders a table of spooled files from the save file
 * @param entries - Array of SpooledFile entries to display
 * @returns HTML string for the spooled files table
 */
function renderSpooledFiles(entries: SpooledFile[]) {
  // Define table columns with their properties
  const columns: FastTableColumn<SpooledFile>[] = [
    { title: "Outq Name", width: "1fr", getValue: (e) => e.name },
    { title: "Outq Description", width: "3fr", getValue: (e) => e.text },
    { title: "Spool name", width: "1fr", getValue: (e) => e.spoolname },
    { title: "Spool number", width: "0.8fr", getValue: (e) => e.spoolnumber },
    { title: "Job", width: "2fr", getValue: (e) => e.job },
    { title: "System", width: "1fr", getValue: (e) => e.system },
    { title: "Creation", width: "1fr", getValue: (e) => e.creation },
  ];

  // Generate and return the complete table HTML
  return (
    `<div>` +
    generateFastTable({
      title: ``,
      subtitle: ``,
      columns: columns,
      data: entries,
      stickyHeader: true,
      emptyMessage: "No objects found in this savf.",
      customStyles: "",
      customScript: "",
    }) +
    `</div>`
  );
}

/**
 * Renders IFS directories and their objects
 * @param directories - Array of IFSDirectory entries to display
 * @returns HTML string for the IFS directories display
 */
function renderIFSDirectories(directories: IFSDirectory[]): string {
  let html = "";

  // Render each directory with its objects
  directories.forEach((dir) => {
    html += `<h3 style="margin-top: 20px; color: var(--vscode-editor-foreground);">${dir.path}</h3>`;
    html += Components.dataGrid<IFSObject>(
      {
        stickyHeader: false,
        columns: [
          { title: "Name", cellValue: (obj) => obj.name, size: "2fr" },
          { title: "Type", cellValue: (obj) => obj.type, size: "1fr" },
          { title: "Owner", cellValue: (obj) => obj.owner, size: "1fr" },
          {
            title: "Size",
            cellValue: (obj) => `${(obj.size / 1024).toFixed(2)} KB`,
            size: "1fr",
          },
          { title: "Data", cellValue: (obj) => obj.data, size: "0.5fr" },
          {
            title: "Checkpoint",
            cellValue: (obj) => obj.allowCheckpoint,
            size: "0.5fr",
          },
        ],
      },
      dir.objects,
    );
  });

  return html;
}
