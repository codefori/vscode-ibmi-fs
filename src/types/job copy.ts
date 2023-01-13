import { getBase } from "../tools";
import * as vscode from 'vscode';
import Base from "./base";
import { Components } from "../webviewToolkit";

interface JobPropertie {
  jobName: string
  jobNameShort: string
  jobUser: string
  jobNumber: string
  jobStatus: string
  currentUser: string
  typeEnhanced: string
  enteredSystemTime: string
  activeTime: string
  jobDescription: string
  submitterJobName: string
  outputQueue: string
  dateFormat: string
  dateSeparator: string
  timeSeparator: string
  decimalFormat: string
  languageID: string
  countryID: string
  sortSequence: string
  ccsid: string
}

interface JobHistory {
  timestamp: string
  messageId: string
  severity: string
  texte: string
}

interface JobChange {
  jobName: string
  jobUser: string
  jobNumber: string
  jobpty: string
  outpty: string
  prtdev: string
  outq: string
  runpty: string
  jobq: string
  prttxt: string
  log: string
  logclpgm: string
  logoutput: string
  jobmsgqfl: string
  inqmsgrpy: string
  brkmsg: string
  stsmsg: string
  ddmcnv: string
  scddate: string
  scdtime: string
  date: string
  datfmt: string
  datsep: string
  timsep: string
  sws: string
  timeslice: string
  purge: string
  dftwait: string
  devrcyacn: string
  tsepool: string
  prtkeyfmt: string
  srtseq: string
  langid: string
  cntryid: string
  ccsid: string
  decfmt: string
  chridctl: string
  splfacn: string
  wlcgrp: string
  cputime: string
  maxtmpstg: string
  prcrscpty: string
  dupjobopt: string
}

export class JobProperties extends Base {
  private jobPropertie: JobPropertie = {
    jobName: "",
    jobNameShort: "",
    jobUser: "",
    jobNumber: "",
    jobStatus: "",
    currentUser: "",
    typeEnhanced: "",
    enteredSystemTime: "",
    activeTime: "",
    jobDescription: "",
    submitterJobName: "",
    outputQueue: "",
    dateFormat: "",
    dateSeparator: "",
    timeSeparator: "",
    decimalFormat: "",
    languageID: "",
    countryID: "",
    sortSequence: "",
    ccsid: ""
  };

  private jobHistory: JobHistory[] | undefined;

  private jobChange: JobChange = {
    jobName : "",
    jobUser : "",
    jobNumber : "",
    jobpty : "*SAME",
    outpty : "*SAME",
    prtdev : "*SAME",
    outq : "*SAME",
    runpty : "*SAME",
    jobq : "*SAME",
    prttxt : "*SAME",
    log : "*SAME",
    logclpgm : "*SAME",
    logoutput : "*SAME",
    jobmsgqfl : "*SAME",
    inqmsgrpy : "*SAME",
    brkmsg : "*SAME",
    stsmsg : "*SAME",
    ddmcnv : "*SAME",
    scddate : "*SAME",
    scdtime : "*SAME",
    date : "*SAME",
    datfmt : "*SAME",
    datsep : "*SAME",
    timsep : "*SAME",
    sws : "*SAME",
    timeslice : "*SAME",
    purge : "*SAME",
    dftwait : "*SAME",
    devrcyacn : "*SAME",
    tsepool : "*SAME",
    prtkeyfmt : "*SAME",
    srtseq : "*SAME",
    langid : "*SAME",
    cntryid : "*SAME",
    ccsid : "*SAME",
    decfmt : "*SAME",
    chridctl : "*SAME",
    splfacn : "*SAME",
    wlcgrp : "*SAME",
    cputime : "*SAME",
    maxtmpstg : "*SAME",
    prcrscpty : "*SAME",
    dupjobopt : "*SELECT"
  };

