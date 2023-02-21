import * as vscode from 'vscode';
import Base from "./base";
import { Code4i } from '../tools';
import { Components } from "../webviewToolkit";

interface ActiveJobInfo {
    jobName: string
    jobNameShort: string
    jobUser: string
    jobNumber: string
    jobInformation: string
    jobStatus: string
    jobType: string
    jobTypeEnhanced: string
    jobSubsystem: string
    jobDate: string
    jobDescriptionLibrary: string
    jobDescription: string
    jobAccountingCode: string
    submitterJobName: string
    submitterMessageQueueLibrary: string
    submitterMessageQueue: string
    serverType: string
    jobEnteredSystemTime: string
    jobScheduledTime: string
    jobActiveTime: string
    jobEndTime: string
    jobEndSeverity: string
    completionStatus: string
}

interface AutostartJobInfo {
    subsystemDescriptionLibrary: string
    subsystemDescription: string
    autostartJobName: string
    jobDescriptionLibrary: string
    jobDescription: string
}

interface PrestartJobInfo {
    subsystemDescriptionLibrary: string
    subsystemDescription: string
    prestartJobProgramLibrary: string
    prestartJobProgram: string
    subsystemActive: string
    userProfile: string
    prestartJobName: string
    jobDescriptionLibrary: string
    jobDescription: string
    startJobs: string
    initialJobs: number
}

interface RoutingEntryInfo {
    subsystemDescriptionLibrary: string
    subsystemDescription: string
    sequenceNumber: number
    programLibrary: string
    programName: string
    classLibrary: string
    class: string
    maximumSteps: number
    poolId: number
    comparisonData: string
    comparisonStart: number
}

export class SubSystem extends Base {
    private subSystemInfo: Record<string, string> = {};
    private activeJobsInfo: ActiveJobInfo[] | undefined;
    private autostartJobsInfo: AutostartJobInfo[] | undefined;
    private prestartJobsInfo: PrestartJobInfo[] | undefined;
    private routingEntriesInfo: RoutingEntryInfo[] | undefined;

