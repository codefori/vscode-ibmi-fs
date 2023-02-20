import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';
import { Components } from "../webviewToolkit";

interface JobDescriptionLibrary {
  sequence: number
  library: string
}

export class JobDescription extends Base {
  private jobDescriptionInfo: Record<string, string> = {};
  private jobDescriptionLibraries: JobDescriptionLibrary[] | undefined;

  async fetch(): Promise<void> {
    const connection = Code4i.getConnection();
    const content = Code4i.getContent();
    if (connection && content) {
      // Job Description
      const [jobDescriptionInfo] = await Code4i.getContent().runSQL([`SELECT JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
                    JOB_DESCRIPTION "jobDescription",
                    AUTHORIZATION_NAME "authorizationName",
                    ifnull(JOB_DATE, '0001-01-01') "jobDate",
                    ACCOUNTING_CODE "accountingCode",
                    ROUTING_DATA "routingData",
                    ifnull(REQUEST_DATA,'') "requestData",
                    ifnull(LIBRARY_LIST_COUNT, 0) "libraryListCount",
                    ifnull(LIBRARY_LIST, '') "libraryList",
                    JOB_SWITCHES "jobSwitches",
                    ifnull(TEXT_DESCRIPTION, '') "textDescription",
                    JOB_QUEUE_LIBRARY "jobQueueLibrary",
                    JOB_QUEUE "jobQueue",
                    JOB_QUEUE_PRIORITY "jobQueuePriority",
                    HOLD_ON_JOB_QUEUE "holdOnJobQueue",
                    ifnull(OUTPUT_QUEUE_LIBRARY, '') "outputQueueLibrary",
                    OUTPUT_QUEUE "outputQueue",
                    OUTPUT_QUEUE_PRIORITY "outputQueuePriority",
                    SPOOLED_FILE_ACTION "spooledFileAction",
                    PRINTER_DEVICE "printerDevice",
                    PRINT_TEXT "printText",
                    ifnull(JOB_MESSAGE_QUEUE_MAXIMUM_SIZE, 0) jobMessageQueueMaximumSize,
                    JOB_MESSAGE_QUEUE_FULL_ACTION "jobMessageQueueFullAction",
                    ifnull(SYNTAX_CHECK_SEVERITY, 0) "syntaxCheckSeverity",
                    JOB_END_SEVERITY "jobEndSeverity",
                    JOBLOG_OUTPUT "joblogOutput",
                    INQUIRY_MESSAGE_REPLY "inquiryMessageReply",
                    MESSAGE_LOGGING_LEVEL "messageLoggingLevel",
                    MESSAGE_LOGGING_SEVERITY "messageLoggingSeverity",
                    MESSAGE_LOGGING_TEXT "messageLoggingText",
                    LOG_CL_PROGRAM_COMMANDS "logClProgramCommands",
                    DEVICE_RECOVERY_ACTION "deviceRecoveryAction",
                    TIME_SLICE_END_POOL "timeSliceEndPool",
                    ALLOW_MULTIPLE_THREADS "allowMultipleThreads",
                    WORKLOAD_GROUP "workloadGroup",
                    ifnull(ASPGRP, '') "aspgrp",
                    DDM_CONVERSATION "ddmConversation"
                FROM QSYS2.JOB_DESCRIPTION_INFO
                where JOB_DESCRIPTION_LIBRARY = '${this.library}' AND JOB_DESCRIPTION = '${this.name}' LIMIT 1`].join(` `));

      if (jobDescriptionInfo) {
        this.jobDescriptionInfo["Job description library"] = String(jobDescriptionInfo.jobDescriptionLibrary);
        this.jobDescriptionInfo["Job description"] = String(jobDescriptionInfo.jobDescription);
        this.jobDescriptionInfo["Authorization name"] = String(jobDescriptionInfo.authorizationName);
        this.jobDescriptionInfo["Job date"] = String(jobDescriptionInfo.jobDate) === `0001-01-01` ? '' : String(jobDescriptionInfo.jobDate);
        this.jobDescriptionInfo["Accounting code"] = String(jobDescriptionInfo.accountingCode);
        this.jobDescriptionInfo["Routing data"] = String(jobDescriptionInfo.routingData);
        this.jobDescriptionInfo["Request data"] = String(jobDescriptionInfo.requestData);
        this.jobDescriptionInfo["Library list count"] = String(jobDescriptionInfo.libraryListCount);
        this.jobDescriptionInfo["Library list"] = String(jobDescriptionInfo.libraryList);
        this.jobDescriptionInfo["Job switches"] = String(jobDescriptionInfo.jobSwitches);
        this.jobDescriptionInfo["Text description"] = String(jobDescriptionInfo.textDescription);
        this.jobDescriptionInfo["Job queue library"] = String(jobDescriptionInfo.jobQueueLibrary);
        this.jobDescriptionInfo["Job queue"] = String(jobDescriptionInfo.jobQueue);
        this.jobDescriptionInfo["Job queue priority"] = String(jobDescriptionInfo.jobQueuePriority);
        this.jobDescriptionInfo["Hold on job queue"] = String(jobDescriptionInfo.holdOnJobQueue);
        this.jobDescriptionInfo["Output queue library"] = String(jobDescriptionInfo.outputQueueLibrary);
        this.jobDescriptionInfo["Output queue"] = String(jobDescriptionInfo.outputQueue);
        this.jobDescriptionInfo["Output queue priority"] = String(jobDescriptionInfo.outputQueuePriority);
        this.jobDescriptionInfo["Spooled file action"] = String(jobDescriptionInfo.spooledFileAction);
        this.jobDescriptionInfo["Printer device"] = String(jobDescriptionInfo.printerDevice);
        this.jobDescriptionInfo["Print text"] = String(jobDescriptionInfo.printText);
        this.jobDescriptionInfo["Job message queue maximum size"] = String(jobDescriptionInfo.jobMessageQueueMaximumSize);
        this.jobDescriptionInfo["Job message queue full action"] = String(jobDescriptionInfo.jobMessageQueueFullAction);
        this.jobDescriptionInfo["Syntax check severity"] = String(jobDescriptionInfo.syntaxCheckSeverity);
        this.jobDescriptionInfo["Job end severity"] = String(jobDescriptionInfo.jobEndSeverity);
        this.jobDescriptionInfo["Joblog output"] = String(jobDescriptionInfo.joblogOutput);
        this.jobDescriptionInfo["Inquiry message reply"] = String(jobDescriptionInfo.inquiryMessageReply);
        this.jobDescriptionInfo["Message logging level"] = String(jobDescriptionInfo.messageLoggingLevel);
        this.jobDescriptionInfo["Message logging severity"] = String(jobDescriptionInfo.messageLoggingSeverity);
        this.jobDescriptionInfo["Message logging text"] = String(jobDescriptionInfo.messageLoggingText);
        this.jobDescriptionInfo["Log cl program commands"] = String(jobDescriptionInfo.logClProgramCommands);
        this.jobDescriptionInfo["Device recovery action"] = String(jobDescriptionInfo.deviceRecoveryAction);
        this.jobDescriptionInfo["Time slice end pool"] = String(jobDescriptionInfo.timeSliceEndPool);
        this.jobDescriptionInfo["Allow mltiple threads"] = String(jobDescriptionInfo.allowMultipleThreads);
        this.jobDescriptionInfo["Workload group"] = String(jobDescriptionInfo.workloadGroup);
        this.jobDescriptionInfo["ASP group"] = String(jobDescriptionInfo.aspgrp);
        this.jobDescriptionInfo["DDM conversation"] = String(jobDescriptionInfo.ddmConversation);
      }

      // Library list
      this.jobDescriptionLibraries = await this.getLibraryList();

    } else {
      throw new Error("No connection.");
    }
  }

