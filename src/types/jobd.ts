import Base from "./base";
import { getInstance } from "../ibmi";
import { getColumns } from "../tools";
import { generateTableHtml } from "../tools";

export default class Jobd extends Base {
  private jobd?:any;
  columns: Map<string, string> = new Map();
  selectClause: string | undefined;

  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      this.columns = await getColumns(connection,'JOB_DESCRIPTION_INFO');

      this.jobd = await connection. runSQL(
        `SELECT JOB_DESCRIPTION, JOB_DESCRIPTION_LIBRARY, AUTHORIZATION_NAME, JOB_DATE, ACCOUNTING_CODE, ROUTING_DATA, REQUEST_DATA,
          LIBRARY_LIST_COUNT, LIBRARY_LIST, JOB_SWITCHES, TEXT_DESCRIPTION, JOB_QUEUE_LIBRARY, JOB_QUEUE, JOB_QUEUE_PRIORITY,
          HOLD_ON_JOB_QUEUE, OUTPUT_QUEUE_LIBRARY, OUTPUT_QUEUE, OUTPUT_QUEUE_PRIORITY, SPOOLED_FILE_ACTION, PRINTER_DEVICE,
          PRINT_TEXT, JOB_MESSAGE_QUEUE_MAXIMUM_SIZE, JOB_MESSAGE_QUEUE_FULL_ACTION, SYNTAX_CHECK_SEVERITY, JOB_END_SEVERITY,
          JOBLOG_OUTPUT, INQUIRY_MESSAGE_REPLY, MESSAGE_LOGGING_LEVEL, MESSAGE_LOGGING_SEVERITY, MESSAGE_LOGGING_TEXT,
          LOG_CL_PROGRAM_COMMANDS, DEVICE_RECOVERY_ACTION, TIME_SLICE_END_POOL, ALLOW_MULTIPLE_THREADS, WORKLOAD_GROUP, ASPGRP,
          DDM_CONVERSATION
          FROM QSYS2.JOB_DESCRIPTION_INFO
          WHERE JOB_DESCRIPTION = '${this.name}' AND JOB_DESCRIPTION_LIBRARY = '${this.library}'
          Fetch first row only`)
    }
  }

  generateHTML(): string {
    return generateTableHtml(this.columns,this.jobd);
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    //Nothing to handle
    return {};
  }

  async save(): Promise<void> {
    //Nothing to save
  }
}
