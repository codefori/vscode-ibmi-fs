import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';
import { Components } from "../webviewToolkit";

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

interface QueueJob {
    jobName: string
    jobUser: string
    jobNumber: string
    jobDescriptionLibrary: string
    jobDescription: string
    jobScheduledTime: string
}

export class JobQueue extends Base {
    private jobQueueInfo: Record<string, string> = {};
    private scheduledJobs: ScheduledJob[] | undefined = [];
    private queueJobs: QueueJob[] | undefined = [];

    async fetch(): Promise<void> {
        const connection = Code4i.getConnection();
        const content = Code4i.getContent();
        if (connection && content) {
          // Job Description
          const [jobQueueInfo] = await Code4i.getContent().runSQL([`SELECT JOB_QUEUE_NAME "jobQueueName",
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
              ifnull(TEXT_DESCRIPTION, '') "textDescription",
              OPERATOR_CONTROLLED "operatorControlled",
              AUTHORITY_TO_CHECK "authorityToCheck"
          FROM QSYS2.JOB_QUEUE_INFO
          where JOB_QUEUE_LIBRARY = '${this.library}' AND JOB_QUEUE_NAME = '${this.name}' LIMIT 1`].join(` `));

          if (jobQueueInfo) {
            this.jobQueueInfo["Name"] = String(jobQueueInfo.jobQueueName);
            this.jobQueueInfo["Library"] = String(jobQueueInfo.jobQueueLibrary);
            this.jobQueueInfo["Status"] = String(jobQueueInfo.jobQueueStatus);
            this.jobQueueInfo["Number of jobs"] = String(jobQueueInfo.numberOfJobs);
            this.jobQueueInfo["Subsytem name"] = String(jobQueueInfo.subsystemName);
            this.jobQueueInfo["Subsystem library"] = String(jobQueueInfo.subsystemLibraryName);
            this.jobQueueInfo["Sequence number"] = String(jobQueueInfo.sequenceNumber);
            this.jobQueueInfo["Maximum active job"] = String(jobQueueInfo.maximumActiveJobs);
            this.jobQueueInfo["Active jobs"] = String(jobQueueInfo.activeJobs);
            this.jobQueueInfo["Held jobs"] = String(jobQueueInfo.heldJobs);
            this.jobQueueInfo["Released jobs"] = String(jobQueueInfo.releasedJobs);
            this.jobQueueInfo["Schedules jobs"] = String(jobQueueInfo.scheduledJobs);
            this.jobQueueInfo["Description"] = String(jobQueueInfo.textDescription);
            this.jobQueueInfo["Operator controlled"] = String(jobQueueInfo.operatorControlled);
            this.jobQueueInfo["Authority to check"] = String(jobQueueInfo.authorityToCheck);
          }

          // Scheduled jobs
          const scheduledJobs = await Code4i.getContent().runSQL([`SELECT SCHEDULED_JOB_NAME "scheduledJobName",
              SCHEDULED_DATE_VALUE "scheduledDateValue",
              ifnull(cast(SCHEDULED_DATE as char(19)), '') "scheduledDate",
              SCHEDULED_TIME "scheduledTime",
              SCHEDULED_DAYS "scheduledDays",
              FREQUENCY "frequency",
              ifnull(RELATIVE_DAYS_OF_MONTH, '') "relativeDaysOfMonth",
              NEXT_SUBMISSION_DATE "nextSubmissionDate",
              STATUS "status",
              ifnull(DESCRIPTION, '') "description"
          FROM QSYS2.SCHEDULED_JOB_INFO
          WHERE JOB_QUEUE_NAME = '${this.name}'
              AND JOB_QUEUE_LIBRARY_NAME = '${this.library}'`].join(` `));

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
              description: String(row.description)
            }));
            this.scheduledJobs = resultsScheduledJobs;
          }

          // Jobs in queue
          const queueJobs = await Code4i.getContent().runSQL([`SELECT 
            x.JOB_NAME_SHORT "jobName",
            x.JOB_USER "jobUser",
            x.JOB_NUMBER "jobNumber",
            x.JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
            x.JOB_DESCRIPTION "jobDescription",
            x.JOB_SCHEDULED_TIME "jobScheduledTime"
          FROM TABLE ( QSYS2.JOB_INFO(JOB_STATUS_FILTER => '*JOBQ', JOB_USER_FILTER => '*ALL') ) x
          WHERE JOB_QUEUE_NAME = '${this.name}'
              AND JOB_QUEUE_LIBRARY = '${this.library}' ORDER BY JOB_NAME_SHORT`].join(` `));
          if (queueJobs && queueJobs.length > 0){
            const resultsQueueJobs: QueueJob[] = queueJobs.map(row => ({
              jobName: String(row.jobName),
              jobUser: String(row.jobUser),
              jobNumber: String(row.jobNumber),
              jobDescriptionLibrary: String(row.jobDescriptionLibrary),
              jobDescription: String(row.jobDescription),
              jobScheduledTime: String(row.jobScheduledTime)
            }));
            this.queueJobs = resultsQueueJobs;
          }

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
      }, Object.entries(this.jobQueueInfo))}`;

      const scheduledTab = /* html */ `
        ${Components.dataGrid<ScheduledJob>({
            columns: [
                { title: "Job name", cellValue: l => String(l.scheduledJobName) },
                { title: "Date value", cellValue: l => l.scheduledDateValue },
                { title: "Date", cellValue: l => l.scheduledDate },
                { title: "Time", cellValue: l => l.scheduledTime },
                { title: "Days", cellValue: l => l.scheduledDays },
                { title: "Frequency", cellValue: l => l.frequency },
                { title: "Relative days of month", cellValue: l => l.relativeDaysOfMonth },
                { title: "Next submission date", cellValue: l => l.nextSubmissionDate },
                { title: "Status", cellValue: l => l.status },
                { title: "Description", cellValue: l => l.description }
            ]
        }, this.scheduledJobs!)}`;

      const queueJobsTab = /* html */ `
        ${Components.dataGrid<QueueJob>({
            columns: [
                { title: "Job name", cellValue: l => String(l.jobName) },
                { title: "Job user", cellValue: l => l.jobUser },
                { title: "Job number", cellValue: l => l.jobNumber },
                { title: "JOBD Library", cellValue: l => l.jobDescriptionLibrary },
                { title: "JOBD", cellValue: l => l.jobDescription },
                { title: "Scheduled time", cellValue: l => l.jobScheduledTime }
            ]
        }, this.queueJobs!)}`;

      const panels = Components.panels([
        { title: "DESCRIPTION", content: descriptionTab },
        { title: "SCHEDULED", content: scheduledTab, badge: this.scheduledJobs?.length ? this.scheduledJobs?.length : 0 },
        { title: "QUEUE JOB", content: queueJobsTab, badge: this.queueJobs?.length ? this.queueJobs?.length : 0 }
      ]);

      return panels;
    }

    // We do the same action when use the button or Save document
    async handleAction(data: any): Promise<HandleActionResult> {
        // Nothing to do
        return { };
    }

    async save(): Promise<void> {
        // Nothing to do
    }

}