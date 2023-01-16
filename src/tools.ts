import { CodeForIBMi, CommandResult, RemoteCommand } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

export namespace Code4i {
    let codeForIBMi : CodeForIBMi;
    export async function initialize() {
        const baseExtension = vscode.extensions.getExtension<CodeForIBMi>(`halcyontechltd.code-for-ibmi`);
        if (baseExtension) {
            codeForIBMi = (baseExtension.isActive ? baseExtension.exports : await baseExtension.activate());
        }
        else{
            throw new Error("halcyontechltd.code-for-ibmi not found or cannot be activated");
        }
    }

    export function getConnection() {
        return codeForIBMi.instance.getConnection();
    } 

    export function getConfig() {
        return codeForIBMi.instance.getConfig();
    } 

    export function getContent() {
        return codeForIBMi.instance.getContent();
    } 

    export function getTempLibrary(): string {
        return getConfig().tempLibrary;
    }

    export async function getTable(library: string, name: string): Promise<Tools.DB2Row[]> {
        return getContent().getTable(library, name, name, true);
    }

    export async function runCommand(command: RemoteCommand) : Promise<CommandResult>  {
        return await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, command);
    }
}

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
    return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}

export function makeid() {
    let text = `O_`;
    let possible = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`;

    for (let i = 0; i < 8; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}