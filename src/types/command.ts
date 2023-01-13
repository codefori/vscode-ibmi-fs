import * as vscode from 'vscode';
import { Components } from '../webviewToolkit';
import Base from "./base";

const DETAIL_REGEX = /^(\s+)([^\.]+)[\. ]*: +([A-Z]+)? +(.*)$/;

interface CommandDetail {
    keyword: string
    label: string
    value: string
}

export class Command extends Base {
    private commandInfo: CommandDetail[] = [];

    async fetch() {
        const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
            command: `DSPCMD CMD(${this.library}/${this.name})`,
            environment: `ile`
        });

        if (command.code === 0 && command.stdout) {
            this.commandInfo = parseOutput(command.stdout);
        }
    }

    generateHTML(): string {
        return Components.dataGrid<CommandDetail>({
            stickyHeader: true,
            columns: [
                { title: "Name", size: "300px", cellValue: d => d.label },
                { title: "Keyword", size: "200px", cellValue: d => d.keyword },
                { title: "Value", cellValue: d => d.value }
            ]
        }, this.commandInfo);
    }

    handleAction(data: any): HandleActionResult {
        //Nothing to handle
        return {};
    }

    async save(): Promise<void> {
        //Nothing to save
    }
}

function parseOutput(output: string): CommandDetail[] {
    const details: CommandDetail[] = [];
    let lines = output.split(/[\r\n]/g);
    lines = lines.slice(4, lines.length - 1);
    let detail: CommandDetail | undefined;
    for (const line of lines) {
        const result = DETAIL_REGEX.exec(line);

        if (result) {
            const continuation = result[1]?.length > 1;
            const label = result[2]?.trim();
            const id = result[3]?.trim();
            const value = result[4]?.trim();

            if (!continuation && id) {
                detail = {
                    keyword: id,
                    label: label,
                    value: value
                };
                details.push(detail);
            }
            else if (continuation && detail) {
                detail.value += " " + value;
            }
        }
        else if (detail) {
            detail.value += " " + line.trim();
        }
    }

    //Ugly
    const ccsidLine = lines[lines.length - 2];
    const ccsidLabel = ccsidLine.split(" . . . . .").reverse().pop()?.trim();
    const ccsid = ccsidLine.split(" ").pop()?.trim();
    if (ccsid && !isNaN(Number(ccsid))) {
        details.push({
            keyword: "CCSID",
            label: ccsidLabel || "Coded character set ID",
            value: ccsid
        });
    }

    details.forEach(processDetailValue);
    return details;
}

function processDetailValue(detail: CommandDetail) {
    const parts = detail.value.split(' ');
    switch (detail.keyword) {
        case "PGM":
            detail.value = `${parts[1]}/${parts[0]}; State: ${parts[2]}`;
            break;

        case "SRCFILE":
        case "MSGF":
        case "HLPPNLGRP":
        case "HLPPNLGRP":
            detail.value = `${parts[1]}/${parts[0]}`;
            break;

        case "MODE":
        case "ALLOW":
            detail.value = parts.map(p => p.trim()).filter(p => Boolean(p)).join(", ");
            break;
    }
}