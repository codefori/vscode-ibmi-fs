/**
 * Links from the object views to sources, other objects and jobs.
 *
 * Rendered as `<a href="action:...">` and handled by {@link Links.handle} before the
 * document's own `handleAction`.
 */

import * as vscode from 'vscode';
import { getInstance } from './ibmi';

export interface ObjectRef {
  library: string;
  name: string;
  /** Object type, e.g. `*PGM`, or a blank separated list of the types it may have */
  type: string;
}

export type SourceRef = { library: string, file: string, member: string } | { path: string };

/** Object types the FS editor can open */
const SUPPORTED_TYPES = new Set([
  '*BNDDIR', '*CLS', '*CMD', '*DTAARA', '*DTAQ', '*FILE', '*JOBD', '*JOBQ', '*JRN', '*JRNRCV',
  '*MODULE', '*MSGF', '*MSGQ', '*OUTQ', '*PGM', '*QRYDFN', '*SBSD', '*SRVPGM', '*USRIDX', '*USRSPC'
]);

export namespace Links {
  const OPEN_OBJECT = 'openObject';
  const OPEN_SOURCE = 'openSource';
  const OPEN_JOB = 'openJob';

  /** Trimmed value, or undefined for empty/null database values */
  function clean(value: unknown): string | undefined {
    const str = value === null || value === undefined ? '' : String(value).trim();
    return str && str !== 'null' ? str : undefined;
  }

