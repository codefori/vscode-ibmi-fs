import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';

interface JobDescriptionInfo {
    jobDescriptionLibrary: string
    jobDescription: string
    authorizationName: string
    jobDate: string
    accountingCode: string
    routingData: string
    requestData: string
    libraryListCount: number
    libraryList: string
    jobSwitches: string
    textDescription: string
    jobQueueLibrary: string
    jobQueue: string
    jobQueuePriority: number
    holdOnJobQueue: string
    outputQueueLibrary: string
    outputQueue: string
    outputQueuePriority: number
    spooledFileAction: string
    printerDevice: string
    printText: string
    jobMessageQueueMaximumSize: number
    jobMessageQueueFullAction: string
    syntaxCheckSeverity: string
    jobEndSeverity: number
    joblogOutput: string
    inquiryMessageReply: string
    messageLoggingLevel: number
    messageLoggingSeverity: number
    messageLoggingText: string
    logClProgramCommands: string
    deviceRecoveryAction: string
    timeSliceEndPool: string
    allowMultipleThreads: string
    workloadGroup: string
    aspgrp: string
    ddmConversation: string
}

interface JobDescriptionLibrary {
    sequence: number
    library: string
}

export class JobDescription extends Base {
    private jobDescriptionInfo: JobDescriptionInfo | undefined;
    private jobDescriptionLibraries: JobDescriptionLibrary[] | undefined;

    async fetch(): Promise<void> {
        const connection = Code4i.getConnection();
        const content = Code4i.getContent();
        if (connection && content) {
            // Job Description
            const jobDescriptionInfo = await Code4i.getContent().runSQL([`SELECT JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
                    JOB_DESCRIPTION "jobDescription",
                    AUTHORIZATION_NAME "authorizationName",
                    ifnull(JOB_DATE, '0001-01-01') jobDate,
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
                    ASPGRP "aspgrp",
                    DDM_CONVERSATION "ddmConversation"
                FROM QSYS2.JOB_DESCRIPTION_INFO
                where JOB_DESCRIPTION_LIBRARY = '${this.library}' AND JOB_DESCRIPTION = '${this.name}' LIMIT 1`].join(` `));

            if (jobDescriptionInfo && jobDescriptionInfo.length > 0) {
                const resultJobDescription: JobDescriptionInfo[] = jobDescriptionInfo.map(row => ({
                    jobDescriptionLibrary: String(row.jobDescriptionLibrary),
                    jobDescription: String(row.jobDescription),
                    authorizationName: String(row.authorizationName),
                    jobDate: String(row.jobDate),
                    accountingCode: String(row.accountingCode),
                    routingData: String(row.routingData),
                    requestData: String(row.requestData),
                    libraryListCount: Number(row.libraryListCount),
                    libraryList: String(row.libraryList),
                    jobSwitches: String(row.jobSwitches),
                    textDescription: String(row.textDescription),
                    jobQueueLibrary: String(row.jobQueueLibrary),
                    jobQueue: String(row.jobQueue),
                    jobQueuePriority: Number(row.jobQueuePriority),
                    holdOnJobQueue: String(row.holdOnJobQueue),
                    outputQueueLibrary: String(row.outputQueueLibrary),
                    outputQueue: String(row.outputQueue),
                    outputQueuePriority: Number(row.outputQueuePriority),
                    spooledFileAction: String(row.spooledFileAction),
                    printerDevice: String(row.printerDevice),
                    printText: String(row.printText),
                    jobMessageQueueMaximumSize: Number(row.jobMessageQueueMaximumSize),
                    jobMessageQueueFullAction: String(row.jobMessageQueueFullAction),
                    syntaxCheckSeverity: String(row.syntaxCheckSeverity),
                    jobEndSeverity: Number(row.jobEndSeverity),
                    joblogOutput: String(row.joblogOutput),
                    inquiryMessageReply: String(row.inquiryMessageReply),
                    messageLoggingLevel: Number(row.messageLoggingLevel),
                    messageLoggingSeverity: Number(row.messageLoggingSeverity),
                    messageLoggingText: String(row.messageLoggingText),
                    logClProgramCommands: String(row.logClProgramCommands),
                    deviceRecoveryAction: String(row.deviceRecoveryAction),
                    timeSliceEndPool: String(row.timeSliceEndPool),
                    allowMultipleThreads: String(row.allowMultipleThreads),
                    workloadGroup: String(row.workloadGroup),
                    aspgrp: String(row.aspgrp),
                    ddmConversation: String(row.ddmConversation)
                }));
                this.jobDescriptionInfo = resultJobDescription[0];
            }

            // Library list
            this.jobDescriptionLibraries = await this.getLibraryList();

        } else {
            throw new Error("No connection.");
        }
    }

