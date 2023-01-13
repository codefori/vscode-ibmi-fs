import * as vscode from 'vscode';
import { Components, generatePage, generateError } from '../../webviewToolkit';
import { JobInfo } from '../../typings';
import { getBase } from "../../tools";

const instance = getBase();

export class EndJobUi {
    public static currentPanel: EndJobUi | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, jobInfo);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static async render(extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        if (EndJobUi.currentPanel) {
            EndJobUi.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("job-end", "End job", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            EndJobUi.currentPanel = new EndJobUi(panel, extensionUri, jobInfo);
        }
    }

    public dispose() {
        EndJobUi.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, jobinfo?: JobInfo) {

        const title = `<h1>End Job (ENDJOB)</h1>`;
        const filedJobName = `<p>${Components.textField("jobname", "Job name", { placeholder: "Job's name", value: jobinfo?.jobNameShort || "", disabled: true }, true)}</p>`;
        const filedJobUser = `<p>${Components.textField("jobuser", "Job user", { maxlength: 10, value: jobinfo?.jobUser || "", disabled: true }, true)}</p>`;
        const filedJobNumber = `<p>${Components.textField("jobnumber", "Job number", { maxlength: 6, value: jobinfo?.jobNumber || "", disabled: true }, true)}</p>`;
        const filedOption = `<p>${Components.dropDown("option", { items: ["*CNTRLD", "*IMMED"] }, "How to end (OPTION)")}</p>`;
        const filedDelay = `<p>${Components.textField("delay", "Controlled end delay time (DELAY)", { value: "30" }, true)}</p>`;
        const filedSplfile = `<p>${Components.radioGroup("splfile", { items: ["*NO", "*YES"], label: "Delete spooled files (SPLFILE)" })}</p>`;
        const filedLoglmt = `<p>${Components.textField("loglmt", "Maximum log entries (LOGLMT)", { value: "*SAME" }, true)}</p>`;
        const filedAdlintjobs = `<p>${Components.dropDown("adlintjobs", { items: ["*NONE", "*GRPJOB", "*ALL"] }, "Additional interactive jobs (ADLINTJOBS)")}</p>`;
        const filedDupjobopt = `<p>${Components.dropDown("dupjobopt", { items: ["*SELECT", "*MSG"] }, "Duplicate job option (DUPJOBOPT)")}</p>`;
        const buttonSave = `<p>${Components.button("saveData", "End Job", { type: "submit" })}</p>`;
        const html = `
        ${title}
        ${Components.divider()}
        <form>
            ${filedJobName}
            ${filedJobUser}
            ${filedJobNumber}
            ${filedOption}
            ${filedDelay}
            ${filedSplfile}
            ${filedLoglmt}
            ${filedAdlintjobs}
            ${filedDupjobopt}
            ${Components.divider()}
            ${buttonSave}
        </form>`;
        return generatePage(html);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                if (message.data) {
                    const connection = instance.getConnection();

                    if (connection) {

                        if (!message.data.splfile) {
                            message.data.splfile = '*NO';
                        }

                        try {
                            await connection.remoteCommand(
                                `ENDJOB JOB(${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname}) OPTION(${message.data.option}) DELAY(${message.data.delay}) SPLFILE(${message.data.splfile}) LOGLMT(${message.data.loglmt}) ADLINTJOBS(${message.data.adlintjobs}) DUPJOBOPT(${message.data.dupjobopt})`,
                            );

                            if (message.data.delay === '*IMMED') {
                                vscode.window.showInformationMessage(`Job ${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname} ended.`);
                            } else {
                                vscode.window.showInformationMessage(`Job ${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname} will end.`);
                            }


                        } catch (e) {
                            vscode.window.showErrorMessage(`Error ending job! ${e}`);
                        }
                    } else {
                        vscode.window.showErrorMessage(`No connection`);
                    }
                    this.dispose();
                }
            },
            undefined,
            this._disposables
        );
    }

}

