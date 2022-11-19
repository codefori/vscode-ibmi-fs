import { CustomDocument, Uri } from "vscode";

export default abstract class Base implements CustomDocument {
    constructor(readonly uri: Uri, readonly library: string, readonly name: string) {
        
    }    
    dispose(): void {
        //throw new Error("Method not implemented.");
    }
    abstract fetch(): Promise<void>;

    abstract generateHTML(): string;

    abstract handleAction(data: any): void;
}