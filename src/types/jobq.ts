import Base from "./base";
import { Components } from "../webviewToolkit";
import IBMi from '@halcyontech/vscode-ibmi-types/api/IBMi';
import { getInstance } from "../ibmi";
import { getColumns } from "../tools";

export default class Jobq extends Base {
  private jobq?:any;
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection,'JOB_QUEUE_INFO');

      this.jobq = await connection. runSQL(
        `SELECT JOB_QUEUE_STATUS, NUMBER_OF_JOBS, SUBSYSTEM_NAME, SUBSYSTEM_LIBRARY_NAME, MAXIMUM_ACTIVE_JOBS, ACTIVE_JOBS, HELD_JOBS,
            RELEASED_JOBS, SCHEDULED_JOBS, TEXT_DESCRIPTION
          FROM QSYS2.JOB_QUEUE_INFO
          WHERE JOB_QUEUE_NAME = '${this.name}' AND JOB_QUEUE_LIBRARY = '${this.library}'
          Fetch first row only`)
    }
  }

  generateHTML(): string {

    let html=`<vscode-data-grid>`;

    this.columns.forEach((label, key) => {
      if(key in this.jobq[0]){
        let value = this.jobq[0][key as keyof typeof this.jobq];
        if(!value)
          value="-"
        html=html.trim()+`<vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${label}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${value}</vscode-data-grid-cell>
          </vscode-data-grid-row>`;
      }
    });

    html=html.trim()+'</vscode-data-grid>';

    return html;
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    //Nothing to handle
    return {};
  }

  async save(): Promise<void> {
    //Nothing to save
  }

  /*async handleAction(data: any): Promise<HandleActionResult> {
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
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      let value;
      if (this.dataArea.type === "*DEC") {
        this.checkDecimal(this.dataArea.value);
        value = this.dataArea.value;
      }
      else {
        value = `'${this.dataArea.value}'`;;
      }

      const command: CommandResult = await connection.runCommand({
        command: `CHGDTAARA DTAARA(${this.library}/${this.name}) VALUE(${value})`,
        environment: `ile`
      });

      if (command.code !== 0) {
        throw new Error(command.stderr);
      }
    }
  }
}

function renderValueField(info: JobqInfo) {
  switch (info.type) {
    case `*LGL`:
      return Components.checkbox("value", "Logical value", { checked: info.value === `1`, });

    case `*DEC`:
      const size = info.length + (info.decimalPosition ? 1 : 0);
      return Components.textField("value", "Decimal value", { maxlength: size, value: info.value });

    default:
      return Components.textArea("value", "Character value", { value: info.value || '', maxlength: info.length, cols: 100, rows: 3 });
  }*/
}
