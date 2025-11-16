import { IBMiObject } from '@halcyontech/vscode-ibmi-types';
import { Tools } from '@halcyontech/vscode-ibmi-types/api/Tools';
import * as vscode from 'vscode';
import { Components } from "../webviewToolkit";
import Base from "./base";
import { getInstance } from '../ibmi';
import { getColumns,generateTableHtml } from "../tools"; 

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
            const ibmi = getInstance();
            const connection = ibmi?.getConnection();
            if (connection) {
                await connection.runSQL(`Call QSYS2.CLEAR_DATA_QUEUE('${name}', '${library}');`);
                vscode.window.showInformationMessage(`Data Queue ${library}/${name} cleared.`);
                return true;
            } else {
                vscode.window.showErrorMessage(`Not connected to IBM i`);
                return false;
            }
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
                if (data.length > Number(dataQueue.keyLength)) {
                    return `Key data is too long (maximum ${dataQueue.keyLength} characters)`;
                }
            }
        }) : "";
        if (!dataQueue.keyed || key) {
            const fmt = await vscode.window.showInputBox({
                placeHolder: "YES/NO",
                title: `Is message in UTF8 format?`,
                validateInput: fmt => {
                    if (fmt.toUpperCase()!=='YES' && fmt.toUpperCase()!=='NO') {
                        return `You need to put YES or NO`;
                    }
                }
            });
            const data = await vscode.window.showInputBox({
                placeHolder: "message",
                title: `Enter message`,
                validateInput: data => {
                    if (data.length > Number(dataQueue.maximumMessageLength)) {
                        return `Message is too long (maximum ${dataQueue.maximumMessageLength} characters)`;
                    }
                }
            });
            if (data) {
                const ibmi = getInstance();
                const connection = ibmi?.getConnection();
                if (connection) {
                    if(fmt==='YES'){
                        await connection.runSQL(`CALL QSYS2.SEND_DATA_QUEUE_UTF8(${key ? `KEY_DATA => '${key}',` : ""} MESSAGE_DATA => '${data}',                      
                            DATA_QUEUE => '${dataQueue.name}', DATA_QUEUE_LIBRARY => '${dataQueue.library}')`);
                    } else {
                        await connection.runSQL(`CALL QSYS2.SEND_DATA_QUEUE(${key ? `KEY_DATA => '${key}',` : ""} MESSAGE_DATA => '${data}',                      
                            DATA_QUEUE => '${dataQueue.name}', DATA_QUEUE_LIBRARY => '${dataQueue.library}')`);
                    }
                    vscode.window.showInformationMessage(`Data successfully sent to ${dataQueue.library}/${dataQueue.name}.`);
                    return true;
                } else {
                    vscode.window.showErrorMessage(`Not connected to IBM i`);
                    return false;
                }
            }
        }
        return false;
    };
}

interface Entry {
    key?: string
    data: string
    datautf8: string
    timestamp: string
    senderJob: string
    senderUser: string
}

export class DataQueue extends Base {
    private readonly _info: Record<string, string | boolean | number> = {};
    private readonly _entries: Entry[] = [];
    private _keyed = false;
    columns: Map<string, string> = new Map();
    selectClause: string | undefined;
    private dtaq?:any;

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