export class HoldJobUi {
    public static currentPanel: HoldJobUi | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, jobInfo);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static async render(extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        if (HoldJobUi.currentPanel) {
            HoldJobUi.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("job-hold", "Hold job", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            HoldJobUi.currentPanel = new HoldJobUi(panel, extensionUri, jobInfo);
        }
    }

    public dispose() {
        HoldJobUi.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, jobinfo?: JobInfo) {

        const title = `<h1>Hold Job (HLDJOB)</h1>`;
        const filedJobName = `<p>${Components.textField("jobname", "Job name", { placeholder: "Job's name", value: jobinfo?.jobNameShort || "", disabled: true }, true)}</p>`;
        const filedJobUser = `<p>${Components.textField("jobuser", "Job user", { maxlength: 10, value: jobinfo?.jobUser || "", disabled: true }, true)}</p>`;
        const filedJobNumber = `<p>${Components.textField("jobnumber", "Job number", { maxlength: 6, value: jobinfo?.jobNumber || "", disabled: true }, true)}</p>`;
        const filedSplfile = `<p>${Components.radioGroup("splfile", { items: ["*NO", "*YES"], label: "Hold spooled files" })}</p>`;
        const filedDupjobopt = `<p>${Components.dropDown("dupjobopt", { items: ["*SELECT", "*MSG"] })}</p>`;
        const buttonSave = `<p>${Components.button("saveData", "Hold Job", { type: "submit" })}</p>`;
        const html = `
        ${title}
        ${Components.divider()}
        <form>
            ${filedJobName}
            ${filedJobUser}
            ${filedJobNumber}
            ${filedSplfile}
            ${filedDupjobopt}
            ${Components.divider()}
            ${buttonSave}
        </form>`;
        return generatePage(html);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                if (message.data) {
                    const connection = instance.getConnection();

                    if (connection) {

                        if (!message.data.splfile) {
                            message.data.splfile = '*NO';
                        }

                        try {
                            await connection.remoteCommand(
                                `HLDJOB JOB(${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname}) SPLFILE(${message.data.splfile}) DUPJOBOPT(${message.data.dupjobopt})`,
                            );

                            vscode.window.showInformationMessage(`Job ${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname} holded.`);

                        } catch (e) {
                            vscode.window.showErrorMessage(`Error holding job! ${e}`);
                        }
                    } else {
                        vscode.window.showErrorMessage(`No connection`);
                    }
                    this.dispose();
                }
            },
            undefined,
            this._disposables
        );
    }

}

export class ReleaseJobUi {
    public static currentPanel: ReleaseJobUi | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, jobInfo);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static async render(extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        if (ReleaseJobUi.currentPanel) {
            ReleaseJobUi.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("job-release", "Hold job", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ReleaseJobUi.currentPanel = new ReleaseJobUi(panel, extensionUri, jobInfo);
        }
    }

    public dispose() {
        ReleaseJobUi.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, jobinfo?: JobInfo) {

        const title = `<h1>Release Job (RLSJOB)</h1>`;
        const filedJobName = `<p>${Components.textField("jobname", "Job name", { placeholder: "Job's name", value: jobinfo?.jobNameShort || "", disabled: true }, true)}</p>`;
        const filedJobUser = `<p>${Components.textField("jobuser", "Job user", { maxlength: 10, value: jobinfo?.jobUser || "", disabled: true }, true)}</p>`;
        const filedJobNumber = `<p>${Components.textField("jobnumber", "Job number", { maxlength: 6, value: jobinfo?.jobNumber || "", disabled: true }, true)}</p>`;
        const filedDupjobopt = `<p>${Components.dropDown("dupjobopt", { items: ["*SELECT", "*MSG"] }, "Duplicate job option")}</p>`;
        const buttonSave = `<p>${Components.button("saveData", "Release Job", { type: "submit" })}</p>`;
        const html = `
        ${title}
        ${Components.divider()}
        <form>
            ${filedJobName}
            ${filedJobUser}
            ${filedJobNumber}
            ${filedDupjobopt}
            ${Components.divider()}
            ${buttonSave}
        </form>`;
        return generatePage(html);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                if (message.data) {
                    const connection = instance.getConnection();

                    if (connection) {
                        try {
                            await connection.remoteCommand(
                                `RLSJOB JOB(${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname}) DUPJOBOPT(${message.data.dupjobopt})`,
                            );

                            vscode.window.showInformationMessage(`Job ${message.data.jobnumber}/${message.data.jobuser}/${message.data.jobname} released.`);

                        } catch (e) {
                            vscode.window.showErrorMessage(`Error releasing job! ${e}`);
                        }
                    } else {
                        vscode.window.showErrorMessage(`No connection`);
                    }
                    this.dispose();
                }
            },
            undefined,
            this._disposables
        );
    }

}

