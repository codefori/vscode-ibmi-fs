import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';

interface JobQueueInfo {
    jobQueueName: string
    jobQueueLibrary: string
    jobQueueStatus: string
    numberOfJobs: number
    subsystemName: string
    subsystemLibraryName: string
    sequenceNumber: number
    maximumActiveJobs: number
    activeJobs: number
    heldJobs: number
    releasedJobs: number
    scheduledJobs: number
    textDescription: string
    operatorControlled: string
    authorityToCheck: string
}

interface ScheduledJob {
    scheduledJobName: string
    scheduledDateValue: string
    scheduledDate: string
    scheduledTime: string
    scheduledDays: string
    frequency: string
    relativeDaysOfMonth: string
    nextSubmissionDate: string
    status: string
    description: string
}

export class JobQueue extends Base {
    private jobQueueInfo: JobQueueInfo | undefined;
    private scheduledJobs: ScheduledJob[] | undefined;

    async fetch(): Promise<void> {
        const connection = Code4i.getConnection();
        const content = Code4i.getContent();
        if (connection && content) {
            // Job Description
            const jobDescriptionInfo = await Code4i.getContent().runSQL([`SELECT JOB_QUEUE_NAME "jobQueueName",
                JOB_QUEUE_LIBRARY "jobQueueLibrary",
                JOB_QUEUE_STATUS "jobQueueStatus",
                NUMBER_OF_JOBS "numberOfJobs",
                SUBSYSTEM_NAME "subsystemName",
                SUBSYSTEM_LIBRARY_NAME "subsystemLibraryName",
                SEQUENCE_NUMBER "sequenceNumber",
                MAXIMUM_ACTIVE_JOBS "maximumActiveJobs",
                ACTIVE_JOBS "activeJobs",
                HELD_JOBS "heldJobs",
                RELEASED_JOBS "releasedJobs",
                SCHEDULED_JOBS "scheduledJobs",
                TEXT_DESCRIPTION "textDescription",
                OPERATOR_CONTROLLED "operatorControlled",
                AUTHORITY_TO_CHECK "authorityToCheck"
            FROM QSYS2.JOB_QUEUE_INFO
            where JOB_QUEUE_LIBRARY = '${this.library}' AND JOB_QUEUE_NAME = '${this.name}' LIMIT 1`].join(` `));

            if (jobDescriptionInfo && jobDescriptionInfo.length > 0) {
                const resultJobQueueInfo: JobQueueInfo[] = jobDescriptionInfo.map(row => ({
                    jobQueueName: String(row.jobQueueName),
                    jobQueueLibrary: String(row.jobQueueLibrary),
                    jobQueueStatus: String(row.jobQueueStatus),
                    numberOfJobs: Number(row.numberOfJobs),
                    subsystemName: String(row.subsystemName),
                    subsystemLibraryName: String(row.subsystemLibraryName),
                    sequenceNumber: Number(row.sequenceNumber),
                    maximumActiveJobs: Number(row.maximumActiveJobs),
                    activeJobs: Number(row.activeJobs),
                    heldJobs: Number(row.heldJobs),
                    releasedJobs: Number(row.releasedJobs),
                    scheduledJobs: Number(row.scheduledJobs),
                    textDescription: String(row.textDescription),
                    operatorControlled: String(row.operatorControlled),
                    authorityToCheck: String(row.authorityToCheck)
                }));
                this.jobQueueInfo = resultJobQueueInfo[0];
            }

            // Scheduled jobs
            const scheduledJobs = await Code4i.getContent().runSQL([`SELECT SCHEDULED_JOB_NAME "scheduledJobName",
                SCHEDULED_DATE_VALUE "scheduledDateValue",
                SCHEDULED_DATE "scheduledDate",
                SCHEDULED_TIME "scheduledTime",
                SCHEDULED_DAYS "scheduledDays",
                FREQUENCY "frequency",
                ifnull(RELATIVE_DAYS_OF_MONTH, '') "relativeDaysOfMonth",
                NEXT_SUBMISSION_DATE "nextSubmissionDate",
                STATUS "status",
                DESCRIPTION "description"
            FROM QSYS2.SCHEDULED_JOB_INFO
            WHERE JOB_QUEUE_NAME = '${this.name}'
                AND JOB_QUEUE_LIBRARY_NAME = '${this.library}';`].join(` `));
            if (scheduledJobs && scheduledJobs.length > 0){
                const resultsScheduledJobs: ScheduledJob[] = scheduledJobs.map(row => ({
                  scheduledJobName: String(row.scheduledJobName),
                  scheduledDateValue: String(row.scheduledDateValue),
                  scheduledDate: String(row.scheduledDate),
                  scheduledTime: String(row.scheduledTime),
                  scheduledDays: String(row.scheduledDays),
                  frequency: String(row.frequency),
                  relativeDaysOfMonth: String(row.relativeDaysOfMonth),
                  nextSubmissionDate: String(row.nextSubmissionDate),
                  status: String(row.status),
                  description: String(row.description),
                }));
                this.scheduledJobs = resultsScheduledJobs;
            }

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
                <vscode-data-grid-cell grid-column="1">Name</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.jobQueueName}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Library</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.jobQueueLibrary}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Status</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.jobQueueStatus}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Number of jobs</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.numberOfJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Subsytem name</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.subsystemName}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Subsystem library</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.subsystemLibraryName}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Sequence number</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.sequenceNumber}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Maximum active job</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.maximumActiveJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Active jobs</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.activeJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Held jobs</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.heldJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Released jobs</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.releasedJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Schedules jobs</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.scheduledJobs}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Description</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.textDescription}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Operator controlled</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.operatorControlled}</vscode-data-grid-cell>
              </vscode-data-grid-row>
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">Authority to check</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${this.jobQueueInfo?.authorityToCheck}</vscode-data-grid-cell>
              </vscode-data-grid-row>
            </vscode-data-grid>
            `;

        const scheduledTab = `<h1>Library list</h1>
            <vscode-data-grid>
              <vscode-data-grid-row row-type="header">
                <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Job name</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Date value</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Date</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Time</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Days</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>Frequency</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Relative days of month</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Next submission date</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Status</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>Description</b></vscode-data-grid-cell>
              </vscode-data-grid-row>
              ${this.scheduledJobs?.map(scheduledJob => {
                  return /*html*/`
                  <vscode-data-grid-row>
                    <vscode-data-grid-cell grid-column="1">${scheduledJob.scheduledJobName}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="2">${scheduledJob.scheduledDateValue}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="3">${scheduledJob.scheduledDate}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="4">${scheduledJob.scheduledTime}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="5">${scheduledJob.scheduledDays}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="6">${scheduledJob.frequency}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="7">${scheduledJob.relativeDaysOfMonth}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="8">${scheduledJob.nextSubmissionDate}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="9">${scheduledJob.status}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="10">${scheduledJob.description}</vscode-data-grid-cell>
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
                  SCHEDULED
                  <vscode-badge appearance="secondary">${this.scheduledJobs?.length ? this.scheduledJobs?.length: 0}</vscode-badge>
                </vscode-panel-tab>
                <vscode-panel-view id="view-1">${descriptionTab}</vscode-panel-view>
                <vscode-panel-view id="view-2">${scheduledTab}</vscode-panel-view>
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

}