import { stringify, parse, ParsedUrlQueryInput, ParsedUrlQuery } from "querystring";
import vscode, { FilePermission } from "vscode";
import { Code4i } from "../../tools";
import { IBMiMessageQueueMessage, MsgOpenOptions } from "../../typings";
import { IBMiContentMsgq } from "../../api/IBMiContentfs";
import fs from 'fs';
import util from 'util';
import path from 'path';


const writeFileAsync = util.promisify(fs.writeFile);

export function getMessageDetailFileUri(filterType:string, msg: IBMiMessageQueueMessage, options?: MsgOpenOptions) {
  let mashedUpPath = buildPathFileNamefromPatternMessge(filterType, msg);
  if (mashedUpPath.length === 0) {
    mashedUpPath = `${msg.messageQueueLibrary}/${msg.messageQueue}/${msg.messageType}~${msg.messageID}~${msg.messageKey}.msg`;
  }
  return getUriFromPath(mashedUpPath, options);
}
export function getUriFromPathMsg(path: string, options?: MsgOpenOptions) {
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
export function getPathFromUri(uri: vscode.Uri): string {
  const thePath = path.posix.basename(uri.path);
  return thePath;
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

export class MsgqFS implements vscode.FileSystemProvider {

  private emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

  constructor(context: vscode.ExtensionContext) {
  }

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
      // uri: `message://${msg.Qlib}/${msg.Qname}/${msg.MessageID}~${msg.KEY}.msg``,
      // uriPath: `/${msg.Qlib}/${msg.Qname}/${msg.MessageID}~${msg.KEY}.msg``,
      const options:ParsedUrlQuery = parse(uri.query);

      const messageContent = await IBMiContentMsgq.downloadMessageContent(uri.path.substring(1), `msg`, options);
      if (messageContent !== undefined) {
        return new Uint8Array(Buffer.from(messageContent, `utf8`));
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
    // const lpath = uri.path.split(`/`);
    // let localFilepath = os.homedir() + `/` + lpath[3] + `.txt`;
    // let savFilepath = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(localFilepath) });
    // if (savFilepath) {
    //   let localPath = savFilepath.path;
    //   if (process.platform === `win32`) {
    //     //Issue with getFile not working propertly on Windows
    //     //when there was a / at the start.
    //     if (localPath[0] === `/`) localPath = localPath.substring(1);
    //   }
    //   try {
    //     // let fileEncoding = `utf8`;
    //     // await writeFileAsync(localPath, content, fileEncoding);
    //     await writeFileAsync(localPath, content);
    //     vscode.window.showInformationMessage(`Message, ${uri}, was saved.`);
    //   } catch (e) {
    //     vscode.window.showErrorMessage(l10n.t(`Error saving Message, ${uri}! ${e}`));
    //   }
    // }
    // else {
    //   vscode.window.showErrorMessage(`Message, ${uri}, was not saved.`);
    // }
    throw new Error("Method not implemented.");
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
export function buildPathFileNamefromPatternMessge(filterType: string, msg: IBMiMessageQueueMessage): string {
  let newName = ``;
    newName += `${msg.messageQueueLibrary}/${msg.messageQueue}/`;
  let counter = 0;
  // get from config
  const splfBrowserConfig = vscode.workspace.getConfiguration('vscode-ibmi-fs');
  let namePattern: string = splfBrowserConfig.get<string>('messageViewNamePattern') || '';
  if (namePattern.length === 0) { namePattern = 'messageType,messageID,messageKey'; }
  // pattern values are separated by commas.  
  const patterns = namePattern.split(/,\s*/);
  // append pattern to end of passed in name.
  patterns.forEach(element => {
    if (counter > 0) {
      newName += '~';
    }
    counter++;
    switch (element) {

    case `messageType`:
      newName += msg.messageType;
      break;
    case `messageID`:
      newName += msg.messageID;
      break;
    case `messageKey`:
      newName += msg.messageKey;
      break;
    default:
    }
  });

  return newName;
}
