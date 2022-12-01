import * as vscode from 'vscode';

export function getBase() {
    const baseExtension = (vscode.extensions ? vscode.extensions.getExtension(`halcyontechltd.code-for-ibmi`) : undefined);
    return (baseExtension && baseExtension.isActive && baseExtension.exports ? baseExtension.exports.instance : null);
}

export function makeid() {
    let text = `O_`;
    let possible = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`;

    for (let i = 0; i < 8; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return text;
}

export function getTempLibrary(): string {
    const instance = getBase();
    const config = instance.getConfig();

    return config.tempLibrary;
}

export async function getTable(library: string, name: string): Promise<any[]> {
    const instance = getBase();
    const content = instance.getContent();
    return content.getTable(library, name, name, true);
}

export function getQSYSObjectPath(library:string, name:string, type:string, member?: string, iasp?:string){
    return `${iasp? `/${iasp.toUpperCase()}` : ''}/QSYS.LIB/${library.toUpperCase()}.LIB/${name.toUpperCase()}.${type.toUpperCase()}${member? `/${member.toUpperCase()}.MBR` : ''}`;
}