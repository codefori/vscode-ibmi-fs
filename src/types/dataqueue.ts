import * as vscode from 'vscode';
import { IBMiObject } from '../import/code-for-ibmi';
import { getBase } from "../tools";
import { Components } from "../webviewToolkit";
import Base from "./base";

const ACTION_CLEAR = "clear";
const ACTION_SEND = "send";

export namespace DataQueueActions {
    export const register = (context: vscode.ExtensionContext) => {
        context.subscriptions.push(
            vscode.commands.registerCommand("vscode-ibmi-fs.sendToDataQueue", sendToDataQueue),
            vscode.commands.registerCommand("vscode-ibmi-fs.clearDataQueue", clearDataQueue),
        );
    };

    export const clearDataQueue = async (item: IBMiObject | DataQueue): Promise<boolean> => {
        const library = item.library.toUpperCase();
        const name = item.name.toUpperCase();
        if (await vscode.window.showWarningMessage(`Are you sure you want to clear Data Queue ${library}/${name}?`, { modal: true }, "Clear")) {
            await getBase().getContent().runSQL(`Call QSYS2.CLEAR_DATA_QUEUE('${name}', '${library}');`);
            vscode.window.showInformationMessage(`Data Queue ${library}/${name} cleared.`);
            return true;
        }
        else {
            return false;
        }
    };

    export const sendToDataQueue = async (item: IBMiObject | DataQueue): Promise<boolean> => {
        if ("keyed" in item) {
            return _sendToDataQueue(item);
        }
        else {
            const dataQueue: DataQueue = new DataQueue(vscode.Uri.file(''), item.library.toUpperCase(), item.name.toUpperCase());
            await dataQueue.fetchInfo();
            return _sendToDataQueue(dataQueue);
        }
    };

    export const _sendToDataQueue = async (dataQueue: DataQueue): Promise<boolean> => {
        const key = dataQueue.keyed ? await vscode.window.showInputBox({
            placeHolder: "key data",
            title: `Enter key data`,
            validateInput: data => {
                if (data.length > dataQueue.keyLength) {
                    return `Key data is too long (maximum ${dataQueue.keyLength} characters)`;
                }
            }
        }) : "";
        if (!dataQueue.keyed || key) {
            const data = await vscode.window.showInputBox({
                placeHolder: "data",
                title: `Enter data`,
                validateInput: data => {
                    if (data.length > dataQueue.maximumMessageLength) {
                        return `Data is too long (maximum ${dataQueue.maximumMessageLength} characters)`;
                    }
                }
            });
            if (data) {
                await dataQueue.content.runSQL(`CALL QSYS2.SEND_DATA_QUEUE(${key ? `KEY_DATA => '${key}',` : ""} MESSAGE_DATA => '${data}',                      
              DATA_QUEUE => '${dataQueue.name}', DATA_QUEUE_LIBRARY => '${dataQueue.library}')`);
                vscode.window.showInformationMessage(`Data successfully sent to ${dataQueue.library}/${dataQueue.name}.`);
                return true;
            }
        }
        return false;
    };
}

interface Entry {
    key?: string
    data: string
    timestamp: string
    senderJob: string
    senderUser: string
}

export class DataQueue extends Base {
    private readonly _info: Record<string, string | boolean | number> = {};
    private readonly _entries: Entry[] = [];
    private _keyed = false;

    get keyed() {
        return this._keyed;
    }

    get keyLength() {
        return this._info.keyLength;
    }

    get maximumMessageLength() {
        return this._info.maximumMessageLength;
    }

    async fetch() {
        await this.fetchInfo();
        await this._fetchEntries();
    }

    get content() {
        const content = getBase().getContent();
        if (content) {
            return content;
        }
        else {
            throw new Error("No connection.");
        }
    }

