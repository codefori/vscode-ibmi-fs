import * as vscode from 'vscode';
import Base from "./base";
import { makeid, getTempLibrary, getTable } from '../tools';

export default class BindingDirectory implements Base {
    static async get(library: string, name: string): Promise<string> {
        const tempLib = getTempLibrary();
        const tempName = makeid();

        const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: `DSPBNDDIR BNDDIR(${library}/${name}) OUTPUT(*OUTFILE) OUTFILE(${tempLib}/${tempName})`,
            environment: `ile`
        });

        const rows = await getTable(tempLib, tempName);
        const results = rows.map(row => ({
          object: row.BNOBNM,
          library: row.BNDRLB,
          type: row.BNOBTP,
          activation: row.BNOACT,
          creation: {
            date: row.BNODAT,
            time: row.BNOTIM,
          }
        }));

        return JSON.stringify(results, null, 2);
    }
}