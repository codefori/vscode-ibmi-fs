import * as vscode from 'vscode';
import Base from "./base";
import { Components } from "../webviewToolkit";
import { Code4i } from '../tools';
import { CommandResult } from '@halcyontech/vscode-ibmi-types';

interface DataAreaInfo {
  value: string
  type: string
  length: number
  decimalPosition: number
}

export class DataArea extends Base {
  private dataArea: DataAreaInfo = {
    value: "",
    type: "",
    length: 0,
    decimalPosition: 0
  };

  async fetch(): Promise<void> {
    const ibmi=Base.getIbmi();

    if(ibmi){
      const [dtaara] = await ibmi.runSQL(
        `Select DATA_AREA_TYPE, LENGTH, DECIMAL_POSITIONS, DATA_AREA_VALUE
                From TABLE(QSYS2.DATA_AREA_INFO(
                    DATA_AREA_NAME => '${this.name}',
                    DATA_AREA_LIBRARY => '${this.library}'))
                Fetch first row only`
      );

      this.dataArea.type = dtaara.DATA_AREA_TYPE!.toString();
      this.dataArea.value = dtaara.DATA_AREA_VALUE?.toString() || "";
      this.dataArea.length = Number(dtaara.LENGTH!);
      this.dataArea.decimalPosition = Number(dtaara.DECIMAL_POSITIONS || 0);
    }   
  }

  generateHTML(): string {
    const info = this.dataArea;
    return /* html */`
    <p>
      <h3>Type: <code>${info.type}</code></h3>
      ${info.type !== "*LGL" ? /* html */ `<h3>Length: <code>${info.length}</code></h3>` : ''}
      ${info.type === "*DEC" ? /* html */ `<h3>Decimal position: <code>${info.decimalPosition}</code></h3>` : ''}
    </p>
    ${Components.divider()}
    <p>${renderValueField(info)}</p>`;
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    this.dataArea.value = this.getValue(data.value).toString();
    // We don't want to rerender. 
    return {
      dirty: true
    };
  }

  private getValue(value: string | boolean) {
    switch (this.dataArea.type) {
      case `*DEC`:
        return value || "0";

      case `*LGL`:
        return `${value ? '1' : '0'}`;

      default:
        return `${value}`.replace(/\s/g, " ");
    }
  }

  private checkDecimal(value: string) {
    if (value) {
      const max = (Math.pow(10, this.dataArea.length) - 1) / (this.dataArea.decimalPosition ? Math.pow(10, this.dataArea.decimalPosition) : 1);
      const min = max * -1;
      const number = Number(value);
      if (isNaN(number)) {
        throw new Error(`Value '${value}' is not a number.`);
      }
      else if (number > max || number < min) {
        throw new Error(`Value must be comprised between ${min} and ${max}.`);
      }
    }
  }

  async save(): Promise<void> {
    let value;
    if (this.dataArea.type === "*DEC") {
      this.checkDecimal(this.dataArea.value);
      value = this.dataArea.value;
    }
    else {
      value = `'${this.dataArea.value}'`;;
    }

    const command: CommandResult = await Code4i.runCommand({
      command: `CHGDTAARA DTAARA(${this.library}/${this.name}) VALUE(${value})`,
      environment: `ile`
    });

    if (command.code !== 0) {
      throw new Error(command.stderr);
    }
  }
}

function renderValueField(info: DataAreaInfo) {
  switch (info.type) {
    case `*LGL`:
      return Components.checkbox("value", "Logical value", { checked: info.value === `1`, });

    case `*DEC`:
      const size = info.length + (info.decimalPosition ? 1 : 0);
      return Components.textField("value", "Decimal value", { maxlength: size, value: info.value });

    default:
      return Components.textArea("value", "Character value", { value: info.value || '', maxlength: info.length, cols: 100, rows: 3 });
  }
}
