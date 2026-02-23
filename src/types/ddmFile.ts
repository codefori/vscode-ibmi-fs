/**
 * DDM File Management Module
 *
 * This module provides functionality for viewing and managing IBM i Distributed Data Management (DDM) Files.
 * DDM files are special file objects that provide access to files on remote systems.
 *
 * Key Features:
 * - Display DDM file configuration and attributes
 * - View remote location information (system name/address, port)
 * - View access method and file attributes
 * - View remote file name and library
 * - Support for multi-line field values
 *
 * @module ddmfile
 */

import {
  CommandResult
} from "@halcyontech/vscode-ibmi-types";
import * as vscode from "vscode";
import {
  generateDetailTable,
  getQSYSObjectPath,
} from "../tools";
import Base from "./base";
import { getInstance } from "../ibmi";
import path = require("path");

/**
 * Regular expression for parsing DDM file header information from DSPDDMF output
 * Matches lines that have a space or dot immediately before the colon
 * This filters out section headers and captures only actual field entries
 */
const HEADER_REGEX = /^\s+(.+[\s\.]):(.*)$/;

/**
 * Interface representing a header entry in the DDM file display
 */
interface Header {
  label: string;
  value: string;
}

/**
 * DdmFile class - Main class for managing and displaying DDM file information
 * Extends the Base class to provide DDM file specific functionality
 */
export class DdmFile extends Base {

  private readonly headers: Header[] = [];

  /**
   * Fetches DDM file information from IBM i
   * Executes DSPDDMF command and parses the output
   */
  async fetch() {
    this.headers.length = 0;
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Display DDM file configuration
      const ddmf: CommandResult = await connection.runCommand({
        command: `DSPDDMF FILE(${this.library}/${this.name})`,
        environment: `ile`,
      });

      if (ddmf.code === 0 && ddmf.stdout) {
        await this.parseOutput(ddmf.stdout);
        // Remove first two entries (library and name) as they're redundant
        this.headers.shift();
        this.headers.shift();
      } else {
        vscode.window.showErrorMessage(vscode.l10n.t("Unable to display DDM file:\n{0}", ddmf.stderr));
      }
    } else {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }
  }

  /**
   * Parses the output from DSPDDMF command
   * Handles multi-line values and fields with multiple colons
   * @param output - The command output to parse
   */
  private async parseOutput(output: string) {
    // Extract header information using regex
    const lines = output.split(/[\r\n]/g);
    let currentHeader: Header | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const header = HEADER_REGEX.exec(line);
      
      if (header) {
        // Save previous header if exists
        if (currentHeader) {
          this.headers.push(currentHeader);
        }
        
        // Process label and value
        let label = header[1].trim();
        let value = header[2].trim();
        
        // If value contains a second colon, it's a field with two colons
        // Take only the text after the second colon
        const secondColonIndex = value.indexOf(':');
        if (secondColonIndex !== -1) {
          value = value.substring(secondColonIndex + 1).trim();
        }
        
        // Remove trailing dots and spaces from label
        label = label.replace(/[\s\.]+$/, '');
        
        currentHeader = {
          label: label,
          value: value,
        };
      } else if (currentHeader && line.trim() && !line.includes('* * * *')) {
        // Continuation line: must start with many spaces (at least 35 characters)
        // to distinguish it from a new header line
        const leadingSpaces = line.search(/\S/);
        
        if (leadingSpaces >= 35) {
          // It's a real continuation line
          const continuationValue = line.trim().replace(/^'|'$/g, '');
          if (continuationValue) {
            // Remove quotes from current value if present
            currentHeader.value = currentHeader.value.replace(/^'|'$/g, '');
            // Concatenate values
            currentHeader.value = currentHeader.value + continuationValue;
          }
        }
        // Otherwise ignore the line (could be a section or other content)
      }
    }
    
    // Add the last header if present
    if (currentHeader) {
      this.headers.push(currentHeader);
    }
  }

  /**
   * Renders the DDM file information panel
   * @param headers - Array of header entries to display
   * @returns HTML string for the panel
   */
  private renderDdmfPanel(headers: Header[]): string {
    let columns: Map<string, string> = new Map();
    let tmpdata: Record<string, string> = {};

    // Build columns and data from headers
    headers.forEach((x) => {
      columns.set(x.label, x.label);
      tmpdata[x.label] = x.value;
    });

    let data = [];
    data.push(tmpdata);

    return generateDetailTable({
      title: vscode.l10n.t("DDM File: {0}/{1}", this.library, this.name),
      subtitle: vscode.l10n.t("DDM File Information"),
      columns: columns,
      data: data
    });
  }

  /**
   * Generates the complete HTML for the DDM file view
   * @returns HTML string containing the information panel
   */
  generateHTML(): string {
    return this.renderDdmfPanel(this.headers);
  }

  /**
   * Handles user actions from the UI
   * Currently no actions are defined for DDM files
   * @param data - Action data containing the action type
   * @returns Promise with rerender flag
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    return {};
  }

  /**
   * Placeholder save method (required by base class)
   * DDM files are read-only in this implementation
   */
  async save(): Promise<void> { }
}