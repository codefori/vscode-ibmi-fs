import { getBase } from "../tools";
import { Components } from "../webviewToolkit";
import Base from "./base";

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
    private keyed = false;
    async fetch() {
        const content = getBase().getContent();
        if (content) {
            await this._fetchInfo(content);
            await this._fetchEntries(content);
        }
        else {
            throw new Error("No connection.");
        }
    }

    async _fetchInfo(content: any) {
        const [dtaq]: DB2Row[] = await content.runSQL(
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
                this.keyed = true;
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

    async _fetchEntries(content: any) {
        this._entries.length = 0;
        const entryRows: DB2Row[] = await content.runSQL(`
        Select MESSAGE_DATA, MESSAGE_ENQUEUE_TIMESTAMP, SENDER_JOB_NAME, SENDER_CURRENT_USER ${this.keyed ? ",KEY_DATA" : ""}
        From TABLE(QSYS2.DATA_QUEUE_ENTRIES(
            DATA_QUEUE_LIBRARY => '${this.library}',
            DATA_QUEUE => '${this.name}'
        ))
        Order By ORDINAL_POSITION`);

        this._entries.push(...entryRows.map(toEntry));
    }

    generateHTML(): string {
        const infoEntries = Object.entries(this._info);
        return /*html*/`${Components.panels([
            { title: "Messages", badge: this._entries.length, content: renderEntries(this.keyed, this._entries) },
            { title: "Data Queue Info", content: /*html*/ `<p>${infoEntries.map(renderInfoEntry).join("<br/>")}</p>` }
        ],
            { style: "height:100vh" })}
        `;
    }

    handleAction(data: any): HandleActionResult {
        return {

        };
    }

    async save() {

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

function renderInfoEntry(entry: [string, string | number | boolean]) {
    const label = labelize(entry[0]);
    let value = entry[1];
    if (typeof value === "boolean") {
        value = value ? "✔" : "✖"; //I can't display codicons 😕
    }
    else if (typeof value === "number") {
        value = Components.badge(value);
    }
    else {
        value = /* html */`<code>${value}</code>`;
    }

    return /* html */`<span>${label}:</b> ${value}`;
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

function labelize(name: string) {
    return name.split('').map((letter, index) => (index === 0 || letter.toUpperCase() === letter) ? ` ${letter.toUpperCase()}` : letter).join('').trim();
}