  generateHTML(): string {
    const descriptionTab = /* html */ `
      ${Components.dataGrid<[string, string]>({
      columns: [
        { title: "", cellValue: entry => entry[0] },
        { title: "", cellValue: entry => entry[1] }
      ]
    }, Object.entries(this.jobDescriptionInfo))}`;

    const libraryListTab = /* html */ `
      ${Components.dataGrid<JobDescriptionLibrary>({
      columns: [
        { title: "Sequence", cellValue: l => String(l.sequence) },
        { title: "Library", cellValue: l => l.library }
      ]
    }, this.jobDescriptionLibraries!)}`;

    const panels = Components.panels([
      { title: "DESCRIPTION", content: descriptionTab },
      { title: "LIBRARY LIST", content: libraryListTab, badge: this.jobDescriptionLibraries?.length ? this.jobDescriptionLibraries?.length : 0 }
    ]);

    return panels;
  }

  async handleAction(data: any): Promise<HandleActionResult> {
    // Nothing to do
    return { };
  }

  async save(): Promise<void> {
    // Nothing to do
  }

  private async getLibraryList(): Promise<JobDescriptionLibrary[] | undefined> {
    let jobDescriptionLibraries: JobDescriptionLibrary[] = [];
    if (parseInt(this.jobDescriptionInfo["libraryListCount"]) > 0 ) {
      for (let index = 0; index < parseInt(this.jobDescriptionInfo["libraryListCount"]); index++) {
        const start = index * 10 + index * 1;
        const library = this.jobDescriptionInfo!.libraryList.substring(start, start + 11);
        const sequence = (index + 1) * 10;
        jobDescriptionLibraries.push({ sequence, library });
      }
    }
    return jobDescriptionLibraries;
  }
}