  async fetch(): Promise<void> {

    const instance = getBase();
    const connection = instance.getConnection();
    const content = instance.getContent();
    if (connection && content) {

      // Retrieve Job Properties
      const properties: Record<string, string | object | null>[] = (await vscode.commands.executeCommand(`code-for-ibmi.runQuery`, `SELECT IFNULL(x.job_name, '') "jobName", `
        + ` IFNULL(x.JOB_NAME_SHORT, '') "jobNameShort",`
        + ` IFNULL(x.JOB_USER, '') "jobUser",`
        + ` IFNULL(x.JOB_NUMBER, '') "jobNumber",`
        + ` IFNULL(x.job_status, '') "jobStatus",`
        + ` IFNULL(x.job_user, '') "currentUser",`
        + ` IFNULL(x.job_type_enhanced, '') "typeEnhanced",`
        + ` IFNULL(x.job_entered_system_time, '0001-01-01 00:00:00') "enteredSystemTime",`
        + ` IFNULL(x.job_active_time, '0001-01-01 00:00:00') "activeTime",`
        + ` x.job_description_library CONCAT '/' CONCAT x.job_description "jobDescription",`
        + ` IFNULL(x.submitter_job_name, '') "submitterJobName",`
        + ` x.output_queue_library concat '/' concat x.output_queue_name "outputQueue",`
        + ` ifnull(x.date_format, '') "dateFormat",`
        + ` ifnull(x.date_separator, '') "dateSeparator",`
        + ` ifnull(x.time_separator, '') "timeSeparator",`
        + ` ifnull(x.decimal_format, '') "decimalFormat",`
        + ` ifnull(x.language_id, '') "languageID",`
        + ` ifnull(x.country_id, '') "countryID",`
        + ` ifnull(x.sort_sequence_name, '') "sortSequence",`
        + ` x.ccsid "ccsid"`
        + ` FROM TABLE (QSYS2.JOB_INFO()) X`
        + ` where x.job_name = '${this.name}' LIMIT 1`));

      if (properties.length > 0) {
        const [propertie] = properties;
        this.jobPropertie.jobName = propertie.jobName!.toString();
        this.jobPropertie.jobNameShort = propertie.jobNameShort!.toString();
        this.jobChange.jobName = this.jobPropertie.jobNameShort;
        this.jobPropertie.jobUser = propertie.jobUser!.toString();
        this.jobChange.jobUser = this.jobPropertie.jobUser;
        this.jobPropertie.jobNumber = propertie.jobNumber!.toString();
        this.jobChange.jobNumber = this.jobPropertie.jobNumber;
        this.jobPropertie.jobStatus = propertie.jobStatus!.toString();
        this.jobPropertie.currentUser = propertie.currentUser!.toString();
        this.jobPropertie.typeEnhanced = propertie.typeEnhanced!.toString();
        this.jobPropertie.enteredSystemTime = propertie.enteredSystemTime!.toString();
        this.jobPropertie.activeTime = propertie.activeTime!.toString();
        this.jobPropertie.jobDescription = propertie.jobDescription!.toString();
        this.jobPropertie.submitterJobName = propertie.submitterJobName!.toString();
        this.jobPropertie.outputQueue = propertie.outputQueue!.toString();
        this.jobPropertie.dateFormat = propertie.dateFormat!.toString();
        this.jobPropertie.dateSeparator = propertie.dateSeparator!.toString();
        this.jobPropertie.timeSeparator = propertie.timeSeparator!.toString();
        this.jobPropertie.decimalFormat = propertie.decimalFormat!.toString();
        this.jobPropertie.languageID = propertie.languageID!.toString();
        this.jobPropertie.countryID = propertie.countryID!.toString();
        this.jobPropertie.sortSequence = propertie.sortSequence!.toString();
        this.jobPropertie.ccsid = propertie.ccsid!.toString();
      }

      // Retrieve History Job
      this.jobHistory = await <JobHistory[]>content.runSQL([`select message_timestamp "timestamp", ifnull(message_id, '') "messageId", severity "severity", trim(message_text) "texte" from table(qsys2.joblog_info('${this.name}')) a order by ordinal_position desc`].join(` `));

    } else {
      throw new Error("No connection.");
    }
  }

