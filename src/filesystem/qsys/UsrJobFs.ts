import { stringify, parse, ParsedUrlQueryInput, ParsedUrlQuery } from "querystring";
import vscode, { FilePermission, l10n } from "vscode";
import { Code4i } from "../../tools";
import { IBMiUserJob, DspJobOpenOptions } from "../../typings";
import { IBMiContentJobs } from "../../api/IBMiContentJobs";
import fs from 'fs';
import util from 'util';
import path from 'path';
import os from "os";
const writeFileAsync = util.promisify(fs.writeFile);

export function getUsrJobDetailFileUri(userJob: IBMiUserJob, options?: DspJobOpenOptions) {
  return getUriFromPath(`${userJob.jobName}.dspjob`, options);
}
export function getUriFromPathMsg(path: string, options?: DspJobOpenOptions) {
  return getUriFromPath(path, options);
}
export function getUriFromPath(path: string, options?: DspJobOpenOptions) {
  const query = stringify(options as ParsedUrlQueryInput);
  return vscode.Uri.parse(path).with({ scheme: `usrjob`, path: `/${path}`, query });
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
export function parseFSOptions(uri: vscode.Uri): DspJobOpenOptions {
  const parameters = parse(uri.query);
  return {
    readonly: parameters.readonly === `true`
  };
}
export function isProtectedFilter(filter?: string): boolean {
  return filter && Code4i.getConfig()?.objectFilters.find(f => f.name === filter)?.protected || false;
}

export class UsrJobFS implements vscode.FileSystemProvider {

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
    // uri: `usrjob://${job.jobName}.dspjob``,
    // uriPath: `/${job.jobName}.dspjob``,
    const options: ParsedUrlQuery = parse(uri.query);

    const userJobDetails = await IBMiContentJobs.downloadJobDetails(uri.path, options);
    if (userJobDetails !== undefined) {
      return new Uint8Array(Buffer.from(userJobDetails, `utf8`));
    }
    else {
      throw new Error(l10n.t(`Couldn't read ${uri}; check IBM i connection.`));
    }
  }

  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { readonly create: boolean; readonly overwrite: boolean; }) {
    // uri: `usrjob://${job.jobName}.dspjob``,
    // uriPath: `/${job.jobName}.dspjob``,
    const lpath = uri.path.split(`/`);
    let localFilepath = os.homedir() + `/` + lpath[3] + `.txt`;
    let savFilepath = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(localFilepath) });
    if (savFilepath) {
      let localPath = savFilepath.path;
      if (process.platform === `win32`) {
        //Issue with getFile not working propertly on Windows
        //when there was a / at the start.
        if (localPath[0] === `/`) { localPath = localPath.substring(1); }
      }
      try {
        await writeFileAsync(localPath, content);
        vscode.window.showInformationMessage(l10n.t(`Spooled File, ${uri}, was saved.`));
      } catch (e) {
        vscode.window.showErrorMessage(l10n.t(`Error saving Spoooled File, ${uri}! ${e}`));
      }
    }
    throw new Error(l10n.t("Method not implemented."));
  }

  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { readonly overwrite: boolean; }): void | Thenable<void> {
    throw new Error(l10n.t("Method not implemented."));
  }

  watch(uri: vscode.Uri, options: { readonly recursive: boolean; readonly excludes: readonly string[]; }): vscode.Disposable {
    return { dispose: () => { } };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    throw new Error(l10n.t("Method not implemented."));
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    throw new Error(l10n.t("Method not implemented."));
  }

  delete(uri: vscode.Uri, options: { readonly recursive: boolean; }): void | Thenable<void> {
    throw new Error(l10n.t("Method not implemented."));
  }
}
function generateSequencedFileName(uri: vscode.Uri): string {
  const dir = path.dirname(uri.fsPath);
  const baseName = path.basename(uri.fsPath, path.extname(uri.fsPath));
  const extensionName = path.extname(uri.fsPath);

  let sequenceName = `${baseName}${extensionName}`;
  let sequence = 1;

  while (fs.existsSync(path.join(dir, sequenceName))) {
    sequenceName = `${baseName} (${sequence})${extensionName}`;
    sequence++;
  }
  return path.join(dir, sequenceName);
}