import path = require("path");
import {Uri, TextDocumentContentProvider, CancellationToken, ProviderResult} from "vscode";

import BindingDirectory from "./types/bindingDirectory";
import MessageFile from "./types/messageFile";

export default class BasicObjectFs implements TextDocumentContentProvider {
    _getContent(type: string, library: string, name: string) {
        switch (type.toUpperCase()) {
            case `BNDDIR`:
                return BindingDirectory.get(library, name);
            case `MSGF`:
                return MessageFile.get(library, name);
            default:
                throw new Error(`No preview for type ${type} available yet.`);
        }
    }
    async provideTextDocumentContent(uri: Uri, token: CancellationToken): Promise<string | null | undefined> {
        const pieces = uri.path.split(`/`);
        if (pieces.length === 3) {
            const library = pieces[1];
            const nameInfo = path.parse(pieces[2]);
            const type = nameInfo.ext.startsWith(`.`) ? nameInfo.ext.substring(1) : nameInfo.ext;
            
            const data = await this._getContent(type, library, nameInfo.name);
            //const encoder = new TextEncoder();
            return data;
        } else {
            throw new Error(`Invalid object path.`);
        }
    }
}

// Broken
// export default class ObjectFs implements FileSystemProvider {
//     private _emitter = new EventEmitter<FileChangeEvent[]>();
//     onDidChangeFile: Event<FileChangeEvent[]> = this._emitter.event;

//     _getContent(type: string, library: string, name: string) {
//         switch (type.toUpperCase()) {
//             case `BNDDIR`:
//                 return BindingDirectory.get(library, name);
//             default:
//                 throw new Error(`Type ${type} not supported.`);
//         }
//     }

//     async readFile(uri: Uri): Promise<Uint8Array> {
//         const pieces = uri.path.split(`/`);
//         if (pieces.length === 3) {
//             const library = pieces[1];
//             const nameInfo = path.parse(pieces[2]);
//             const type = nameInfo.ext.startsWith(`.`) ? nameInfo.ext.substring(1) : nameInfo.ext;
            
//             const data = await this._getContent(type, library, nameInfo.name);
//             //const encoder = new TextEncoder();
//             return new Uint8Array(Buffer.from(`Hello world`, `utf-8`));
//         } else {
//             throw new Error(`Invalid object path.`);
//         }
//     }

//     writeFile(uri: Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }): void | Thenable<void> {
//         throw new Error("Method not implemented.");
//     }
//     stat(uri: Uri): FileStat | Thenable<FileStat> {
//         const result: FileStat = {
//             type: FileType.File,
//             ctime: 1,
//             mtime: 1,
//             size: 100,
//         };

//         return result;
//     }

//     delete(uri: Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
//         return;
//     }
//     watch(uri: Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): Disposable {
//         return new Disposable(() => { });
//     }
//     readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
//         return [];
//     }
//     createDirectory(uri: Uri): void | Thenable<void> {
//         return;
//     }
//     rename(oldUri: Uri, newUri: Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
//         return;
//     }
// }