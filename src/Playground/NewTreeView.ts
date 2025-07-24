// New message tree code
import * as vscode from 'vscode';

// Define the two types of tree items
class MessageQueueItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
    }
}

class MessageItem extends vscode.TreeItem {
    constructor(
        public readonly label: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None); // No children for a message
    }
}

export class MessageQueueProvider implements vscode.TreeDataProvider<vscode.TreeItem> {

    // (Optional) An event emitter to refresh the tree view
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null> = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null> = this._onDidChangeTreeData.event;

    constructor() {}

    // Required: Returns the UI representation (TreeItem) of the element
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    // Required: Returns the children of the given element or the root if no element is passed
    getChildren(element?: vscode.TreeItem): vscode.ProviderResult<vscode.TreeItem[]> {
        if (!element) {
            // Top level: Return MessageQueueItems
            // This is where you would fetch message queue names from your configuration
            const messageQueueNames = this.getMessageQueueNamesFromConfig();
            return Promise.resolve(
                messageQueueNames.map(queueName => new MessageQueueItem(queueName, vscode.TreeItemCollapsibleState.Collapsed))
            );
        } else if (element instanceof MessageQueueItem) {
            // Second level: Return MessageItems for the expanded MessageQueue
            return this.getMessagesForQueue(element.label); // Lazy load messages here
        }
        return Promise.resolve([]); // No children for MessageItems or other types
    }

    // Helper methods (replace with your actual data fetching logic)
    private getMessageQueueNamesFromConfig(): string[] {
        // In a real scenario, read from the extension's configuration or a backend
        return ['QueueA', 'QueueB', 'QueueC'];
    }

    private getMessagesForQueue(queueName: string): Promise<MessageItem[]> {
        // Simulate a delay for lazy loading messages
        return new Promise(resolve => {
            setTimeout(() => {
                const messages: MessageItem[] = [];
                for (let i = 0; i < 5; i++) {
                    messages.push(new MessageItem(`Message ${i + 1} from ${queueName}`));
                }
                resolve(messages);
            }, 500); // Simulate network/data fetching delay
        });
    }

    // (Optional) Method to refresh the tree view (e.g., when the configuration changes)
    refresh(): void {
        this._onDidChangeTreeData.fire(undefined); // undefined refreshes the entire tree
    }
}