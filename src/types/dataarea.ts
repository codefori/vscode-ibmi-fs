import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";
import { Components } from "../webviewToolkit";

interface DataAreaInfo {
  initialValue: string
  currentValue: string
  type: string
  length: number
  decimalPosition: number
}

export class DataArea extends Base {
  private info: DataAreaInfo = {
    initialValue: "",
    currentValue: "",
    type: "",
    length: 0,
    decimalPosition: 0
  };

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
      this.info.currentValue = dtaara.DATA_AREA_VALUE?.toString() || "";
      this.info.initialValue = this.info.currentValue;
      this.info.type = dtaara.DATA_AREA_TYPE!.toString();
      this.info.length = Number(dtaara.LENGTH!);
      this.info.decimalPosition = Number(dtaara.DECIMAL_POSITIONS || 0);
    }
  }

  generateHTML(): string {
    const info = this.info!;
    return /* html */`
    <p>
      <h3>Type: <code>${info.type}</code></h3>
      ${info.type !== "*LGL" ? /* html */ `<h3>Length: <code>${info.length}</code></h3>` : ''}
      ${info.type === "*DEC" ? /* html */ `<h3>Decimal position: <code>${info.decimalPosition}</code></h3>` : ''}
    </p>
    ${Components.divider()}
    <p>${getValueField(info)}</p>`;
  }

  handleAction(data: any): HandleActionResult {
    if (data.value !== this.info.initialValue) {
      this.info.currentValue = data.value;
      // We don't want to rerender. 
      return {
        dirty: true
      };
    }
    else {
      return {};
    }
  }

  async save(): Promise<void> {
    let value: string | number | boolean = this.info.currentValue;

    switch (this.info.type) {
      case `*DEC`:
        value = Number(value);
        break;

      case `*LGL`:
        value = `'${value ? '1' : '0'}'`;
        break;

      default:
        value = `'${value}'`.replace(/\s/g, " ");
    }

    const command: CommandResult = await vscode.commands.executeCommand(`code-for-ibmi.runCommand`, {
      command: `CHGDTAARA DTAARA(${this.library}/${this.name}) VALUE(${value})`,
      environment: `ile`
    });
    if (command.code === 0) {
      this.info.initialValue = this.info.currentValue;
    }
    else {
      throw new Error(command.stderr);
    }
  }
}

function getValueField(info: DataAreaInfo) {
  switch (info.type) {
    case `*LGL`:
      return Components.checkbox("value", "Logical value", { checked: info.currentValue === `1`, });

    case `*DEC`:
      const size = info.length + info.decimalPosition ? 1 : 0;
      return Components.textField("value", "Decimal value", { maxlength: size, value: info.currentValue });

    default:
      return Components.textArea("value", "Character value", { value: info.currentValue || '', maxlength: info.length, cols: 100, rows: 3 });
  }
}