    async fetch(): Promise<void> {
        const connection = Code4i.getConnection();
        const content = Code4i.getContent();
        if (connection && content) {
            // Subsystem Description
            const [subSystemInfo] = await Code4i.getContent().runSQL([`SELECT ifnull(SUBSYSTEM_DESCRIPTION_LIBRARY, '') "subsystemDescriptionLibrary",
                ifnull(SUBSYSTEM_DESCRIPTION, '') "subsystemDescription",
                ifnull(STATUS, '') "status",
                ifnull(MAXIMUM_ACTIVE_JOBS, 0) "maximumActiveJobs",
                ifnull(CURRENT_ACTIVE_JOBS, 0) "currentActiveJobs",
                ifnull(SUBSYSTEM_MONITOR_JOB, '') "subsystemMonitorJob",
                ifnull(TEXT_DESCRIPTION, '') "textDescription",
                ifnull(CONTROLLING_SUBSYSTEM, '') "controllingSubsystem",
                ifnull(WORKLOAD_GROUP, '') "workloadGroup",
                ifnull(SIGNON_DEVICE_FILE_LIBRARY, '') "signonDeviceFileLibrary",
                ifnull(SIGNON_DEVICE_FILE, '') "signonDeviceFile",
                ifnull(SECONDARY_LANGUAGE_LIBRARY, '') "secondaryLanguageLibrary",
                ifnull(IASP_NAME, '') "iaspName"
            FROM QSYS2.SUBSYSTEM_INFO 
            where SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}' AND SUBSYSTEM_DESCRIPTION = '${this.name}' LIMIT 1`].join(` `));

            if (subSystemInfo) {
                this.subSystemInfo["Library"] = String(subSystemInfo.subsystemDescriptionLibrary);
                this.subSystemInfo["Description"] = String(subSystemInfo.textDescription);
                this.subSystemInfo["Status"] = String(subSystemInfo.status);
                this.subSystemInfo["Monitor job"] = String(subSystemInfo.subsystemMonitorJob);
                this.subSystemInfo["Maximum active job"] = String(subSystemInfo.maximumActiveJobs);
                this.subSystemInfo["Current active job"] = String(subSystemInfo.currentActiveJobs);
                this.subSystemInfo["Controlling subsystem"] = String(subSystemInfo.controllingSubsystem);
                this.subSystemInfo["Workload group"] = String(subSystemInfo.workloadGroup);
                this.subSystemInfo["Signon device file library"] = String(subSystemInfo.signonDeviceFileLibrary);
                this.subSystemInfo["Signon device file"] = String(subSystemInfo.signonDeviceFile);
                this.subSystemInfo["Secondary language library"] = String(subSystemInfo.secondaryLanguageLibrary);
                this.subSystemInfo["iASP"] = String(subSystemInfo.iaspName);
            }

            // Active job
            try {
              const activeJobsInfo = await Code4i.getContent().runSQL([`SELECT ifnull(X.JOB_NAME, '') jobName,
                  ifnull(X.JOB_NAME_SHORT, '') "jobNameShort",
                  ifnull(X.JOB_USER, '') "jobUser",
                  ifnull(X.JOB_NUMBER, '') "jobNumber",
                  ifnull(X.JOB_INFORMATION, '') "jobInformation",
                  ifnull(X.JOB_STATUS, '') "jobStatus",
                  ifnull(X.JOB_TYPE, '') "jobType",
                  ifnull(X.JOB_TYPE_ENHANCED, '') "jobTypeEnhanced",
                  ifnull(X.JOB_SUBSYSTEM, '') "jobSubsystem",
                  ifnull(X.JOB_DATE, '') "jobDate",
                  ifnull(X.JOB_DESCRIPTION_LIBRARY, '') "jobDescriptionLibrary",
                  ifnull(X.JOB_DESCRIPTION, '') "jobDescription",
                  ifnull(X.JOB_ACCOUNTING_CODE, '') "jobAccountingCode",
                  ifnull(X.SUBMITTER_JOB_NAME, '') "submitterJobName",
                  ifnull(X.SUBMITTER_MESSAGE_QUEUE_LIBRARY, '') "submitterMessageQueueLibrary",
                  ifnull(X.SUBMITTER_MESSAGE_QUEUE, '') "submitterMessageQueue",
                  ifnull(X.SERVER_TYPE, '') "serverType",
                  X.JOB_ENTERED_SYSTEM_TIME "jobEnteredSystemTime",
                  X.JOB_SCHEDULED_TIME "jobScheduledTime",
                  X.JOB_ACTIVE_TIME "jobActiveTime",
                  X.JOB_END_TIME "jobEndTime",
                  ifnull(X.JOB_END_SEVERITY, '') "jobEndSeverity",
                  ifnull(X.COMPLETION_STATUS, '') "completionStatus"
              FROM TABLE (QSYS2.JOB_INFO(JOB_SUBSYSTEM_FILTER => '${this.name}', JOB_USER_FILTER => '*ALL')) X;`].join(` `));

              if (activeJobsInfo && activeJobsInfo.length > 0) {
                  const resultActiveJobInfo: ActiveJobInfo[] = activeJobsInfo.map(row => ({
                      jobName: String(row.jobName),
                      jobNameShort: String(row.jobNameShort),
                      jobUser: String(row.jobUser),
                      jobNumber: String(row.jobNumber),
                      jobInformation: String(row.jobInformation),
                      jobStatus: String(row.jobStatus),
                      jobType: String(row.jobType),
                      jobTypeEnhanced: String(row.jobTypeEnhanced),
                      jobSubsystem: String(row.jobSubsystem),
                      jobDate: String(row.jobDate),
                      jobDescriptionLibrary: String(row.jobDescriptionLibrary),
                      jobDescription: String(row.jobDescription),
                      jobAccountingCode: String(row.jobAccountingCode),
                      submitterJobName: String(row.submitterJobName),
                      submitterMessageQueueLibrary: String(row.submitterMessageQueueLibrary),
                      submitterMessageQueue: String(row.submitterMessageQueue),
                      serverType: String(row.serverType),
                      jobEnteredSystemTime: String(row.jobEnteredSystemTime),
                      jobScheduledTime: String(row.jobScheduledTime),
                      jobActiveTime: String(row.jobActiveTime),
                      jobEndTime: String(row.jobEndTime),
                      jobEndSeverity: String(row.jobEndSeverity),
                      completionStatus: String(row.completionStatus)
                  }));
                  this.activeJobsInfo = resultActiveJobInfo;
              }
            } catch (error) {
              
            }

            // Autostart job
            const autostartJobsInfo = await Code4i.getContent().runSQL([`SELECT SUBSYSTEM_DESCRIPTION_LIBRARY "subsystemDescriptionLibrary",
                SUBSYSTEM_DESCRIPTION "subsystemDescription",
                AUTOSTART_JOB_NAME "autostartJobName",
                JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
                JOB_DESCRIPTION "jobDescription"
            FROM QSYS2.AUTOSTART_JOB_INFO  
            where SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}' AND SUBSYSTEM_DESCRIPTION = '${this.name}' ORDER BY 1, 2, 3`].join(` `));

            if (autostartJobsInfo && autostartJobsInfo.length > 0) {
                const resultAutostartJobsInfo: AutostartJobInfo[] = autostartJobsInfo.map(row => ({
                    subsystemDescriptionLibrary: String(row.subsystemDescriptionLibrary),
                    subsystemDescription: String(row.subsystemDescription),
                    autostartJobName: String(row.autostartJobName),
                    jobDescriptionLibrary: String(row.jobDescriptionLibrary),
                    jobDescription: String(row.jobDescription)
                }));
                this.autostartJobsInfo = resultAutostartJobsInfo;
            }

            // Prestart job
            const prestartJobsInfo = await Code4i.getContent().runSQL([`SELECT SUBSYSTEM_DESCRIPTION_LIBRARY "subsystemDescriptionLibrary",
                SUBSYSTEM_DESCRIPTION "subsystemDescription",
                PRESTART_JOB_PROGRAM_LIBRARY "prestartJobProgramLibrary",
                PRESTART_JOB_PROGRAM "prestartJobProgram",
                SUBSYSTEM_ACTIVE "subsystemActive",
                USER_PROFILE "userProfile",
                PRESTART_JOB_NAME "prestartJobName",
                JOB_DESCRIPTION_LIBRARY "jobDescriptionLibrary",
                JOB_DESCRIPTION "jobDescription",
                START_JOBS "startJobs",
                INITIAL_JOBS "initialJobs"
            FROM QSYS2.PRESTART_JOB_INFO  
            where SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}' AND SUBSYSTEM_DESCRIPTION = '${this.name}' ORDER BY 1, 2, 3`].join(` `));

            if (prestartJobsInfo && prestartJobsInfo.length > 0) {
                const resultPrestartJobsInfo: PrestartJobInfo[] = prestartJobsInfo.map(row => ({
                    subsystemDescriptionLibrary: String(row.subsystemDescriptionLibrary),
                    subsystemDescription: String(row.subsystemDescription),
                    prestartJobProgramLibrary: String(row.prestartJobProgramLibrary),
                    prestartJobProgram: String(row.prestartJobProgram),
                    subsystemActive: String(row.subsystemActive),
                    userProfile: String(row.userProfile),
                    prestartJobName: String(row.prestartJobName),
                    jobDescriptionLibrary: String(row.jobDescriptionLibrary),
                    jobDescription: String(row.jobDescription),
                    startJobs: String(row.startJobs),
                    initialJobs: Number(row.initialJobs),
                }));
                this.prestartJobsInfo = resultPrestartJobsInfo;
            }

            // Routing entries
            const routingEntriesInfo = await Code4i.getContent().runSQL([`SELECT SUBSYSTEM_DESCRIPTION_LIBRARY "subsystemDescriptionLibrary",
                SUBSYSTEM_DESCRIPTION "subsystemDescription",
                ifnull(SEQUENCE_NUMBER, 0) "sequenceNumber",
                ifnull(PROGRAM_LIBRARY, '') "programLibrary",
                ifnull(PROGRAM_NAME, '') "programName",
                ifnull(CLASS_LIBRARY, '') "classLibrary",
                ifnull(CLASS, '') "class",
                ifnull(MAXIMUM_STEPS, 0) "maximumSteps",
                ifnull(POOL_ID, 0) "poolId",
                ifnull(COMPARISON_DATA, '') "comparisonData",
                ifnull(COMPARISON_START, 0) "comparisonStart"
            FROM QSYS2.ROUTING_ENTRY_INFO  
            where SUBSYSTEM_DESCRIPTION_LIBRARY = '${this.library}' AND SUBSYSTEM_DESCRIPTION = '${this.name}' ORDER BY 1, 2, 3`].join(` `));

            if (routingEntriesInfo && routingEntriesInfo.length > 0) {
                const resultRoutingEntryInfo: RoutingEntryInfo[] = routingEntriesInfo.map(row => ({
                    subsystemDescriptionLibrary: String(row.subsystemDescriptionLibrary),
                    subsystemDescription: String(row.subsystemDescription),
                    sequenceNumber: Number(row.sequenceNumber),
                    programLibrary: String(row.programLibrary),
                    programName: String(row.programName),
                    classLibrary: String(row.classLibrary),
                    class: String(row.class),
                    maximumSteps: Number(row.maximumSteps),
                    poolId: Number(row.poolId),
                    comparisonData: String(row.comparisonData),
                    comparisonStart: Number(row.comparisonStart),
                }));
                this.routingEntriesInfo = resultRoutingEntryInfo;
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
      }, Object.entries(this.subSystemInfo))}`;

        const activeJobTab = `
            <vscode-data-grid>
              <vscode-data-grid-row row-type="header">
                <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Name</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>User</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Number</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Information ?</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Status</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>Type</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Date</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Library</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>JOBD</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>Accounting code</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="11"><b>Entered system time</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="12"><b>Scheduled time</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="13"><b>Active time</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="14"><b>End time</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="15"><b>End severity</b></vscode-data-grid-cell>
                <vscode-data-grid-cell cell-type="columnheader" grid-column="16"><b>Completion status</b></vscode-data-grid-cell>
              </vscode-data-grid-row>
              ${this.activeJobsInfo?.map(activeJobInfo => {
                  return /*html*/`
                  <vscode-data-grid-row>
                    <vscode-data-grid-cell grid-column="1">${activeJobInfo.jobNameShort}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="2">${activeJobInfo.jobUser}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="3">${activeJobInfo.jobNumber}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="4">${activeJobInfo.jobInformation}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="5">${activeJobInfo.jobStatus}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="6">${activeJobInfo.jobTypeEnhanced}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="7">${activeJobInfo.jobDate}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="8">${activeJobInfo.jobDescriptionLibrary}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="9">${activeJobInfo.jobDescription}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="10">${activeJobInfo.jobAccountingCode}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="11">${activeJobInfo.jobEnteredSystemTime}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="12">${activeJobInfo.jobScheduledTime}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="13">${activeJobInfo.jobActiveTime}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="14">${activeJobInfo.jobEndTime}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="15">${activeJobInfo.jobEndSeverity}</vscode-data-grid-cell>
                    <vscode-data-grid-cell grid-column="16">${activeJobInfo.completionStatus}</vscode-data-grid-cell>
                  </vscode-data-grid-row>`;
                }).join("")}
            </vscode-data-grid>
        `;

        const autostartTab = `
          <vscode-data-grid>
            <vscode-data-grid-row row-type="header">
            <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Description</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Job name</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>JOBD Library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>JOBD</b></vscode-data-grid-cell>
          </vscode-data-grid-row>
          ${this.autostartJobsInfo?.map(autostartJobInfo => {
              return /*html*/`
              <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">${autostartJobInfo.subsystemDescriptionLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${autostartJobInfo.subsystemDescription}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="3">${autostartJobInfo.autostartJobName}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="4">${autostartJobInfo.jobDescriptionLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="5">${autostartJobInfo.jobDescription}</vscode-data-grid-cell>
              </vscode-data-grid-row>`;
            }).join("")}
          </vscode-data-grid>
        `;

        const prestartTab = `
          <vscode-data-grid>
            <vscode-data-grid-row row-type="header">
            <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Description</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Program library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Program</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Subsystem active</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>User profile</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Job name</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Job description</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>Start jobs</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="11"><b>Initial jobs</b></vscode-data-grid-cell>
          </vscode-data-grid-row>
          ${this.prestartJobsInfo?.map(prestartJobInfo => {
            return /*html*/`
            <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">${prestartJobInfo.subsystemDescriptionLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${prestartJobInfo.subsystemDescription}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="3">${prestartJobInfo.prestartJobProgramLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="4">${prestartJobInfo.prestartJobProgram}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="5">${prestartJobInfo.subsystemActive}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="6">${prestartJobInfo.userProfile}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="7">${prestartJobInfo.prestartJobName}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="8">${prestartJobInfo.jobDescriptionLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="9">${prestartJobInfo.jobDescription}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="10">${prestartJobInfo.startJobs}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="11">${prestartJobInfo.initialJobs}</vscode-data-grid-cell>
            </vscode-data-grid-row>`;
            }).join("")}
          </vscode-data-grid>
        `;

        const routingTab = `
            <vscode-data-grid>
            <vscode-data-grid-row row-type="header">
            <vscode-data-grid-cell cell-type="columnheader" grid-column="1"><b>Library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="2"><b>Description</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="3"><b>Number</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="4"><b>Program library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="5"><b>Program</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="6"><b>Class library</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="7"><b>Class</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="8"><b>Maximum steps</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="9"><b>Pool id</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="10"><b>Comparison data</b></vscode-data-grid-cell>
            <vscode-data-grid-cell cell-type="columnheader" grid-column="11"><b>Comparison start</b></vscode-data-grid-cell>
        </vscode-data-grid-row>
        ${this.routingEntriesInfo?.map(routingEntrieInfo => {
            return /*html*/`
            <vscode-data-grid-row>
                <vscode-data-grid-cell grid-column="1">${routingEntrieInfo.subsystemDescriptionLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="2">${routingEntrieInfo.subsystemDescription}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="3">${routingEntrieInfo.sequenceNumber}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="4">${routingEntrieInfo.programLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="5">${routingEntrieInfo.programName}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="6">${routingEntrieInfo.classLibrary}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="7">${routingEntrieInfo.class}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="8">${routingEntrieInfo.maximumSteps}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="9">${routingEntrieInfo.poolId}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="10">${routingEntrieInfo.comparisonData}</vscode-data-grid-cell>
                <vscode-data-grid-cell grid-column="11">${routingEntrieInfo.comparisonStart}</vscode-data-grid-cell>
            </vscode-data-grid-row>`;
            }).join("")}
        </vscode-data-grid>
        `;

        const panels = Components.panels([
          { title: "DESCRIPTION", content: descriptionTab },
          { title: "ACTIVE JOB", content: activeJobTab, badge: this.activeJobsInfo?.length ? this.activeJobsInfo?.length : 0 },
          { title: "AUTOSTART JOB", content: autostartTab, badge: this.autostartJobsInfo?.length ? this.autostartJobsInfo?.length : 0 },
          { title: "PRESTART JOB", content: prestartTab, badge: this.prestartJobsInfo?.length ? this.prestartJobsInfo?.length : 0 },
          { title: "ROUTING ENTRY", content: routingTab, badge: this.routingEntriesInfo?.length ? this.routingEntriesInfo?.length : 0 }
        ]);

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