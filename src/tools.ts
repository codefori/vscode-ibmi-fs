import { CodeForIBMi, CommandResult, RemoteCommand } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';

let codeForIBMi : CodeForIBMi;

export namespace Code4i {
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
        return getConnection().getConfig();
    } 

    export function getContent() {
        return getConnection().getContent();
    } 

    export function getTempLibrary(): string {
        return getConfig().tempLibrary;
    }

    export async function getTable(library: string, name: string): Promise<Tools.DB2Row[]> {
        return getContent().getTable(library, name, name, true);
    }

    export async function runCommand(command: RemoteCommand) : Promise<CommandResult>  {
        return await getConnection().runCommand(command);
    }    
}

export const IBMI_OBJECT_NAME = /^([\w$#@][\w\d$#@_.]{0,9})$/i;

export function getQSYSObjectPath(library: string, name: string, type: string, member?: string, iasp?: string) {
    return `${iasp ? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member ? `/${member.toUpperCase()}.MBR` : ''}`;
}

export function makeid(length? : number){
    return Math.random().toString(36).substring(2, length ? length + 2 : 7);
}