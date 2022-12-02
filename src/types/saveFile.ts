import { basename, extname } from 'path';
import * as vscode from 'vscode';
import { Filter, IBMiObject } from '../import/code-for-ibmi';
import { getBase, getQSYSObjectPath, IBMI_OBJECT_NAME, makeid } from '../tools';
import { Components } from '../webviewToolkit';
import Base from "./base";

export namespace SaveFileActions {
    export const register = (context: vscode.ExtensionContext) => {
        context.subscriptions.push(
            vscode.commands.registerCommand("vscode-ibmi-fs.downloadSavf", downloadSavf),
            vscode.commands.registerCommand("vscode-ibmi-fs.uploadSavf", uploadSavf)
        );
    };

    export const downloadSavf = async (target: IBMiObject | SaveFile) => {
        const library = target.library.toUpperCase();
        const name = target.name.toUpperCase();
        const qsysPath = getQSYSObjectPath(library, name, 'file');

        const saveLocation = await vscode.window.showSaveDialog({
            title: "Download Save File",
            defaultUri: vscode.Uri.file(`${name}.savf`),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            filters: { 'SaveFile': ["savf"] }
        });

        if (saveLocation) {
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Downloading ${library}/${name}`
            }, async progress => {
                const result = {
                    successful: true,
                    error: ''
                };

                const connection = getBase().getConnection();
                if (connection) {
                    const tempRemotePath = `${getBase().getConfig().tempDir}/${library}_${name}.savf`;

                    progress.report({ message: 'Copying to temporary stream file...' });
                    const copyToStreamFile: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
                        command: `CPYTOSTMF FROMMBR('${qsysPath}') TOSTMF('${tempRemotePath}') STMFOPT(*REPLACE)`,
                        environment: `ile`
                    });

                    if (copyToStreamFile.code === 0) {
                        try {
                            progress.report({ message: 'downloading stream file...' });
                            await connection.client.getFile(saveLocation.fsPath, tempRemotePath);
                        } catch (error) {
                            result.successful = false;
                            result.error = String(error);
                        }
                        finally {
                            await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
                                command: `rm -f ${tempRemotePath}`,
                                environment: `pase`
                            });
                        }
                    }
                    else {
                        result.successful = false;
                        result.error = `CPYTOSTMF failed.\n${copyToStreamFile.stderr}`;
                    }
                }
                else {
                    result.successful = false;
                    result.error = `No connection`;
                }
                return result;
            });

            if (result.successful) {
                vscode.window.showInformationMessage(`Save File ${library}/${name} successfully downloaded.`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to download ${library}/${name}: ${result.error}`);
            }
        }
    };

    export const uploadSavf = async (filter: Filter) => {
        const saveFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            title: "Upload Save File(s)",
            // eslint-disable-next-line @typescript-eslint/naming-convention
            filters: { 'SaveFile': ["savf"], 'All files': ["*"] }
        });

        if (saveFiles) {
            let uploaded = 0;
            const result = await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Uploading Save file`
            }, async progress => {
                const result = {
                    successful: true,
                    error: ''
                };

                const increment = (100 / saveFiles.length) / 2;
                for await (const saveFile of saveFiles) {
                    if (result.successful) {
                        const localPath = saveFile.fsPath;
                        const fileName = basename(localPath);
                        let name = fileName.substring(0, fileName.indexOf('.')).toUpperCase();
                        progress.report({ message: fileName });
                        while (name && !IBMI_OBJECT_NAME.test(name)) {
                            name = (await vscode.window.showInputBox({
                                ignoreFocusOut: true,
                                value: name,
                                title: `Save file ${name} object name`,
                                prompt: 'Enter a valid IBM i object name',
                                placeHolder: 'Leave blank to skip upload',
                                validateInput: input => {
                                    if (name && !IBMI_OBJECT_NAME.test(input)) {
                                        return 'invalid name';
                                    }
                                }
                            }) || '').toUpperCase();
                        }
                        if (name) {
                            const remotePath = `${getBase().getConfig().tempDir}/${name}_${makeid()}.savf`;
                            try {
                                progress.report({ message: `uploading ${fileName} to IFS` });
                                await getBase().getConnection().client.putFile(localPath, remotePath);

                                progress.report({ message: `restoring ${fileName} as SAVF`, increment });

                                const copyFromStreamFile: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
                                    command: `CPYFRMSTMF FROMSTMF('${remotePath}') TOMBR('${getQSYSObjectPath(filter.library, name, 'FILE')}') MBROPT(*REPLACE)`,
                                    environment: `ile`
                                });
                                if (copyFromStreamFile.code !== 0) {
                                    result.successful = false;
                                    result.error = copyFromStreamFile.stderr;
                                }
                                else{
                                    uploaded++;
                                }
                                progress.report({ increment });
                            }
                            finally {
                                await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
                                    command: `rm -f ${remotePath}`,
                                    environment: `pase`
                                });
                            }
                        }
                        else{
                            //Skipped
                            progress.report({ increment: increment * 2 });
                        }
                    }
                }

                return result;
            });

            if (result.successful) {
                vscode.window.showInformationMessage(`Successfully uploaded ${uploaded}/${saveFiles.length} Save file${saveFiles.length > 1 ? 's' : ''} to ${filter.library}.`);
            }
            else {
                vscode.window.showErrorMessage(`Failed to upload Save file${saveFiles.length > 1 ? 's' : ''}: ${result.error}`);
            }
        }
    };
}

const KILOBYTE = 1024;
const MEGABYTE = KILOBYTE * KILOBYTE;
const GIGABYTE = MEGABYTE * KILOBYTE;

const ACTION_DOWNLOAD = 'download';

const HEADER_REGEX = /^\s+([^\.]+)[\. ]*: +(.*)$/;
const OBJECT_REGEX = /^\s*([^ ]+)\s+(\*[^ ]+)\s+([^ ]+)?\s+([^ ]+)\s+(\d+)\s+([^ ]+)(?:\s+(.*))?$/;
const MEMBERS_REGEX = /^\s*([^ ]+)\s+([^ ]+)\s+(\d+)\s+([^:/]+)$/;
const SPOOLED_REGEX = /^\s*([^ ]+)\s+(\d+)\s+([^ ]+)\s+([^ ]+)\s+(\d+)\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+([^ ]+)\s+(\d+)$/;

interface Header {
    label: string
    value: string
}

interface Object {
    name: string
    type: string
    attribute: string
    owner: string
    size: number
    data: string
    text: string
}

interface FileMember {
    name: string
    type: string
    members: string[]
}

interface SpooledFile {
    name: string
    number: number
    jobName: string
    jobUser: string
    jobNumber: number
    system: string
    creation: string
    outputQueue: string
    library: string
    asp: number
}

export class SaveFile extends Base {
    private readonly qsysPath: string = getQSYSObjectPath(this.library, this.name, 'FILE');
    private size: string = '';

    private readonly headers: Header[] = [];
    private readonly objects: Object[] = [];
    private readonly members: FileMember[] = [];
    private readonly spooledFiles: SpooledFile[] = [];

    async fetch() {
        const savf: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: `DSPSAVF FILE(${this.library}/${this.name})`,
            environment: `ile`
        });

        if (savf.code === 0 && savf.stdout) {
            this.parseOutput(savf.stdout);
            //First two entries are library and name
            this.headers.shift();
            this.headers.shift();
        }

        const stat: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: `ls -l ${this.qsysPath} | awk '{print $5}'`,
            environment: `pase`
        });

        if (stat.code === 0 && stat.stdout) {
            const size = Number(stat.stdout);
            if (!isNaN(size)) {
                this.headers.unshift({ label: "Size", value: `${size.toLocaleString()} bytes` });
                if (size / GIGABYTE > 1) {
                    this.size = `${(size / GIGABYTE).toFixed(3)} Gb`;
                }
                else if (size / MEGABYTE > 1) {
                    this.size = `${(size / MEGABYTE).toFixed(3)} Mb`;
                }
                else if (size / KILOBYTE > 1) {
                    this.size = `${(size / KILOBYTE).toFixed(3)} Kb`;
                }
                else {
                    this.size = `${size} b`;
                }
            }
        }
    }

    generateHTML(): string {
        const panels: Components.Panel[] = [
            { title: "Header", content: renderHeaders(this.size, this.headers) },
            { title: "Objects", badge: this.objects.length, content: renderObjects(this.objects) }
        ];

        if (this.members.length) {
            panels.push({ title: "Members", badge: this.members.reduce((total, m) => total += m.members.length, 0), content: renderMembers(this.members) });
        }

        if (this.spooledFiles.length) {
            panels.push({ title: "Spooled files", badge: this.spooledFiles.length, content: renderSpooledFiles(this.spooledFiles) });
        }

        return Components.panels(panels, { style: "height:100vh" });
    }

    async handleAction(data: any): Promise<HandleActionResult> {
        const uri = vscode.Uri.parse(data.href);
        switch (uri.path) {
            case ACTION_DOWNLOAD:
                SaveFileActions.downloadSavf(this);
                break;
        }
        return {};
    }

    async save(): Promise<void> {
        //Nothing to save
    }

    parseOutput(output: string) {
        this.headers.length = 0;
        this.objects.length = 0;
        this.members.length = 0;
        this.spooledFiles.length = 0;

        let currentMember: FileMember | undefined;
        let remaining = 0;
        output.split(/[\r\n]/g).forEach(line => {
            const header = HEADER_REGEX.exec(line);
            const object = OBJECT_REGEX.exec(line);
            const members = MEMBERS_REGEX.exec(line);
            const spooledFile = SPOOLED_REGEX.exec(line);

            if (header) {
                this.headers.push({
                    label: header[1],
                    value: header[2]
                });
            }
            else if (object) {
                this.objects.push({
                    name: object[1],
                    type: object[2],
                    attribute: object[3] || '',
                    owner: object[4],
                    size: Number(object[5]),
                    data: object[6],
                    text: object[7] || ''
                });
            }
            else if (spooledFile) {
                this.spooledFiles.push({
                    name: spooledFile[1],
                    number: Number(spooledFile[2]),
                    jobName: spooledFile[3],
                    jobUser: spooledFile[4],
                    jobNumber: Number(spooledFile[5]),
                    system: spooledFile[6],
                    creation: `${spooledFile[7]} ${spooledFile[8]}`,
                    outputQueue: spooledFile[9],
                    library: spooledFile[10],
                    asp: Number(spooledFile[11])
                });
            }
            else if (members) {
                remaining = Number(members[3]);
                currentMember = {
                    name: members[1],
                    type: members[2],
                    members: members[4].split(/\s+/).map(m => m.trim())
                };

                remaining -= currentMember.members.length;
            }
            else if (currentMember && remaining > 0) {
                const moreMembers = line.trim().split(/\s+/).map(m => m.trim());
                currentMember.members.push(...moreMembers);
                remaining -= moreMembers.length;
            }

            if (currentMember && !remaining) {
                this.members.push(currentMember);
                currentMember = undefined;
            }
        });
    }
}

function renderHeaders(size: string, headers: Header[]): string {
    return `${Components.keyValueTable<Header>(
        h => h.label,
        h => h.value,
        headers
        )}
    ${Components.divider()}
    ${Components.button(`Download${size ? ` (${size})` : ''}`, { action: ACTION_DOWNLOAD, icon: { name: "cloud-download" } })}`;
}

function renderObjects(objects: Object[]): string {
    return Components.dataGrid<Object>({
        stickyHeader: true,
        columns: [
            { title: 'Name', cellValue: o => o.name, size: "1fr" },
            { title: 'Type', cellValue: o => o.type, size: "1fr" },
            { title: 'Attribute', cellValue: o => o.attribute, size: "1fr" },
            { title: 'Text', cellValue: o => o.text, size: "2fr" },
            { title: 'Size', cellValue: o => `${o.size} `, size: "1fr" },
            { title: 'Data', cellValue: o => o.data, size: "1fr" },
            { title: 'Owner', cellValue: o => o.owner, size: "1fr" },
        ]
    }, objects);
}

function renderMembers(members: FileMember[]): string {
    return Components.dataGrid<FileMember>({
        stickyHeader: true,
        columns: [
            { title: 'Name', cellValue: fm => fm.name, size: "1fr" },
            { title: 'Type', cellValue: fm => fm.type, size: "1fr" },
            { title: 'Members', cellValue: fm => fm.members.join(""), size: "6fr" },
        ]
    }, members);
}

function renderSpooledFiles(spooledFiles: SpooledFile[]): string {
    return Components.dataGrid<SpooledFile>({
        stickyHeader: true,
        columns: [
            { title: 'Name', cellValue: sf => sf.name, size: "1fr" },
            { title: 'Number', cellValue: sf => `${sf.number} `, size: "1fr" },
            { title: 'Job name', cellValue: sf => sf.jobName, size: "1fr" },
            { title: 'Job user', cellValue: sf => sf.jobUser, size: "1fr" },
            { title: 'Job number', cellValue: sf => `${sf.jobNumber} `, size: "1fr" },
            { title: 'Out queue', cellValue: sf => sf.outputQueue, size: "1fr" },
            { title: 'Library', cellValue: sf => sf.library, size: "1fr" },
            { title: 'System', cellValue: sf => sf.system, size: "1fr" },
            { title: 'Creation', cellValue: sf => sf.creation, size: "1fr" },
            { title: 'ASP', cellValue: sf => `${sf.asp} `, size: "1fr" },
        ]
    }, spooledFiles);
}