export class ChangeJobUi {
    public static currentPanel: ChangeJobUi | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, jobInfo);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static async render(extensionUri: vscode.Uri, jobInfo?: JobInfo) {
        if (ChangeJobUi.currentPanel) {
            ChangeJobUi.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("job-change", "Change job", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            ChangeJobUi.currentPanel = new ChangeJobUi(panel, extensionUri, jobInfo);
        }
    }

    public dispose() {
        ChangeJobUi.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, jobinfo?: JobInfo) {

        const html = `<h1>Change job</h1>
      <form>
        <p>${Components.textField("jobName", "Job name", { maxlength: 10, value: jobinfo?.jobNameShort, disabled: true }, true)}</p>
        <p>${Components.textField("jobUser", "Job user", { maxlength: 10, value: jobinfo?.jobUser, disabled: true }, true)}</p>
        <p>${Components.textField("jobNumber", "Job number", { maxlength: 6, value: jobinfo?.jobNumber, disabled: true }, true)}</p>
        <p>${Components.textField("jobpty", "Job priority (on JOBQ)", { value: "*SAME" })}</p>
        <p>${Components.textField("outpty", "Output priority (on OUTQ)", { value: "*SAME" })}</p>
        <p>${Components.textField("prtdev", "Print device", { value: "*SAME" })}</p>
        <p>${Components.textField("outq", "Output queue + Library", { value: "*SAME" })}</p>
        <p>${Components.textField("runpty", "Run priority", { value: "*SAME" })}</p>
        <p>${Components.textField("jobq", "Job queue + Library`", { value: "*SAME" })}</p>
        <p>${Components.textField("prttxt", "Print text", { value: "*SAME" })}</p>
        <p>${Components.textField("log", "Message logging", { value: "*SAME" })}</p>
        <p>${Components.dropDown("logclpgm", { items: ["*SAME", "*NO", "*YES"] }, "Log CL program commands")}</p>
        <p>${Components.dropDown("logoutput", { items: ["*SAME", "*SYSVAL", "*JOBLOGSVR", "*JOBEND", "*PND"] }, "Job log output`")}</p>
        <p>${Components.dropDown("jobmsgqfl", { items: ["*SAME", "*SYSVAL", "*NOWRAP", "*WRAP", "*PRTWRAP"] }, "Job message queue full action")}</p>
        <p>${Components.dropDown("inqmsgrpy", { items: ["*SAME", "*RQD", "*DFT", "*SYSRPYL"] }, "Inquiry message reply")}</p>
        <p>${Components.dropDown("brkmsg", { items: ["*SAME", "*NORMAL", "*NOTIFY", "*HOLD"] }, "Break message handling")}</p>
        <p>${Components.dropDown("stsmsg", { items: ["*SAME", "*USRPRF", "*SYSVAL", "*NONE", "*NORMAL"] }, "Status message")}</p>
        <p>${Components.dropDown("ddmcnv", { items: ["*SAME", "*KEEP", "*DROP"] }, "DDM conversation")}</p>
        <p>${Components.textField("scddate", "Schedule date", { value: "*SAME" })}</p>
        <p>${Components.textField("scdtime", "Schedule time", { value: "*SAME" })}</p>
        <p>${Components.textField("date", "Job date", { value: "*SAME" })}</p>
        <p>${Components.dropDown("datfmt", { items: ["*SAME", "*SYSVAL", "*YMD", "*MDY", "*DMY", "*JUL"] }, "Date format")}</p>
        <p>${Components.dropDown("datsep", { items: ["*SAME", "*SYSVAL", "*BLANK", "/", "-", ".", " ", ","] }, "Date separator")}</p>
        <p>${Components.dropDown("timsep", { items: ["*SAME", "*SYSVAL", "*BLANK", ":", ".", " ", ","] }, "Time separator")}</p>
        <p>${Components.textField("sws", "Job switches", { value: "*SAME" })}</p>
        <p>${Components.textField("timeslice", "Time slice", { value: "*SAME" })}</p>
        <p>${Components.dropDown("purge", { items: ["*SAME", "*YES", "*NO"] }, "Eligible for purge")}</p>
        <p>${Components.textField("dftwait", "Default wait time", { value: "*SAME" })}</p>
        <p>${Components.dropDown("devrcyacn", { items: ["*SAME", "*SYSVAL", "*MSG", "*DSCMSG", "*DSCENDRQS", "*ENDJOB", "*ENDJOBNOLIST"] }, "Device recovery action")}</p>
        <p>${Components.dropDown("tsepool", { items: ["*SAME", "*SYSVAL", "*NONE", "*BASE"] }, "Time slice end pool")}</p>
        <p>${Components.dropDown("prtkeyfmt", { items: ["*SAME", "*SYSVAL", "*NONE", "*PRTBDR", "*PRTHDR", "*PRTALL"] }, "Print key format")}</p>
        <p>${Components.textField("srtseq", "Sort sequence + Library", { value: "*SAME" })}</p>
        <p>${Components.textField("langid", "Language ID", { value: "*SAME" })}</p>
        <p>${Components.textField("cntryid", "Country or region ID", { value: "*SAME" })}</p>
        <p>${Components.textField("ccsid", "Coded character set ID", { value: "*SAME" })}</p>
        <p>${Components.dropDown("decfmt", { items: ["*SAME", "*SYSVAL", "*BLANK", "I", "J"] }, "Decimal format")}</p>
        <p>${Components.dropDown("chridctl", { items: ["*SAME", "*USRPRF", "*SYSVAL", "*DEVD", "*JOBCCSID"] }, "Character identifier control")}</p>
        <p>${Components.dropDown("splfacn", { items: ["*SAME", "*SYSVAL", "*KEEP", "*DETACH"] }, "Spooled file action")}</p>
        <p>${Components.textField("wlcgrp", "Workload group", { value: "*SAME" })}</p>
        <p>${Components.textField("cputime", "Maximum CPU time", { value: "*SAME" })}</p>
        <p>${Components.textField("maxtmpstg", "Maximum temporary storage", { value: "*SAME" })}</p>
        <p>${Components.dropDown("prcrscpty", { items: ["*SAME", "*SYSCTL", "*NORMAL", "*HIGH", "*LOW"] }, "Processor resources priority")}</p>
        <p>${Components.dropDown("dupjobopt", { items: ["*SELECT", "*MSG"] }, "Duplicate job option")}</p>
        ${Components.divider()}
        <p>${Components.button("saveData", "Change Job", { type: "submit" })}</p>
      </form>
      `;
        return generatePage(html);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {
                if (message.data) {
                    const connection = instance.getConnection();

                    if (connection) {

                        let chgjobCommand = ``;

                        if (message.data.jobpty !== `*SAME`) {
                            chgjobCommand += ` JOBPTY(${message.data.jobpty})`;
                        }
                        if (message.data.outpty !== `*SAME`) {
                            chgjobCommand += ` OUTPTY(${message.data.outpty})`;
                        }
                        if (message.data.prtdev !== `*SAME`) {
                            chgjobCommand += ` PRTDEV(${message.data.prtdev})`;
                        }
                        if (message.data.outq !== `*SAME`) {
                            chgjobCommand += ` OUTQ(${message.data.outq})`;
                        }
                        if (message.data.runpty !== `*SAME`) {
                            chgjobCommand += ` RUNPTY(${message.data.runpty})`;
                        }
                        if (message.data.jobq !== `*SAME`) {
                            chgjobCommand += ` JOBQ(${message.data.jobq})`;
                        }
                        if (message.data.prttxt !== `*SAME`) {
                            chgjobCommand += ` PRTTXT(${message.data.prttxt})`;
                        }
                        if (message.data.log !== `*SAME`) {
                            chgjobCommand += ` LOG(${message.data.log})`;
                        }
                        if (message.data.logclpgm !== `*SAME`) {
                            chgjobCommand += ` LOGCLPGM(${message.data.logclpgm})`;
                        }
                        if (message.data.logoutput !== `*SAME`) {
                            chgjobCommand += ` LOGOUTPUT(${message.data.logoutput})`;
                        }
                        if (message.data.jobmsgqfl !== `*SAME`) {
                            chgjobCommand += ` JOBMSGQFL(${message.data.jobmsgqfl})`;
                        }
                        if (message.data.inqmsgrpy !== `*SAME`) {
                            chgjobCommand += ` INQMSGRPY(${message.data.inqmsgrpy})`;
                        }
                        if (message.data.brkmsg !== `*SAME`) {
                            chgjobCommand += ` BRKMSG(${message.data.brkmsg})`;
                        }
                        if (message.data.stsmsg !== `*SAME`) {
                            chgjobCommand += ` STSMSG(${message.data.stsmsg})`;
                        }
                        if (message.data.ddmcnv !== `*SAME`) {
                            chgjobCommand += ` DDMCNV(${message.data.ddmcnv})`;
                        }
                        if (message.data.scddate !== `*SAME`) {
                            chgjobCommand += ` SCDDATE(${message.data.scddate})`;
                        }
                        if (message.data.scdtime !== `*SAME`) {
                            chgjobCommand += ` SCDTIME(${message.data.scdtime})`;
                        }
                        if (message.data.date !== `*SAME`) {
                            chgjobCommand += ` DATE(${message.data.date})`;
                        }
                        if (message.data.datfmt !== `*SAME`) {
                            chgjobCommand += ` DATFMT(${message.data.datfmt})`;
                        }
                        if (message.data.datsep !== `*SAME`) {
                            chgjobCommand += ` DATSEP(${message.data.datsep})`;
                        }
                        if (message.data.timsep !== `*SAME`) {
                            chgjobCommand += ` TIMSEP(${message.data.timsep})`;
                        }
                        if (message.data.sws !== `*SAME`) {
                            chgjobCommand += ` SWS(${message.data.sws})`;
                        }
                        if (message.data.timeslice !== `*SAME`) {
                            chgjobCommand += ` TIMESLICE(${message.data.timeslice})`;
                        }
                        if (message.data.purge !== `*SAME`) {
                            chgjobCommand += ` PURGE(${message.data.purge})`;
                        }
                        if (message.data.dftwait !== `*SAME`) {
                            chgjobCommand += ` DFTWAIT(${message.data.dftwait})`;
                        }
                        if (message.data.devrcyacn !== `*SAME`) {
                            chgjobCommand += ` DEVRCYACN(${message.data.devrcyacn})`;
                        }
                        if (message.data.tsepool !== `*SAME`) {
                            chgjobCommand += ` TSEPOOL(${message.data.tsepool})`;
                        }
                        if (message.data.prtkeyfmt !== `*SAME`) {
                            chgjobCommand += ` PRTKEYFMT(${message.data.prtkeyfmt})`;
                        }
                        if (message.data.srtseq !== `*SAME`) {
                            chgjobCommand += ` SRTSEQ(${message.data.srtseq})`;
                        }
                        if (message.data.langid !== `*SAME`) {
                            chgjobCommand += ` LANGID(${message.data.langid})`;
                        }
                        if (message.data.cntryid !== `*SAME`) {
                            chgjobCommand += ` CNTRYID(${message.data.cntryid})`;
                        }
                        if (message.data.ccsid !== `*SAME`) {
                            chgjobCommand += ` CCSID(${message.data.ccsid})`;
                        }
                        if (message.data.decfmt !== `*SAME`) {
                            chgjobCommand += ` DECFMT(${message.data.decfmt})`;
                        }
                        if (message.data.chridctl !== `*SAME`) {
                            chgjobCommand += ` CHRIDCTL(${message.data.chridctl})`;
                        }
                        if (message.data.splfacn !== `*SAME`) {
                            chgjobCommand += ` SPLFACN(${message.data.splfacn})`;
                        }
                        if (message.data.wlcgrp !== `*SAME`) {
                            chgjobCommand += ` WLCGRP(${message.data.wlcgrp})`;
                        }
                        if (message.data.cputime !== `*SAME`) {
                            chgjobCommand += ` CPUTIME(${message.data.cputime})`;
                        }
                        if (message.data.maxtmpstg !== `*SAME`) {
                            chgjobCommand += ` MAXTMPSTG(${message.data.maxtmpstg})`;
                        }
                        if (message.data.prcrscpty !== `*SAME`) {
                            chgjobCommand += ` PRCRSCPTY(${message.data.prcrscpty})`;
                        }
                        if (message.data.dupjobopt !== `*SELECT`) {
                            chgjobCommand += ` DUPJOBOPT(${message.data.dupjobopt})`;
                        }

                        if (chgjobCommand !== ``) {
                            chgjobCommand = `CHGJOB JOB(${message.data.jobNumber}/${message.data.jobUser}/${message.data.jobName})` + chgjobCommand;

                            try {
                                await connection.remoteCommand(chgjobCommand);

                                vscode.window.showInformationMessage(`Job ${message.data.jobNumber}/${message.data.jobUser}/${message.data.jobName} changed.`);

                            } catch (e) {
                                vscode.window.showErrorMessage(`Error changing job! ${e}`);
                            }
                        } else {
                            vscode.window.showErrorMessage(`Nothing to change`);
                        }
                    } else {
                        vscode.window.showErrorMessage(`No connection`);
                    }
                    this.dispose();
                }
            },
            undefined,
            this._disposables
        );
    }

}