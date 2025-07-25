import * as vscode from 'vscode';
import * as fs from 'fs/promises'; // For async file operations
import * as path from 'path';

export class TempFileManager {
    private tempFiles: Set<string>; // Stores absolute paths of temp files

    constructor() {
        this.tempFiles = new Set<string>();
    }

    /**
     * Registers a new temporary file to be tracked.
     * @param filePath The absolute path of the temporary file.
     */
    public registerTempFile(filePath: string): void {
        this.tempFiles.add(filePath);
    }

    /**
     * Cleans up all registered temporary files.
     * Should be called during extension deactivation.
     */
    public async cleanUpTempFiles(): Promise<void> {
        for (const filePath of this.tempFiles) {
            try {
                await fs.unlink(filePath); // Delete the file
                console.log(`Deleted temporary file: ${filePath}`);
            } catch (error: any) {
                // Log the error but continue with other files
                console.error(`Failed to delete temporary file ${filePath}: ${error.message}`);
            }
        }
        this.tempFiles.clear(); // Clear the set after cleanup
    }
}