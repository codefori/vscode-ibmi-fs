import { CustomDocument, Uri } from "vscode";

export default abstract class Base implements CustomDocument {
    constructor(readonly uri: Uri, readonly library: string, readonly name: string) {}

    dispose(): void {
        //throw new Error("Method not implemented.");
    }

    /**
     * Fetch is called first and when reverted. This should be used 
     * to fetch data from the remote system. Data should be stored in
     * private properties to the extended class.
     */
    abstract fetch(): Promise<void>;

    /**
     * Generate the HTML for the custom editor. This supports any
     * HTML. The new webview-ui-toolkit framework is being used as
     * the component framework and anything from there can be used.
     * https://github.com/microsoft/vscode-webview-ui-toolkit/tree/main/src
     */
    abstract generateHTML(): string;

    /**
     * This is called when any link, button or other has been pressed
     * within the HTML view with the `href` attribute, where the link
     * scheme is `action`. Attributes from the clicked element are
     * passed in to the data parameter. 
     * 
     * <vscode-link href="action:create">Create</vscode-link>
     * 
     * Or, for a list
     * 
     * <vscode-link href="action:delete" item="${node.name}">
     *   Delete
     * </vscode-link> 
     * 
     * This method should also update any private properties
     * and return true if there were any valid changes.
     * Returning true sets document to dirty and calls generateHTML.
     */
    abstract handleAction(data: any): boolean;

    /**
     * Use this method to run any remote commands to update the object
     * being worked with based on the private properties. Throw an 
     * error with a meaningful message if the object failed to save. 
     * When there are no errors, it is assumed the document/object 
     * is saved and is no longer dirty.
     */
    abstract save(): Promise<void>;
}