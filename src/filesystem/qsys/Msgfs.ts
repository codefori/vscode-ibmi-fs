import { stringify, parse, ParsedUrlQueryInput, ParsedUrlQuery } from "querystring";
import vscode, { FilePermission, l10n } from "vscode";
import { Code4i,  } from "../../tools";
import { IBMiMessageQueueMessage, MsgOpenOptions } from "../../typings";
import { IBMiContentMsgq } from "../../api/IBMiContentMsgq";
import fs from 'fs';
import os from 'os';
import util from 'util';

const writeFileAsync = util.promisify(fs.writeFile);

export function getSpooledFileUri(msg: IBMiMessageQueueMessage, options?: MsgOpenOptions) {
  return getUriFromPath(`${msg.messageQueueLibrary}/${msg.messageQueue}/${msg.messageID}~${msg.messageKey}.msg`, options);
}
export function getUriFromPath_Msg(path: string, options?: MsgOpenOptions) {
  return getUriFromPath(path, options);
}

export function getUriFromPath(path: string, options?: MsgOpenOptions) {
  const query = stringify(options as ParsedUrlQueryInput);
  return vscode.Uri.parse(path).with({ scheme: `message`, path: `/${path}`, query });
}

export function getFilePermission(uri: vscode.Uri): FilePermission | undefined {
  const fsOptions = parseFSOptions(uri);
  if (Code4i.getConfig()?.readOnlyMode || fsOptions.readonly) {
    return FilePermission.Readonly;
  }
}

export function parseFSOptions(uri: vscode.Uri): MsgOpenOptions {
  const parameters = parse(uri.query);
  return {
    readonly: parameters.readonly === `true`
  };
}

export function isProtectedFilter(filter?: string): boolean {
  return filter && Code4i.getConfig()?.objectFilters.find(f => f.name === filter)?.protected || false;
}

export class MsgFS implements vscode.FileSystemProvider {

  private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

  constructor(context: vscode.ExtensionContext) {

    context.subscriptions.push(
      // vscode.workspace.onDidChangeConfiguration(async event => {
        // if (event.affectsConfiguration(`code-for-ibmi.connectionSettings`)) {
        //   this.updateSpooledFileSupport();
        // }
      // })
    );

    // getInstance()?.subscribe(context, `connected`, "Connection Setup" , () => this.updateSpooledFileSupport());
    // getInstance()?.subscribe(context, `disconnected`, "Disconnect clean up" , () => this.updateSpooledFileSupport());
  }

  // private updateSpooledFileSupport() {

  //   const connection = Code4i.getConnection();
  //   const config = connection?.config;

  //   if (connection) {
  //   }

  // }

  stat(uri: vscode.Uri): vscode.FileStat {
    return {
      ctime: 0,
      mtime: 0,
      size: 0,
      type: vscode.FileType.File,
      permissions: getFilePermission(uri)
    };
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    const contentApi = Code4i.getContent();
    const connection = Code4i.getConnection();
    if (connection && contentApi) {
      //           0         1            2             3  a          b                c                d                  e       
      // path: `message://${msg.Qlib}/${msg.Qname}/${msg.MessageID}~${msg.KEY}.msg``,
      const lpath = uri.path.split(`/`);
      const lfilename = lpath[3].split(`~`);
      const qualifiedJobName = lfilename[3] + '/' + lfilename[2] + '/' + lfilename[1];
      const splfNumber = lfilename[4].replace(`.msg`, ``);
      const name = lfilename[0];
      const options:ParsedUrlQuery = parse(uri.query);

      const spooledFileContent = await IBMiContentMsgq.downloadMessageContent(uri.path, `txt`, options);
      if (spooledFileContent !== undefined) {
        return new Uint8Array(Buffer.from(spooledFileContent, `utf8`));
      }
      else {
        throw new Error(`Couldn't read ${uri}; check IBM i connection.`);
      }
    }
    else {
      throw new Error("Not connected to IBM i");
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }) {
    const lpath = uri.path.split(`/`);
    let localFilepath = os.homedir() + `/` + lpath[3] + `.txt`;
    let savFilepath = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(localFilepath) });
    if (savFilepath) {
      let localPath = savFilepath.path;
      if (process.platform === `win32`) {
        //Issue with getFile not working propertly on Windows
        //when there was a / at the start.
        if (localPath[0] === `/`) localPath = localPath.substring(1);
      }
      try {
        // let fileEncoding = `utf8`;
        // await writeFileAsync(localPath, content, fileEncoding);
        await writeFileAsync(localPath, content);
        vscode.window.showInformationMessage(`Spooled File, ${uri}, was saved.`);
      } catch (e) {
        vscode.window.showErrorMessage(l10n.t(`Error saving Spoooled File, ${uri}! ${e}`));
      }
    }
    else {
      vscode.window.showErrorMessage(`Spooled file, ${uri}, was not saved.`);
    }
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): vscode.Disposable {
    return { dispose: () => { } };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    throw new Error("Method not implemented.");
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  delete(uri: vscode.Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }
}