    async fetchInfo() {
        const [dtaq]: DB2Row[] = await this.content.runSQL(
            `Select * From QSYS2.DATA_QUEUE_INFO
            Where DATA_QUEUE_NAME = '${this.name}' And
                  DATA_QUEUE_LIBRARY = '${this.library}'
            Fetch first row only`
        );

        this._info.type = String(dtaq.DATA_QUEUE_TYPE);
        this._info.description = String(dtaq.TEXT_DESCRIPTION || "");
        if (this._info.type === "STANDARD") {
            this._info.maximumMessageLength = Number(dtaq.MAXIMUM_MESSAGE_LENGTH);
            this._info.sequence = String(dtaq.SEQUENCE);
            if (this._info.sequence === "KEYED") {
                this._info.keyLength = Number(dtaq.KEY_LENGTH);
                this._keyed = true;
            }
            this._info.includeSenderId = toBoolean(dtaq.INCLUDE_SENDER_ID);
            this._info.currentMessages = Number(dtaq.CURRENT_MESSAGES);
            this._info.maximumMessages = Number(dtaq.MAXIMUM_MESSAGES);
            this._info.maximumSpecifiedMessages = Number(dtaq.SPECIFIED_MAXIMUM_MESSAGES);
            if (this._info.maximumSpecifiedMessages === -1) {
                this._info.maximumSpecifiedMessages = "*MAX16MB";
            }
            else if (this._info.maximuSpecifiedMessages === -2) {
                this._info.maximuSpecifiedMessages = "*MAX2GB";
            }
            this._info.initialMessageAllocation = Number(dtaq.INITIAL_MESSAGE_ALLOCATION);
            this._info.currentMessageAllocation = Number(dtaq.CURRENT_MESSAGE_ALLOCATION);
            this._info.force = toBoolean(dtaq.FORCE);
            this._info.automaticReclaim = toBoolean(dtaq.AUTOMATIC_RECLAIM);
            this._info.lastReclaimOn = String(dtaq.LAST_RECLAIM_TIMESTAMP || "Never");
            this._info.enforceDataQueueLocks = toBoolean(dtaq.ENFORCE_DATA_QUEUE_LOCKS);
        }
        else { //DDM
            this._info.remoteDataQueue = `${dtaq.REMOTE_DATA_QUEUE_LIBRARY}/${dtaq.MAXIMUM_MESSAGES}`;
            this._info.remoteLocation = String(dtaq.REMOTE_LOCATION);
            if (this._info.remoteLocation === "*RDB") {
                this._info.relationalDatabaseName = String(dtaq.RELATIONAL_DATABASE_NAME);
            }
            else {
                this._info.localLocation = String(dtaq.LOCAL_LOCATION);
                this._info.mode = String(dtaq.MODE);
                this._info.remoteNetworkId = String(dtaq.REMOTE_NETWORK_ID);
                this._info.appcDeviceDescription = String(dtaq.APPC_DEVICE_DESCRIPTION);
            }
        }
    }

    private async _fetchEntries() {
        this._entries.length = 0;
        const entryRows: DB2Row[] = await this.content.runSQL(`
        Select MESSAGE_DATA, MESSAGE_ENQUEUE_TIMESTAMP, SENDER_JOB_NAME, SENDER_CURRENT_USER ${this._keyed ? ",KEY_DATA" : ""}
        From TABLE(QSYS2.DATA_QUEUE_ENTRIES(
            DATA_QUEUE_LIBRARY => '${this.library}',
            DATA_QUEUE => '${this.name}'
        ))
        Order By ORDINAL_POSITION`);

        this._entries.push(...entryRows.map(toEntry));
    }

    generateHTML(): string {
        return Components.panels([
            { title: "Data Queue", content: this.renderDataQueuePanel() },
            { title: "Messages", badge: this._entries.length, content: renderEntries(this._keyed, this._entries) }
        ], { style: "height:100vh" });
    }

    async handleAction(data: any): Promise<HandleActionResult> {
        const uri = vscode.Uri.parse(data.href);
        let refetch = false;
        switch (uri.path) {
            case ACTION_CLEAR:
                if (await DataQueueActions.clearDataQueue(this)) {
                    refetch = true;
                }
                break;

            case ACTION_SEND:
                if (await DataQueueActions.sendToDataQueue(this)) {
                    refetch = true;
                }
        }
        if (refetch) {
            await this.fetch();
        }
        return { rerender: refetch };
    }

    async save() {

    }

    private renderDataQueuePanel(): string {
        return /*html*/ `${Components.keyValueTable(infoKey, infoValue, Object.entries(this._info))}
        ${Components.divider()}
        ${Components.button("Send data", { action: ACTION_SEND, icon: { name: "arrow-right", left: true } })}
        ${Components.button("Clear", { action: ACTION_CLEAR, appearance: "secondary", icon: { name: "clear-all", left: true } })}
        `;
    }
}

function toEntry(row: DB2Row): Entry {
    return {
        data: String(row.MESSAGE_DATA),
        timestamp: String(row.MESSAGE_ENQUEUE_TIMESTAMP),
        key: row.KEY_DATA ? String(row.KEY_DATA) : undefined,
        senderJob: String(row.SENDER_JOB_NAME || '-'),
        senderUser: String(row.SENDER_CURRENT_USER || '-'),
    };
}

function infoKey(entry: [string, string | number | boolean]) {
    return entry[0].split('')
        .map((letter, index) => (index === 0 || letter.toUpperCase() === letter) ? ` ${letter.toUpperCase()}` : letter)
        .join('')
        .trim();
}

function infoValue(entry: [string, string | number | boolean]) {
    let value = entry[1];
    if (typeof value === "boolean") {
        return value ? "✔" : "✖"; //I can't display codicons 😕
    }
    else if (typeof value === "number") {
        return Components.badge(value);
    }
    else {
        return value;
    }
}

function renderEntries(keyed: boolean, entries: Entry[]) {
    const columns: Components.Column<Entry>[] = [];
    if (keyed) {
        columns.push({ title: "Key", size: "1fr", cellValue: e => e.key! });
    }

    columns.push(
        { title: "Data", size: "3fr", cellValue: e => e.data }
    );

    return Components.dataGrid<Entry>({ stickyHeader: true, columns: columns }, entries);
}

function toBoolean(value: any) {
    return value === "YES";
}