    generateHTML(): string {
        const descriptionTab = `<h1>Description</h1>
            <vscode-data-grid>
              <vscode-data-grid-row row-type="header">
                <vscode-data-grid-cell cell-type="columnheader" grid-column="1"></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="2"></vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Description</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobDescription}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Description Library</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobDescriptionLibrary}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Authorization Name</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.authorizationName}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Date</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobDate}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Accounting Code</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.accountingCode}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Routing Data</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.routingData}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Request Data</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.requestData}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Switches</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobSwitches}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Text Description</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.textDescription}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Queue</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobQueue}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Queue Library</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobQueueLibrary}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Queue Priority</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobQueuePriority}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Hold On Job Queue</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.holdOnJobQueue}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Output Queue Library</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.outputQueueLibrary}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Output Queue</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.outputQueue}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Output Queue Priority</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.outputQueuePriority}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Spooled File Action</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.spooledFileAction}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Printer Device</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.printerDevice}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Print Text</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.printText}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Message Queue Maximum Size</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobMessageQueueMaximumSize}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job Message Queue Full Action</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobMessageQueueFullAction}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Syntax Check Severity</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.syntaxCheckSeverity}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Job End Severity</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.jobEndSeverity}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Joblog Output</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.joblogOutput}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Inquiry Message Reply</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.inquiryMessageReply}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Message Logging Level</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.messageLoggingLevel}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Message Logging Severity</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.messageLoggingSeverity}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Message Logging Text</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.messageLoggingText}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Log CL Program Commands</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.logClProgramCommands}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Device Recovery Action</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.deviceRecoveryAction}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Time Slice End Pool</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.timeSliceEndPool}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Allow Multiple Threads</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.allowMultipleThreads}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Workload Group</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.workloadGroup}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">ASPGRP</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.aspgrp}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">DDM Conversation</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobDescriptionInfo?.ddmConversation}</vscode-data-grid-cell>
              </vscode-data-grid-row>
            </vscode-data-grid>
            `;

        const libraryListTab = `<h1>Library list</h1>
            <vscode-data-grid>
              <vscode-data-grid-row row-type="header">
                <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Sequence</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Library</b></vscode-data-grid-cell>
              </vscode-data-grid-row>
              ${this.jobDescriptionLibraries?.map(library => {
                  return /*html*/`
                  <vscode-data-grid-row>
                    <vscode-data-grid-cell grid-column="1">${library.sequence}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="2">${library.library}</vscode-data-grid-cell>
                  </vscode-data-grid-row>`;
                }).join("")}
            </vscode-data-grid>
            `;

        const panels = /*html*/`
            <vscode-panels>
                <vscode-panel-tab id="tab-1">
                  DESCRIPTION
                </vscode-panel-tab>
                <vscode-panel-tab id="tab-2">
                  LIBRARY LIST
                  <vscode-badge appearance="secondary">${this.jobDescriptionLibraries?.length ? this.jobDescriptionLibraries?.length: 0}</vscode-badge>
                </vscode-panel-tab>
                <vscode-panel-view id="view-1">${descriptionTab}</vscode-panel-view>
                <vscode-panel-view id="view-2">${libraryListTab}</vscode-panel-view>
            </vscode-panels>`;

        return panels;
    }

    // We do the same action when use the button or Save document
    async handleAction(data: any): Promise<HandleActionResult> {
        // Nothing to do
        return {
            dirty: true
        };
    }

    async save(): Promise<void> {
        // Nothing to do
    }

    private async getLibraryList(): Promise<JobDescriptionLibrary[] | undefined> {
        let jobDescriptionLibraries: JobDescriptionLibrary[] = [];
        if(this.jobDescriptionInfo!.libraryListCount > 0){
            for (let index = 0; index < this.jobDescriptionInfo!.libraryListCount; index++) {
                const start = index*10+index*1;
                const library = this.jobDescriptionInfo!.libraryList.substring(start, start+11);
                const sequence = (index+1)*10;
                jobDescriptionLibraries.push({sequence, library});
            }
        }
        return jobDescriptionLibraries;
    }
}