  generateHTML(): string {
    const info = this.jobPropertie!;

    const propertieTab = `<h1>Job properties</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
        <vscode-data-grid-row row-type="header">
          <vscode-data-grid-cell cell-type="columnheader" grid-column="1"></vscode-data-grid-cell>
          <vscode-data-grid-cell cell-type="columnheader" grid-column="2"></vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Status</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.jobStatus}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job name</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.jobNameShort}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Type enhanced</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.typeEnhanced}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Entered in the system</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.enteredSystemTime}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Active time</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.activeTime}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Job description</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.jobDescription}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Submitter job name</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.submitterJobName}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Output queue</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.outputQueue}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Date format</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.dateFormat}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Date separator</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.dateSeparator}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Time separator</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.timeSeparator}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Decimal format</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.decimalFormat}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Language ID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.languageID}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Country ID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.countryID}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">Sort sequence</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.sortSequence}</vscode-data-grid-cell>
        </vscode-data-grid-row>
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">CCSID</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${info?.ccsid}</vscode-data-grid-cell>
        </vscode-data-grid-row>
      </vscode-data-grid>
      `;

      const changeTab = `<h1>Change job</h1><h2><i>${this.name}</i></h2>
      <form>
        <p>${Components.textField("jobName", "Job name", { maxlength: 10, value: info.jobNameShort, disabled: true }, true)}</p>
        <p>${Components.textField("jobUser", "Job user", { maxlength: 10, value: info.jobUser, disabled: true }, true)}</p>
        <p>${Components.textField("jobNumber", "Job number", { maxlength: 6, value: info.jobNumber, disabled: true }, true)}</p>
        <p>${Components.textField("JOBPTY", "Job priority (on JOBQ)", { value: this.jobChange.jobpty })}</p>
        <p>${Components.textField("OUTPTY", "Output priority (on OUTQ)", { value: this.jobChange.outpty })}</p>
        <p>${Components.textField("PRTDEV", "Print device", { value: this.jobChange.prtdev })}</p>
        <p>${Components.textField("OUTQ", "Output queue + Library", { value: this.jobChange.outq })}</p>
        <p>${Components.textField("RUNPTY", "Run priority", { value: this.jobChange.runpty })}</p>
        <p>${Components.textField("JOBQ", "Job queue + Library`", { value: this.jobChange.jobq })}</p>
        <p>${Components.textField("PRTTXT", "Print text", { value: this.jobChange.prttxt })}</p>
        <p>${Components.textField("LOG", "Message logging", { value: this.jobChange.log })}</p>
        <p>${Components.dropDown("LOGCLPGM", { items: ["*SAME", "*NO", "*YES"] }, "Log CL program commands")}</p>
        <p>${Components.dropDown("LOGOUTPUT", { items: ["*SAME", "*SYSVAL", "*JOBLOGSVR", "*JOBEND", "*PND"] }, "Job log output`")}</p>
        <p>${Components.dropDown("JOBMSGQFL", { items: ["*SAME", "*SYSVAL", "*NOWRAP", "*WRAP", "*PRTWRAP"] }, "Job message queue full action")}</p>
        <p>${Components.dropDown("INQMSGRPY", { items: ["*SAME", "*RQD", "*DFT", "*SYSRPYL"] }, "Inquiry message reply")}</p>
        <p>${Components.dropDown("BRKMSG", { items: ["*SAME", "*NORMAL", "*NOTIFY", "*HOLD"] }, "Break message handling")}</p>
        <p>${Components.dropDown("STSMSG", { items: ["*SAME", "*USRPRF", "*SYSVAL", "*NONE", "*NORMAL"] }, "Status message")}</p>
        <p>${Components.dropDown("DDMCNV", { items: ["*SAME", "*KEEP", "*DROP"] }, "DDM conversation")}</p>
        <p>${Components.textField("SCDDATE", "Schedule date", { value: this.jobChange.scddate })}</p>
        <p>${Components.textField("SCDTIME", "Schedule time", { value: this.jobChange.scdtime })}</p>
        <p>${Components.textField("DATE", "Job date", { value: this.jobChange.date })}</p>
        <p>${Components.dropDown("DATFMT", { items: ["*SAME", "*SYSVAL", "*YMD", "*MDY", "*DMY", "*JUL"] }, "Date format")}</p>
        <p>${Components.dropDown("DATSEP", { items: ["*SAME", "*SYSVAL", "*BLANK", "/", "-", ".", " ", ","] }, "Date separator")}</p>
        <p>${Components.dropDown("TIMSEP", { items: ["*SAME", "*SYSVAL", "*BLANK", ":", ".", " ", ","] }, "Time separator")}</p>
        <p>${Components.textField("SWS", "Job switches", { value: this.jobChange.sws})}</p>
        <p>${Components.textField("TIMESLICE", "Time slice", { value: this.jobChange.timeslice })}</p>
        <p>${Components.dropDown("PURGE", { items: ["*SAME", "*YES", "*NO"] }, "Eligible for purge")}</p>
        <p>${Components.textField("DFTWAIT", "Default wait time", { value: this.jobChange.dftwait })}</p>
        <p>${Components.dropDown("DEVRCYACN", { items: ["*SAME", "*SYSVAL", "*MSG", "*DSCMSG", "*DSCENDRQS", "*ENDJOB", "*ENDJOBNOLIST"] }, "Device recovery action")}</p>
        <p>${Components.dropDown("TSEPOOL", { items: ["*SAME", "*SYSVAL", "*NONE", "*BASE"] }, "Time slice end pool")}</p>
        <p>${Components.dropDown("PRTKEYFMT", { items: ["*SAME", "*SYSVAL", "*NONE", "*PRTBDR", "*PRTHDR", "*PRTALL"] }, "Print key format")}</p>
        <p>${Components.textField("SRTSEQ", "Sort sequence + Library", { value: this.jobChange.srtseq })}</p>
        <p>${Components.textField("LANGID", "Language ID", { value: this.jobChange.langid })}</p>
        <p>${Components.textField("CNTRYID", "Country or region ID", { value: this.jobChange.cntryid })}</p>
        <p>${Components.textField("CCSID", "Coded character set ID", { value: this.jobChange.ccsid })}</p>
        <p>${Components.dropDown("DECFMT", { items: ["*SAME", "*SYSVAL", "*BLANK", "I", "J"] }, "Decimal format")}</p>
        <p>${Components.dropDown("CHRIDCTL", { items: ["*SAME", "*USRPRF", "*SYSVAL", "*DEVD", "*JOBCCSID"] }, "Character identifier control")}</p>
        <p>${Components.dropDown("SPLFACN", { items: ["*SAME", "*SYSVAL", "*KEEP", "*DETACH"] }, "Spooled file action")}</p>
        <p>${Components.textField("WLCGRP", "Workload group", { value: this.jobChange.wlcgrp })}</p>
        <p>${Components.textField("CPUTIME", "Maximum CPU time", { value: this.jobChange.cputime })}</p>
        <p>${Components.textField("MAXTMPSTG", "Maximum temporary storage", { value: this.jobChange.maxtmpstg })}</p>
        <p>${Components.dropDown("PRCRSCPTY", { items: ["*SAME", "*SYSCTL", "*NORMAL", "*HIGH", "*LOW"] }, "Processor resources priority")}</p>
        <p>${Components.dropDown("DUPJOBOPT", { items: ["*SELECT", "*MSG"] }, "Duplicate job option")}</p>
        <vscode-button type="create" href="action:change" appearance="primary">Change JOB</vscode-button>
      </form>
      `;

      const historyTab = `<h1>Display job log</h1><h2><i>${this.name}</i></h2>
      <vscode-data-grid>
      <vscode-data-grid-row row-type="header">
        <vscode-data-grid-cell cell-type="columnheader" grid-column="1">Timestamp</vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="2">Message ID</vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="3">Severity</vscode-data-grid-cell>
        <vscode-data-grid-cell cell-type="columnheader" grid-column="4">Description</vscode-data-grid-cell>
      </vscode-data-grid-row>
      ${this.jobHistory?.map(history => {
        return /*html*/`
        <vscode-data-grid-row>
          <vscode-data-grid-cell grid-column="1">${history.timestamp}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="2">${history.messageId}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="3">${history.severity}</vscode-data-grid-cell>
          <vscode-data-grid-cell grid-column="4">${history.texte}</vscode-data-grid-cell>
        </vscode-data-grid-row>`;
      }).join("")}
      </vscode-data-grid>
      `;

      const panels = /*html*/`
      <vscode-panels>
        <vscode-panel-tab id="tab-1">
          PROPERTIES
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-2">
          CHANGE
        </vscode-panel-tab>
        <vscode-panel-tab id="tab-3">
          HISTORY
        </vscode-panel-tab>
        <vscode-panel-view id="view-1">${propertieTab}</vscode-panel-view>
        <vscode-panel-view id="view-2">${changeTab}</vscode-panel-view>
        <vscode-panel-view id="view-3">${historyTab}</vscode-panel-view>
      </vscode-panels>`; 

    return panels;
  }

  // We do the same action when use the button or Save document
  handleAction(data: any): HandleActionResult {

    switch (data.id) {
      case 'JOBPTY':
        this.jobChange.jobpty = data.value;
        break;
      case 'OUTPTY':
        this.jobChange.outpty = data.value;
        break;
      case 'PRTDEV':
        this.jobChange.prtdev = data.value;
        break;
      case 'OUTQ':
        this.jobChange.outq = data.value;
        break;
      case 'RUNPTY':
        this.jobChange.runpty = data.value;
        break;
      case 'JOBQ':
        this.jobChange.jobq = data.value;
        break;
      case 'PRTTXT':
        this.jobChange.prttxt = data.value;
        break;
      case 'LOG':
        this.jobChange.log = data.value;
        break;
      case 'LOGCLPGM':
        this.jobChange.logclpgm = data.value;
        break;
      case 'LOGOUTPUT':
        this.jobChange.logoutput = data.value;
        break;
      case 'JOBMSGQFL':
        this.jobChange.jobmsgqfl = data.value;
        break;
      case 'INQMSGRPY':
        this.jobChange.inqmsgrpy = data.value;
        break;
      case 'BRKMSG':
        this.jobChange.brkmsg = data.value;
        break;
      case 'STSMSG':
        this.jobChange.stsmsg = data.value;
        break;
      case 'DDMCNV':
        this.jobChange.ddmcnv = data.value;
        break;
      case 'SCDDATE':
        this.jobChange.scddate = data.value;
        break;
      case 'SCDTIME':
        this.jobChange.scdtime = data.value;
        break;
      case 'DATE':
        this.jobChange.date = data.value;
        break;
      case 'DATFMT':
        this.jobChange.datfmt = data.value;
        break;
      case 'DATSEP':
        this.jobChange.datsep = data.value;
        break;
      case 'TIMSEP':
        this.jobChange.timsep = data.value;
        break;
      case 'SWS':
        this.jobChange.sws = data.value;
        break;
      case 'TIMESLICE':
        this.jobChange.timeslice = data.value;
        break;
      case 'PURGE':
        this.jobChange.purge = data.value;
        break;
      case 'DFTWAIT':
        this.jobChange.dftwait = data.value;
        break;
      case 'DEVRCYACN':
        this.jobChange.devrcyacn = data.value;
        break;
      case 'TSEPOOL':
        this.jobChange.tsepool = data.value;
        break;
      case 'PRTKEYFMT':
        this.jobChange.prtkeyfmt = data.value;
        break;
      case 'SRTSEQ':
        this.jobChange.srtseq = data.value;
        break;
      case 'LANGID':
        this.jobChange.langid = data.value;
        break;
      case 'CNTRYID':
        this.jobChange.cntryid = data.value;
        break;
      case 'CCSID':
        this.jobChange.ccsid = data.value;
        break;
      case 'DECFMT':
        this.jobChange.decfmt = data.value;
        break;
      case 'CHRIDCTL':
        this.jobChange.chridctl = data.value;
        break;
      case 'SPLFACN':
        this.jobChange.splfacn = data.value;
        break;
      case 'WLCGRP':
        this.jobChange.wlcgrp = data.value;
        break;
      case 'CPUTIME':
        this.jobChange.cputime = data.value;
        break;
      case 'MAXTMPSTG':
        this.jobChange.maxtmpstg = data.value;
        break;
      case 'PRCRSCPTY':
        this.jobChange.prcrscpty = data.value;
        break;
      case 'DUPJOBOPT':
        this.jobChange.dupjobopt = data.value;
        break;
    
      default:
        break;
    }

    const uri = vscode.Uri.parse(data.href);
    switch (uri.path) {
      case `change`:
        this.changeJob();
    }

    // We don't want to rerender. 
    return {
      dirty: true
    };

  }

  async save(): Promise<void> {
    this.changeJob();    
  }

  private changeJob(): HandleActionResult{

    const instance = getBase();
    const connection = instance.getConnection();
    if (connection) {

      let chgjobCommand = ``;

      if (this.jobChange.jobpty !== `*SAME`) {
        chgjobCommand += ` JOBPTY(${this.jobChange.jobpty})`;
      }
      if (this.jobChange.outpty !== `*SAME`) {
        chgjobCommand += ` OUTPTY(${this.jobChange.outpty})`;
      }
      if (this.jobChange.prtdev !== `*SAME`) {
        chgjobCommand += ` PRTDEV(${this.jobChange.prtdev})`;
      }
      if (this.jobChange.outq !== `*SAME`) {
        chgjobCommand += ` OUTQ(${this.jobChange.outq})`;
      }
      if (this.jobChange.runpty !== `*SAME`) {
        chgjobCommand += ` RUNPTY(${this.jobChange.runpty})`;
      }
      if (this.jobChange.jobq !== `*SAME`) {
        chgjobCommand += ` JOBQ(${this.jobChange.jobq})`;
      }
      if (this.jobChange.prttxt !== `*SAME`) {
        chgjobCommand += ` PRTTXT(${this.jobChange.prttxt})`;
      }
      if (this.jobChange.log !== `*SAME`) {
        chgjobCommand += ` LOG(${this.jobChange.log})`;
      }
      if (this.jobChange.logclpgm !== `*SAME`) {
        chgjobCommand += ` LOGCLPGM(${this.jobChange.logclpgm})`;
      }
      if (this.jobChange.logoutput !== `*SAME`) {
        chgjobCommand += ` LOGOUTPUT(${this.jobChange.logoutput})`;
      }
      if (this.jobChange.jobmsgqfl !== `*SAME`) {
        chgjobCommand += ` JOBMSGQFL(${this.jobChange.jobmsgqfl})`;
      }
      if (this.jobChange.inqmsgrpy !== `*SAME`) {
        chgjobCommand += ` INQMSGRPY(${this.jobChange.inqmsgrpy})`;
      }
      if (this.jobChange.brkmsg !== `*SAME`) {
        chgjobCommand += ` BRKMSG(${this.jobChange.brkmsg})`;
      }
      if (this.jobChange.stsmsg !== `*SAME`) {
        chgjobCommand += ` STSMSG(${this.jobChange.stsmsg})`;
      }
      if (this.jobChange.ddmcnv !== `*SAME`) {
        chgjobCommand += ` DDMCNV(${this.jobChange.ddmcnv})`;
      }
      if (this.jobChange.scddate !== `*SAME`) {
        chgjobCommand += ` SCDDATE(${this.jobChange.scddate})`;
      }
      if (this.jobChange.scdtime !== `*SAME`) {
        chgjobCommand += ` SCDTIME(${this.jobChange.scdtime})`;
      }
      if (this.jobChange.date !== `*SAME`) {
        chgjobCommand += ` DATE(${this.jobChange.date})`;
      }
      if (this.jobChange.datfmt !== `*SAME`) {
        chgjobCommand += ` DATFMT(${this.jobChange.datfmt})`;
      }
      if (this.jobChange.datsep !== `*SAME`) {
        chgjobCommand += ` DATSEP(${this.jobChange.datsep})`;
      }
      if (this.jobChange.timsep !== `*SAME`) {
        chgjobCommand += ` TIMSEP(${this.jobChange.timsep})`;
      }
      if (this.jobChange.sws !== `*SAME`) {
        chgjobCommand += ` SWS(${this.jobChange.sws})`;
      }
      if (this.jobChange.timeslice !== `*SAME`) {
        chgjobCommand += ` TIMESLICE(${this.jobChange.timeslice})`;
      }
      if (this.jobChange.purge !== `*SAME`) {
        chgjobCommand += ` PURGE(${this.jobChange.purge})`;
      }
      if (this.jobChange.dftwait !== `*SAME`) {
        chgjobCommand += ` DFTWAIT(${this.jobChange.dftwait})`;
      }
      if (this.jobChange.devrcyacn !== `*SAME`) {
        chgjobCommand += ` DEVRCYACN(${this.jobChange.devrcyacn})`;
      }
      if (this.jobChange.tsepool !== `*SAME`) {
        chgjobCommand += ` TSEPOOL(${this.jobChange.tsepool})`;
      }
      if (this.jobChange.prtkeyfmt !== `*SAME`) {
        chgjobCommand += ` PRTKEYFMT(${this.jobChange.prtkeyfmt})`;
      }
      if (this.jobChange.srtseq !== `*SAME`) {
        chgjobCommand += ` SRTSEQ(${this.jobChange.srtseq})`;
      }
      if (this.jobChange.langid !== `*SAME`) {
        chgjobCommand += ` LANGID(${this.jobChange.langid})`;
      }
      if (this.jobChange.cntryid !== `*SAME`) {
        chgjobCommand += ` CNTRYID(${this.jobChange.cntryid})`;
      }
      if (this.jobChange.ccsid !== `*SAME`) {
        chgjobCommand += ` CCSID(${this.jobChange.ccsid})`;
      }
      if (this.jobChange.decfmt !== `*SAME`) {
        chgjobCommand += ` DECFMT(${this.jobChange.decfmt})`;
      }
      if (this.jobChange.chridctl !== `*SAME`) {
        chgjobCommand += ` CHRIDCTL(${this.jobChange.chridctl})`;
      }
      if (this.jobChange.splfacn !== `*SAME`) {
        chgjobCommand += ` SPLFACN(${this.jobChange.splfacn})`;
      }
      if (this.jobChange.wlcgrp !== `*SAME`) {
        chgjobCommand += ` WLCGRP(${this.jobChange.wlcgrp})`;
      }
      if (this.jobChange.cputime !== `*SAME`) {
        chgjobCommand += ` CPUTIME(${this.jobChange.cputime})`;
      }
      if (this.jobChange.maxtmpstg !== `*SAME`) {
        chgjobCommand += ` MAXTMPSTG(${this.jobChange.maxtmpstg})`;
      }
      if (this.jobChange.prcrscpty !== `*SAME`) {
        chgjobCommand += ` PRCRSCPTY(${this.jobChange.prcrscpty})`;
      }
      if (this.jobChange.dupjobopt !== `*SAME`) {
        chgjobCommand += ` DUPJOBOPT(${this.jobChange.dupjobopt})`;
      }

      if (chgjobCommand !== ``) {
        chgjobCommand = `CHGJOB JOB(${this.jobChange.jobNumber}/${this.jobChange.jobUser}/${this.jobChange.jobName})` + chgjobCommand;
        
        try {   
          connection.remoteCommand(chgjobCommand);
          
          vscode.window.showInformationMessage(`Job ${this.jobChange.jobNumber}/${this.jobChange.jobUser}/${this.jobChange.jobName} changed.`);
          
        } catch (e) {
          vscode.window.showErrorMessage(`Error changing job! ${e}`);
        }
      } else {  
        vscode.window.showErrorMessage(`Nothing to change`);
      }
    }

    return {
      dirty: true
    };
  }
}
