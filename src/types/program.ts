import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";

interface ProgramInfo {
    currentValue: string
    type: string
    length: number
    decimalPosition: number
}

export class DataArea extends Base {
    private info?: ProgramInfo;

    async fetch(): Promise<void> {
        const instance = getBase();
        const connection = instance.getConnection();
        const content = instance.getContent();
        if (connection && content) {
            const dtaara: Record<string, string | object | null> = await vscode.commands.executeCommand(`code-for-ibmi.runQuery`,
                `Select DATA_AREA_TYPE, LENGTH, DECIMAL_POSITIONS, DATA_AREA_VALUE
                From TABLE(QSYS2.DATA_AREA_INFO(
                    DATA_AREA_NAME => '${this.name}',
                    DATA_AREA_LIBRARY => '${this.library}'))
                Fetch first row only`
            );
            this.info = {
                currentValue: dtaara.DATA_AREA_VALUE?.toString() || "",
                type: dtaara.DATA_AREA_TYPE!.toString(),
                length: Number(dtaara.LENGTH!),
                decimalPosition: Number(dtaara.DECIMAL_POSITIONS || 0)
            };
        }
    }

    generateHTML(): string {
        return "";
    }
    
    handleAction(data: any): boolean {
        throw new Error("Method not implemented.");
    }

    save(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}