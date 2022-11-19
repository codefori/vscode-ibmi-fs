import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";

interface DataAreaInfo {
  currentValue: string
  type: string
  length: number
  decimalPosition: number
}

export class DataArea extends Base {
  private info?: DataAreaInfo;

  async fetch(): Promise<void> {
    const instance = getBase();
    const connection = instance.getConnection();
    const content = instance.getContent();
    if (connection && content) {
      const dtaaras: Record<string, string | object | null>[] = (await vscode.commands.executeCommand(`code-for-ibmi.runQuery`,
        `Select DATA_AREA_TYPE, LENGTH, DECIMAL_POSITIONS, DATA_AREA_VALUE
                From TABLE(QSYS2.DATA_AREA_INFO(
                    DATA_AREA_NAME => '${this.name}',
                    DATA_AREA_LIBRARY => '${this.library}'))
                Fetch first row only`
      ));

      const [dtaara] = dtaaras;

      this.info = {
        currentValue: dtaara.DATA_AREA_VALUE?.toString() || "",
        type: dtaara.DATA_AREA_TYPE!.toString(),
        length: Number(dtaara.LENGTH!),
        decimalPosition: Number(dtaara.DECIMAL_POSITIONS || 0)
      };
    }
  }

  generateHTML(): string {
    const info = this.info!;
    const html = /* html */`
            <vscode-text-field readonly="true" value="${info.type}">Type</vscode-text-field>
            ${info.type !== "*LGL" ? /* html */ `<vscode-text-field readonly="true" value="${info.length}">Length</vscode-text-field>` : ''}
            ${info.type === "*DEC" ? /* html */ `<vscode-text-field readonly="true" value="${info.decimalPosition}">Decimal position</vscode-text-field>` : ''}
            ${getValueField(info)}
        `;
    return html;
  }

  handleAction(data: any): boolean {
    throw new Error("Method not implemented.");
  }
}

function getValueField(info: DataAreaInfo) {
  switch (info.type) {
    case `*LGL`:
      return /* html */`<vscode-checkbox name="value" autofocus ${info.currentValue === `1` ? `checked` : ``}>Logical value</vscode-checkbox>`;

    case `*DEC`:
      return /* html */`<vscode-text-field name="value" size="50" value="${info.currentValue}">Decimal value</vscode-text-field>`;
    //valueField = new Field(`number`, `value`, `Decimal value`);
    //valueField.max = (Math.pow(10, length) - 1) / (decimalPosition ? Math.pow(10, decimalPosition) : 1);
    //valueField.min = valueField.max * -1;
    //valueField.default = currentValue || "0";

    default:
      return /* html */`<vscode-text-area name="value" autofocus value="${info.currentValue || ''}" maxlength="${Number(info.length)}">Character value</vscode-text-area>`;
  }
}
