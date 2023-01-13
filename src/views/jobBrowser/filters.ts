import * as vscode from 'vscode';
import { Components, generatePage, generateError } from '../../webviewToolkit';
import { JobFilter } from '../../typings';
import { getBase } from "../../tools";
import { ConnectionConfiguration } from "../../api/Configuration";

const instance = getBase();

export class JobFilterUI {
    public static currentPanel: JobFilterUI | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, jobFilter?: JobFilter) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, extensionUri, jobFilter);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static async render(extensionUri: vscode.Uri, jobFilter?: JobFilter) {
        if (JobFilterUI.currentPanel) {
            JobFilterUI.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("job-filter", "Job filter", vscode.ViewColumn.One, {
                enableScripts: true,
            });

            JobFilterUI.currentPanel = new JobFilterUI(panel, extensionUri, jobFilter);
        }
    }

    public dispose() {
        JobFilterUI.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, jobFilter?: JobFilter) {

        let jobFilterNew: JobFilter = {
            nameFilter: 'New filter',
            jobNameFilter: '*',
            jobUserFilter: '*',
            jobNumberFilter: '*',
            profileFilter: '*',
            subsystemFilter: '*'
        };

        let title;
        if (jobFilter) {
            title = `<h1>Change filter</h1>`;
        } else {
            title = `<h1>New job filter</h1>`;
        }
        const filedName = `<p>${Components.textField("nameFilter", "Filter name", { placeholder: "Should be unique.", value: jobFilter?.nameFilter || jobFilterNew.nameFilter }, true)}</p>`;
        const filedJobName = `<p>${Components.textField("jobNameFilter", "Job name", { maxlength: 10, value: jobFilter?.jobNameFilter || jobFilterNew.jobNameFilter }, true)}</p>`;
        const filedJobUser = `<p>${Components.textField("jobUserFilter", "Job user", { maxlength: 10, value: jobFilter?.jobUserFilter || jobFilterNew.jobUserFilter }, true)}</p>`;
        const filedJobNumber = `<p>${Components.textField("jobNumberFilter", "Job number", { maxlength: 6, value: jobFilter?.jobNumberFilter || jobFilterNew.jobNumberFilter }, true)}</p>`;
        const filedProfile = `<p>${Components.textField("profileFilter", "Profile", { maxlength: 10, value: jobFilter?.profileFilter || jobFilterNew.profileFilter }, true)}</p>`;
        const filedSubsystem = `<p>${Components.textField("subsystemFilter", "Subsystem", { maxlength: 10, value: jobFilter?.subsystemFilter || jobFilterNew.subsystemFilter }, true)}</p>`;
        const buttonSave = `<p>${Components.button("saveData", "Save settings", { type: "submit" })}</p>`;
        const html = `
        ${title}
        ${Components.divider()}
        <form>
            ${filedName}
            ${filedJobName}
            ${filedJobUser}
            ${filedJobNumber}
            ${filedProfile}
            ${filedSubsystem}
            ${Components.divider()}
            ${buttonSave}
        </form>`;
        return generatePage(html);
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            async (message) => {

                console.log(JSON.stringify(message.data));

                if (message.data) {
                    let existingConfigIndex;
                    const config = instance.getConfig();

                    const jobFilters: JobFilter[] = config.jobFilters || undefined;

                    if (message.data.jobNameFilter === ``) {
                        message.data.jobNameFilter === `*`;
                    }
                    if (message.data.jobUserFilter === ``) {
                        message.data.jobUserFilter === `*`;
                    }
                    if (message.data.jobNumberFilter === ``) {
                        message.data.jobNumberFilter === `*`;
                    }
                    if (message.data.profileFilter === ``) {
                        message.data.profileFilter === `*`;
                    }
                    if (message.data.subsystemFilter === ``) {
                        message.data.subsystemFilter === `*`;
                    }

                    if (jobFilters.length > 0) {
                        
                        // Find an existing filter with that name
                        existingConfigIndex = jobFilters.findIndex((filter: { nameFilter: any; }) => filter.nameFilter === message.data.nameFilter);

                        if (existingConfigIndex >= 0) {
                            let filter: JobFilter = jobFilters[existingConfigIndex];
                            filter = {
                                ...filter,
                                ...message.data,
                            };
    
                            jobFilters[existingConfigIndex] = filter;
                            config.jobFilters = jobFilters;
                            await ConnectionConfiguration.update(config);
                        } else {
                            let jobFiltersNew: JobFilter = {
                                nameFilter: message.data.nameFilter,
                                jobNameFilter: message.data.jobNameFilter,
                                jobUserFilter: message.data.jobUserFilter,
                                jobNumberFilter: message.data.jobNumberFilter,
                                profileFilter: message.data.profileFilter,
                                subsystemFilter: message.data.subsystemFilter
                            };

                            jobFilters.push(jobFiltersNew);
                            
                            config.jobFilters = jobFilters;
                            await ConnectionConfiguration.update(config);
                        }
                    } else {
                        let jobFiltersNew: JobFilter[] = [{
                            nameFilter: message.data.nameFilter,
                            jobNameFilter: message.data.jobNameFilter,
                            jobUserFilter: message.data.jobUserFilter,
                            jobNumberFilter: message.data.jobNumberFilter,
                            profileFilter: message.data.profileFilter,
                            subsystemFilter: message.data.subsystemFilter
                        }];
                        
                        config.jobFilters = jobFiltersNew;
                        await ConnectionConfiguration.update(config);
                    }
                    this.dispose();
                }
            },
            undefined,
            this._disposables
        );
    }

}