  function escapeHtml(value: string) {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** Whether a library can be linked: special values (*LIBL...) aren't resolved, QTEMP belongs to another job */
  function isLinkableLibrary(library: string) {
    return !library.startsWith('*') && library.toUpperCase() !== 'QTEMP';
  }

  /**
   * Builds an object reference, or undefined when it can't be opened (incomplete, special library, unsupported type)
   * @param type - Object type, or a blank separated list of the types it may have (e.g. `*PGM *SRVPGM`)
   */
  export function object(library: unknown, name: unknown, type: unknown): ObjectRef | undefined {
    const lib = clean(library);
    const objName = clean(name);
    const types = (clean(type)?.toUpperCase() ?? '').split(/[\s,]+/)
      .filter(Boolean)
      .map(objType => objType.startsWith('*') ? objType : `*${objType}`)
      .filter(objType => SUPPORTED_TYPES.has(objType));
    if (!lib || !objName || !types.length || !isLinkableLibrary(lib)) {
      return;
    }
    return { library: lib, name: objName, type: types.join(' ') };
  }

  /** Builds an object reference from a qualified `LIB/NAME` string */
  export function qualifiedObject(qualified: unknown, type: unknown): ObjectRef | undefined {
    const [library, name] = (clean(qualified) ?? '').split('/');
    return object(library, name, type);
  }

  /** Builds a source reference: the stream file when given, otherwise the member */
  export function source(library: unknown, file: unknown, member: unknown, streamFile?: unknown): SourceRef | undefined {
    const path = clean(streamFile);
    if (path) {
      return { path };
    }
    const lib = clean(library);
    const srcFile = clean(file);
    const mbr = clean(member);
    return lib && srcFile && mbr && isLinkableLibrary(lib) ? { library: lib, file: srcFile, member: mbr } : undefined;
  }

  export function objectHref(obj?: ObjectRef): string | undefined {
    return obj ? `action:${OPEN_OBJECT}?${new URLSearchParams({ objlib: obj.library, objname: obj.name, objtype: obj.type })}` : undefined;
  }

  export function sourceHref(src?: SourceRef): string | undefined {
    if (!src) {
      return;
    }
    const params = new URLSearchParams('path' in src ? { stmf: src.path } : { srclib: src.library, srcfile: src.file, srcmbr: src.member });
    return `action:${OPEN_SOURCE}?${params}`;
  }

  /** Link to an object given as a qualified `LIB/NAME` string */
  export function qualifiedHref(qualified: unknown, type: unknown): string | undefined {
    return objectHref(qualifiedObject(qualified, type));
  }

  /** Link to a job given as a qualified `NUMBER/USER/NAME` string */
  export function jobHref(job: unknown): string | undefined {
    const name = clean(job);
    return name && /^\d{6}\/[^/]+\/[^/]+$/.test(name) ? `action:${OPEN_JOB}?${new URLSearchParams({ job: name })}` : undefined;
  }

  /** HTML for a table cell: a link when there's a target, the escaped text otherwise */
  function html(text: unknown, href?: string): string {
    const value = escapeHtml(clean(text) ?? '');
    return href && value ? `<a class="fs-link" href="${escapeHtml(href)}">${value}</a>` : value;
  }

  export function objectLink(text: unknown, obj?: ObjectRef): string {
    return html(text, objectHref(obj));
  }

  /** Cell linking an object shown as a qualified `LIB/NAME` string */
  export function qualifiedLink(qualified: unknown, type: unknown): string {
    return html(qualified, qualifiedHref(qualified, type));
  }

  export function sourceLink(text: unknown, src?: SourceRef): string {
    return html(text, sourceHref(src));
  }

  /** Cell linking a job shown as a qualified `NUMBER/USER/NAME` string */
  export function jobLink(job: unknown): string {
    return html(job, jobHref(job));
  }

  /**
   * Handles the link actions.
   * @returns true when the message was a link action, false to let the document handle it
   */
  export async function handle(data: any): Promise<boolean> {
    const href: unknown = data?.href;
    if (typeof href !== 'string' || !href.startsWith('action:')) {
      return false;
    }

    const body = href.substring('action:'.length);
    const queryStart = body.indexOf('?');
    const action = queryStart < 0 ? body : body.substring(0, queryStart);
    const params = new URLSearchParams(queryStart < 0 ? '' : body.substring(queryStart + 1));

    switch (action) {
      case OPEN_OBJECT: {
        const obj = object(params.get('objlib'), params.get('objname'), params.get('objtype'));
        if (obj) {
          await run(() => openObject(obj));
        }
        return true;
      }

      case OPEN_SOURCE: {
        const src = source(params.get('srclib'), params.get('srcfile'), params.get('srcmbr'), params.get('stmf'));
        if (src) {
          await run(() => openSource(src));
        }
        return true;
      }

      case OPEN_JOB: {
        const job = params.get('job');
        if (job) {
          await run(async () => { await vscode.commands.executeCommand('vscode-ibmi-fs.wrkjob', job); });
        }
        return true;
      }
    }

    return false;
  }

  async function run(open: () => Promise<void>) {
    try {
      await open();
    } catch (error: any) {
      vscode.window.showErrorMessage(vscode.l10n.t("Unable to open: {0}", String(error?.message ?? error)));
    }
  }

  /** Opens an object in the FS editor; the attribute (needed to tell files apart) is read from the system */
  async function openObject(obj: ObjectRef) {
    const connection = getInstance()?.getConnection();
    if (!connection) {
      vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
      return;
    }

    const [row] = await connection.runSQL(
      `SELECT OBJTYPE, OBJATTRIBUTE FROM TABLE(QSYS2.OBJECT_STATISTICS(?, ?, ?)) FETCH FIRST 1 ROW ONLY`,
      { bindings: [obj.library, obj.type, obj.name] }
    );
    const type = clean(row?.OBJTYPE);
    if (!type) {
      vscode.window.showErrorMessage(vscode.l10n.t("Object {0} not found.", `${obj.library}/${obj.name} (${obj.type})`));
      return;
    }

    const uri = vscode.Uri.from({
      scheme: `object`,
      path: `/${obj.library}/${obj.name}.${type.substring(1)}`,
      fragment: clean(row.OBJATTRIBUTE) ?? ''
    });
    await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor');
  }

  /** Opens a source member or stream file through Code for IBM i, honouring its default open mode */
  async function openSource(src: SourceRef) {
    let path: string;
    if ('path' in src) {
      path = src.path;
    } else {
      const connection = getInstance()?.getConnection();
      if (!connection) {
        vscode.window.showErrorMessage(vscode.l10n.t("Not connected to IBM i"));
        return;
      }

      // The extension sets the language of the editor
      const [member] = await connection.getContent().getMemberList({ library: src.library, sourceFile: src.file, members: src.member });
      if (!member) {
        vscode.window.showErrorMessage(vscode.l10n.t("Source member {0} not found.", `${src.library}/${src.file}(${src.member})`));
        return;
      }
      path = `${member.library}/${member.file}/${member.name}${member.extension ? `.${member.extension}` : ''}`;
    }

    await vscode.commands.executeCommand('code-for-ibmi.openWithDefaultMode', { path });
  }
}