    async fetchInfo() {
        const ibmi = getInstance();
        const connection = ibmi?.getConnection();

        if (connection) {
            this.columns = await getColumns(connection,'DATA_QUEUE_INFO');
            let sql: string;

            this.dtaq = await connection. runSQL(
                `SELECT DATA_QUEUE_TYPE
                FROM QSYS2.DATA_QUEUE_INFO
                WHERE DATA_QUEUE_NAME = '${this.name}' AND DATA_QUEUE_LIBRARY = '${this.library}'
                Fetch first row only`)

            if(this.dtaq[0].DATA_QUEUE_TYPE==='DDM'){
                sql=`SELECT DATA_QUEUE_NAME,
                    DATA_QUEUE_LIBRARY,
                    DATA_QUEUE_TYPE,
                    TEXT_DESCRIPTION,
                    REMOTE_DATA_QUEUE_LIBRARY,
                    REMOTE_DATA_QUEUE,
                    REMOTE_LOCATION,
                    RELATIONAL_DATABASE_NAME,
                    APPC_DEVICE_DESCRIPTION,
                    LOCAL_LOCATION,
                    "MODE",
                    REMOTE_NETWORK_ID`
            } else {
                sql=`SELECT DATA_QUEUE_NAME,
                    DATA_QUEUE_LIBRARY,
                    DATA_QUEUE_TYPE,
                    MAXIMUM_MESSAGE_LENGTH,
                    "SEQUENCE",
                    KEY_LENGTH,
                    INCLUDE_SENDER_ID,
                    CURRENT_MESSAGES,
                    MAXIMUM_MESSAGES,
                    SPECIFIED_MAXIMUM_MESSAGES,
                    INITIAL_MESSAGE_ALLOCATION,
                    CURRENT_MESSAGE_ALLOCATION,
                    FORCE,
                    AUTOMATIC_RECLAIM,
                    LAST_RECLAIM_TIMESTAMP,
                    ENFORCE_DATA_QUEUE_LOCKS,
                    TEXT_DESCRIPTION`
            }

            sql=sql.trim()+` FROM QSYS2.DATA_QUEUE_INFO
                WHERE DATA_QUEUE_NAME = '${this.name}' AND DATA_QUEUE_LIBRARY = '${this.library}'
                Fetch first row only`

            this.dtaq = await connection. runSQL(sql)
        }
    }

    private async _fetchEntries() {
        const ibmi = getInstance();
        const connection = ibmi?.getConnection();
        if (connection) {
            this._entries.length = 0;
            const entryRows = await connection.runSQL(`
                Select MESSAGE_DATA, MESSAGE_DATA_UTF8, MESSAGE_ENQUEUE_TIMESTAMP, SENDER_JOB_NAME, SENDER_CURRENT_USER ${this._keyed ? ",KEY_DATA" : ""}
                From TABLE(QSYS2.DATA_QUEUE_ENTRIES(
                    DATA_QUEUE_LIBRARY => '${this.library}',
                    DATA_QUEUE => '${this.name}'
                ))
                Order By ORDINAL_POSITION`);

            this._entries.push(...entryRows.map(toEntry));
        }
    }

    generateHTML(): string {
        return Components.panels([
            { title: "Data Queue", content: this.renderDataQueuePanel() },
            { title: "Messages", badge: this._entries.length, content: renderEntries(this._keyed, this._entries, false) },
            { title: "Messages UTF8", badge: this._entries.length, content: renderEntries(this._keyed, this._entries, true) }
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

        let html=generateTableHtml(this.columns,this.dtaq);
        html=html.trim()+`
        ${Components.divider()}
        </br>
        ${Components.button("Send message 💬", { action: ACTION_SEND, style:"width:100%; text-align: center" })}
        </br>
        ${Components.button("Clear 🧹", { action: ACTION_CLEAR, appearance: "secondary", style:"width:100%; text-align: center" })}`;

        return html;
    }
}

function toEntry(row: Tools.DB2Row): Entry {
    return {
        data: String(row.MESSAGE_DATA),
        datautf8: String(row.MESSAGE_DATA_UTF8),
        timestamp: String(row.MESSAGE_ENQUEUE_TIMESTAMP),
        key: row.KEY_DATA ? String(row.KEY_DATA) : undefined,
        senderJob: String(row.SENDER_JOB_NAME || '-'),
        senderUser: String(row.SENDER_CURRENT_USER || '-'),
    };
}

function renderEntries(keyed: boolean, entries: Entry[], isUtf8: boolean) {
    const columns: Components.Column<Entry>[] = [];
    if (keyed) {
        columns.push({ title: "Key", size: "1fr", cellValue: e => e.key! });
    }

    columns.push(
        { title: "Timestamp", size: "0.5fr", cellValue: e => e.timestamp },
        { title: "User", size: "0.5fr", cellValue: e => e.senderUser },
    );

    if(isUtf8){
        columns.push({ title: "Message", size: "3fr", cellValue: e => e.datautf8 });
    } else {
        columns.push({ title: "Message", size: "3fr", cellValue: e => e.data });
    }

    return Components.dataGrid<Entry>({ stickyHeader: true, columns: columns }, entries);
}