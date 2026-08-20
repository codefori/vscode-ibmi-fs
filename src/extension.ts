// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import ObjectProvider from './objectProvider';
import { DataQueueActions } from './types/dataQueue';
import { SaveFileActions } from './types/saveFile';
import { getInstance, getVSCodeTools, loadBase } from './ibmi';
import { DataAreaActions } from './types/dataArea';
import { JobQueueActions } from './types/jobQueue';
import { OutputQueueActions } from './types/outputQueue';
import { UserSpaceActions } from './types/userSpace';
import { BindingDirectoryActions } from './types/bindingDirectory';
import { JournalActions } from './types/journal';
import { SubsystemActions } from './types/subsystemDescription';
import { MessageQueueActions } from './types/messageQueue';
import { MessageFileActions } from './types/messageFile';
import { FileActions } from './types/file';
import { UserIndexActions } from './types/userIndex';
import { JobDescriptionActions } from './types/jobDescription';
import { DspobjActions } from './views/dspobj';
import { WrksplfActions } from './views/wrksplf';
import { WrkjobActions } from './views/wrkjob';
import { WrkactjobActions } from './views/wrkactjob';
import { WrkusrjobActions } from './views/wrkusrjob';
import { DocumentManager } from './documentManager';

/**
 * A single entry of the FS Quick Start menu.
 * Users can override the whole menu via the `vscode-ibmi-fs.quickStartMenu` setting.
 */
interface QuickStartMenuItem {
  /** Text shown for the entry */
  label: string;
  /** Optional secondary text shown next to the label */
  description?: string;
  /** Optional codicon name (without the surrounding `$()`), e.g. "server-process" */
  icon?: string;
  /** Command id executed when the entry is selected */
  command: string;
  /** Optional arguments passed to the command when the entry is selected */
  args?: string[];
}

/**
 * A command that can be picked as the target of a FS Quick Start menu entry,
 * used by the "Add/Edit menu entry" wizard.
 */
interface QuickStartCommandChoice {
  label: string;
  description?: string;
  command: string;
  icon?: string;
}

/** A command contributed by another installed extension, read from its package.json. */
interface QuickStartExtensionCommand {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

/** An installed extension that contributes at least one command. */
interface QuickStartExtensionEntry {
  id: string;
  label: string;
  commandCount: number;
}

/** Codicon names offered by the "Add/Edit menu entry" wizard, plus a free-text option for anything else. */
const QUICK_START_ICON_CHOICES = [
  'mail', 'server-process', 'list-tree', 'account', 'output-view-icon',
  'extensions-info-message', 'search-view-icon', 'chat-editor-label-icon',
  'callhierarchy-incoming', 'symbol-misc', 'symbol-object', 'symbol-event', 'symbol-file',
  'info', 'terminal', 'terminal-view-icon', 'database', 'file-code', 'folder-library',
  'debug-alt', 'debug-start', 'debug-stop', 'play', 'primitive-square', 'refresh',
  'trash', 'edit', 'add', 'remove', 'gear', 'settings-gear', 'checklist', 'note',
  'output', 'organization', 'briefcase', 'archive', 'package', 'tools', 'wrench',
  'zap', 'pulse', 'graph', 'history', 'clock', 'calendar', 'bell', 'bookmark', 'tag', 'link', 'globe'
];

/**
 * The built-in FS Quick Start menu entries, used whenever the user hasn't
 * customized the `vscode-ibmi-fs.quickStartMenu` setting.
 */
function getDefaultQuickStartMenuItems(): QuickStartMenuItem[] {
  return [
    { icon: 'callhierarchy-incoming', label: 'DSPMSG', description: vscode.l10n.t(`Display User's message`), command: 'vscode-ibmi-fs.dspUsrMsg' },
    { icon: 'chat-editor-label-icon', label: 'DSPMSG QSYSOPR', description: vscode.l10n.t('Display System Operator Messages'), command: 'vscode-ibmi-fs.dspmsgQsysopr' },
    { icon: 'extensions-info-message', label: 'DSPOBJ', description: vscode.l10n.t('Display Object Information'), command: 'vscode-ibmi-fs.dspobj' },
    { icon: 'search-view-icon', label: 'DSPOBJ Detailed', description: vscode.l10n.t('Display Object Information (single input)'), command: 'vscode-ibmi-fs.dspobjDetailed' },
    { icon: 'output-view-icon', label: 'WRKSPLF', description: vscode.l10n.t('Work with Spooled Files'), command: 'vscode-ibmi-fs.wrksplf' },
    { icon: 'server-process', label: 'WRKJOB', description: vscode.l10n.t('Work with Job'), command: 'vscode-ibmi-fs.wrkjob' },
    { icon: 'list-tree', label: 'WRKACTJOB', description: vscode.l10n.t('Work with Active Jobs'), command: 'vscode-ibmi-fs.wrkactjob' },
    { icon: 'account', label: 'WRKUSRJOB', description: vscode.l10n.t('Work with User Jobs'), command: 'vscode-ibmi-fs.wrkusrjob' },
  ];
}

/**
 * Reads the commands contributed to the Command Palette by an installed
 * extension, straight from its package.json (`contributes.commands`).
 */
function getContributedCommands(extensionId: string): QuickStartExtensionCommand[] {
  const ext = vscode.extensions.getExtension(extensionId);
  const contributed = ext?.packageJSON?.contributes?.commands;
  if (!Array.isArray(contributed)) {
    return [];
  }

  return contributed
    .filter((c: any) => typeof c?.command === 'string' && typeof c?.title === 'string')
    .map((c: any) => ({
      command: c.command as string,
      title: c.title as string,
      category: typeof c.category === 'string' ? c.category : undefined,
      icon: typeof c.icon === 'string' ? c.icon.replace(/^\$\(|\)$/g, '') : undefined
    }));
}

/**
 * Lists installed extensions that contribute at least one command, with
 * HalcyonTech Ltd and other IBM i-related extensions surfaced first for
 * convenience.
 */
function getExtensionsWithCommands(): QuickStartExtensionEntry[] {
  return vscode.extensions.all
    .map(ext => ({
      id: ext.id,
      label: (ext.packageJSON?.displayName as string | undefined) || ext.id,
      commandCount: getContributedCommands(ext.id).length
    }))
    .filter(entry => entry.commandCount > 0)
    .sort((a, b) => {
      const aPinned = getPinRank(a.id);
      const bPinned = getPinRank(b.id);
      return aPinned !== bPinned ? aPinned - bPinned : a.label.localeCompare(b.label);
    });
}

/**
 * Sort rank used to surface HalcyonTech Ltd extensions first, followed by
 * other IBM i-related extensions, then everything else alphabetically.
 */
function getPinRank(extensionId: string): number {
  if (/^halcyontechltd\./i.test(extensionId)) {
    return 0;
  }
  if (/ibmi/i.test(extensionId)) {
    return 1;
  }
  return 2;
}

/**
 * Reads the raw, user-customized FS Quick Start menu entries (empty when the
 * user hasn't customized the `vscode-ibmi-fs.quickStartMenu` setting yet).
 */
function getCustomQuickStartMenuItems(): QuickStartMenuItem[] {
  const custom = vscode.workspace.getConfiguration('vscode-ibmi-fs').get<QuickStartMenuItem[]>('quickStartMenu', []);
  return Array.isArray(custom) ? custom.filter(item => item && typeof item.command === 'string' && item.command.trim().length > 0) : [];
}

/**
 * Reads the FS Quick Start menu entries, honouring the user's customization
 * (if any) stored in the `vscode-ibmi-fs.quickStartMenu` setting. When that
 * setting is left empty, the built-in default menu is used instead.
 */
function getQuickStartMenuItems(): QuickStartMenuItem[] {
  const custom = getCustomQuickStartMenuItems();
  return custom.length > 0 ? custom : getDefaultQuickStartMenuItems();
}

/**
 * Returns a modifiable copy of the current menu, seeded with the built-in
 * defaults the first time a user customizes the menu via the wizard.
 */
function getEditableQuickStartMenuItems(): QuickStartMenuItem[] {
  const custom = getCustomQuickStartMenuItems();
  return custom.length > 0 ? [...custom] : getDefaultQuickStartMenuItems();
}

/**
 * Persists the FS Quick Start menu entries, writing to whichever scope
 * (workspace or user/global) already holds the setting.
 */
async function saveQuickStartMenuItems(items: QuickStartMenuItem[]) {
  const config = vscode.workspace.getConfiguration('vscode-ibmi-fs');
  const target = config.inspect<QuickStartMenuItem[]>('quickStartMenu')?.workspaceValue !== undefined
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update('quickStartMenu', items, target);
}

/**
 * Prompts for a comma-separated list of arguments to pass to a command.
 * Returns `null` if the user cancels, `undefined` if they leave it empty.
 */
async function promptForCommandArgs(existing?: string[]): Promise<string[] | undefined | null> {
  const argsInput = await vscode.window.showInputBox({
    prompt: vscode.l10n.t('Optional: comma-separated arguments to pass to the command'),
    value: existing?.join(', '),
    placeHolder: vscode.l10n.t('Leave empty for none')
  });
  if (argsInput === undefined) {
    return null;
  }
  const trimmed = argsInput.split(',').map(a => a.trim()).filter(a => a.length > 0);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Guides the user through picking a command contributed by an installed
 * extension: first the extension, then one of its commands.
 */
async function promptForExtensionCommand(): Promise<QuickStartExtensionCommand | undefined> {
  const extensions = getExtensionsWithCommands();
  if (extensions.length === 0) {
    vscode.window.showInformationMessage(vscode.l10n.t('No installed extension exposes any command'));
    return undefined;
  }

  const extensionPick = await vscode.window.showQuickPick(
    extensions.map(entry => ({ label: entry.label, description: vscode.l10n.t('{0} command(s)', entry.commandCount), id: entry.id })),
    { placeHolder: vscode.l10n.t('Select the extension to browse') }
  );
  if (!extensionPick) {
    return undefined;
  }

  const commands = getContributedCommands(extensionPick.id);
  const commandPick = await vscode.window.showQuickPick(
    commands.map(c => ({
      label: c.icon ? `$(${c.icon}) ${c.title}` : c.title,
      description: c.category,
      detail: c.command,
      entry: c
    })),
    { placeHolder: vscode.l10n.t('Select a command'), matchOnDetail: true }
  );
  return commandPick?.entry;
}

/**
 * Prompts the user, step by step, for the fields of a FS Quick Start menu
 * entry. Pass an existing entry to pre-fill the prompts when editing.
 * Returns undefined if the user cancels at any step.
 */
async function promptForQuickStartMenuItem(existing?: QuickStartMenuItem): Promise<QuickStartMenuItem | undefined> {
  type CommandSource =
    | { kind: 'default'; choice: QuickStartCommandChoice }
    | { kind: 'anyObject' }
    | { kind: 'browse' }
    | { kind: 'manual' };

  const sourcePicks: (vscode.QuickPickItem & { source?: CommandSource })[] = [
    ...getDefaultQuickStartMenuItems().map(choice => ({
      label: choice.icon ? `$(${choice.icon}) ${choice.label}` : choice.label,
      description: choice.description,
      source: { kind: 'default', choice } as CommandSource
    })),
    {
      label: `$(symbol-misc) ${vscode.l10n.t('Any object (library/name/type)...')}`,
      description: vscode.l10n.t('Works for message queues, output queues, data queues, and any other object type'),
      source: { kind: 'anyObject' }
    },
    { label: '', kind: vscode.QuickPickItemKind.Separator },
    { label: `$(list-selection) ${vscode.l10n.t('Browse commands from an installed extension...')}`, source: { kind: 'browse' } },
    { label: `$(edit) ${vscode.l10n.t('Other command (enter id manually)...')}`, source: { kind: 'manual' } }
  ];
  const picked = await vscode.window.showQuickPick(sourcePicks, { placeHolder: vscode.l10n.t('Select the command this menu entry should run') });
  if (!picked?.source) {
    return undefined;
  }

  let command: string;
  let args: string[] | undefined;
  let suggestedLabel = existing?.label ?? '';
  let suggestedDescription = existing?.description ?? '';
  let suggestedIcon = existing?.icon;

  switch (picked.source.kind) {
    case 'default': {
      const choice = picked.source.choice;
      command = choice.command;
      suggestedLabel ||= choice.label;
      suggestedDescription ||= choice.description ?? '';
      suggestedIcon ||= choice.icon;
      break;
    }

    case 'anyObject': {
      command = 'vscode-ibmi-fs.dspobjDetailed';
      suggestedIcon ||= 'search-view-icon';

      const behavior = await vscode.window.showQuickPick(
        [
          { label: vscode.l10n.t('Ask for the library, name and type every time'), fixed: false },
          { label: vscode.l10n.t('Always use a specific library, name and type'), fixed: true }
        ],
        { placeHolder: vscode.l10n.t('How should this menu entry behave?') }
      );
      if (!behavior) {
        return undefined;
      }

      if (behavior.fixed) {
        const library = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('Enter library name'),
          value: existing?.args?.[0],
          placeHolder: vscode.l10n.t('Library'),
          validateInput: value => (!value || value.trim().length === 0) ? vscode.l10n.t('Library name is required')
            : (value.length > 10 ? vscode.l10n.t('Library name must be 10 characters or less') : null)
        });
        if (!library) {
          return undefined;
        }

        const name = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('Enter object name'),
          value: existing?.args?.[1],
          placeHolder: vscode.l10n.t('Object name'),
          validateInput: value => (!value || value.trim().length === 0) ? vscode.l10n.t('Object name is required')
            : (value.length > 10 ? vscode.l10n.t('Object name must be 10 characters or less') : null)
        });
        if (!name) {
          return undefined;
        }

        const type = await vscode.window.showInputBox({
          prompt: vscode.l10n.t('Enter object type (e.g., *PGM, *FILE, *DTAARA, *MSGQ, *OUTQ, *DTAQ)'),
          value: existing?.args?.[2],
          placeHolder: vscode.l10n.t('*PGM'),
          validateInput: value => (!value || value.trim().length === 0) ? vscode.l10n.t('Object type is required')
            : (!value.startsWith('*') ? vscode.l10n.t('Object type must start with *') : null)
        });
        if (!type) {
          return undefined;
        }

        args = [library.trim().toUpperCase(), name.trim().toUpperCase(), type.trim().toUpperCase()];
        suggestedLabel = `DSPOBJ ${args[0]}/${args[1]} (${args[2]})`;
      }
      break;
    }

    case 'browse': {
      const browsed = await promptForExtensionCommand();
      if (!browsed) {
        return undefined;
      }
      command = browsed.command;
      suggestedLabel ||= browsed.title;
      suggestedDescription ||= browsed.category ?? '';
      suggestedIcon ||= browsed.icon;

      const browsedArgs = await promptForCommandArgs(existing?.args);
      if (browsedArgs === null) {
        return undefined;
      }
      args = browsedArgs;
      break;
    }

    case 'manual': {
      const entered = await vscode.window.showInputBox({
        prompt: vscode.l10n.t('Enter the VS Code command id'),
        value: existing?.command,
        placeHolder: 'vscode-ibmi-fs.wrkjob',
        validateInput: value => (!value || value.trim().length === 0) ? vscode.l10n.t('Command id is required') : null
      });
      if (!entered) {
        return undefined;
      }
      command = entered.trim();

      const manualArgs = await promptForCommandArgs(existing?.args);
      if (manualArgs === null) {
        return undefined;
      }
      args = manualArgs;
      break;
    }
  }

  const label = await vscode.window.showInputBox({
    prompt: vscode.l10n.t('Enter the text shown for this menu entry'),
    value: suggestedLabel,
    validateInput: value => (!value || value.trim().length === 0) ? vscode.l10n.t('Label is required') : null
  });
  if (!label) {
    return undefined;
  }

  const description = await vscode.window.showInputBox({
    prompt: vscode.l10n.t('Enter an optional description shown next to the label'),
    value: suggestedDescription
  });
  if (description === undefined) {
    return undefined;
  }

  const customIconMarker = '__custom__';
  const iconPick = await vscode.window.showQuickPick(
    [
      { label: vscode.l10n.t('(No icon)'), icon: undefined as string | undefined },
      ...QUICK_START_ICON_CHOICES.map(icon => ({
        label: `$(${icon}) ${icon}`,
        description: icon === suggestedIcon ? vscode.l10n.t('Current') : undefined,
        icon
      })),
      { label: `$(edit) ${vscode.l10n.t('Custom icon name...')}`, icon: customIconMarker }
    ],
    { placeHolder: vscode.l10n.t('Select an icon for this menu entry') }
  );
  if (!iconPick) {
    return undefined;
  }

  let icon = iconPick.icon;
  if (icon === customIconMarker) {
    const typed = await vscode.window.showInputBox({
      prompt: vscode.l10n.t('Enter a codicon name (see the VS Code Codicon reference), without $()'),
      value: suggestedIcon,
      placeHolder: 'server-process'
    });
    if (typed === undefined) {
      return undefined;
    }
    icon = typed.trim() || undefined;
  }

  return {
    label: label.trim(),
    description: description.trim() || undefined,
    icon,
    command,
    args
  };
}

/**
 * Shows a QuickPick of the current menu entries and returns the index of the
 * one the user selects, or undefined if they cancel.
 */
async function chooseQuickStartMenuItemIndex(items: QuickStartMenuItem[], placeHolder: string): Promise<number | undefined> {
  const picked = await vscode.window.showQuickPick(
    items.map((item, index) => ({
      label: item.icon ? `$(${item.icon}) ${item.label}` : item.label,
      description: item.description,
      index
    })),
    { placeHolder }
  );
  return picked?.index;
}

/** Moves the user-selected menu entry one position up or down. */
async function moveQuickStartMenuItem(direction: -1 | 1) {
  const items = getEditableQuickStartMenuItems();
  if (items.length < 2) {
    vscode.window.showInformationMessage(vscode.l10n.t('Not enough entries to reorder'));
    return;
  }

  const index = await chooseQuickStartMenuItemIndex(items, vscode.l10n.t('Select the entry to move'));
  if (index === undefined) {
    return;
  }

  const target = index + direction;
  if (target < 0 || target >= items.length) {
    vscode.window.showInformationMessage(
      direction < 0 ? vscode.l10n.t('This entry is already at the top') : vscode.l10n.t('This entry is already at the bottom')
    );
    return;
  }

  [items[index], items[target]] = [items[target], items[index]];
  await saveQuickStartMenuItems(items);
}

/**
 * Close transient runtime webview panels that VS Code may restore after reload.
 * These panels are snapshots and can reopen without refreshed data.
 */
async function closeRestoredRuntimePanelsOnActivate(): Promise<void> {
  const transientViewTypes = new Set([
    'wrkobjView',
    'wrkjobView',
    'wrkactjobView',
    'wrksplfView',
    'wrkusrjobView'
  ]);

  const tabsToClose = vscode.window.tabGroups.all
    .flatMap(group => group.tabs)
    .filter(tab => {
      const input = tab.input;

      // Transient quick-action webviews.
      if (input instanceof vscode.TabInputWebview) {
        return transientViewTypes.has(input.viewType);
      }

      // DSPMSG / DSPMSG QSYSOPR are opened via custom editor (vscode.openWith).
      // Close restored queue-style tabs so they don't reopen stale after restart.
      if (input instanceof vscode.TabInputCustom) {
        if (input.viewType !== 'vscode-ibmi-fs.editor') {
          return false;
        }
        // Add additional FS extensions here to have it close old tabs at re-activate
        const upperPath = input.uri.path.toUpperCase();
        return [
          '.MSGQ',
          '.OUTQ',
          '.SBSD',
          '.DTAQ',
          '.JOBQ',
          '.JOBD',
          '.JRN',
          '.BNDDIR',
          '.DTAARA',
          '.PGM',
          '.SRVPGM',
          '.CMD',
          '.USRSPC',
          '.MSGF',
          '.MODULE',
          '.JRNRCV',
          '.CLS',
          '.USRIDX',
          '.FILE', // covers plain files as well as SAVF/DDMF (distinguished by uri fragment, not extension)
        ].some(ext => upperPath.endsWith(ext));
      }

      return false;
    });

  if (tabsToClose.length > 0) {
    await vscode.window.tabGroups.close(tabsToClose);
  }
}


/**
 * Extension activation function
 * This method is called when the extension is activated for the first time
 * @param context - The extension context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Load the base IBM i extension
  loadBase();

  // Drop restored transient panels so users don't see stale, data-less snapshots after reload.
  await closeRestoredRuntimePanelsOnActivate();

  // Register the document manager
  DocumentManager.register(context);

  // Register the custom editor provider for IBM i file system objects
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(`vscode-ibmi-fs.editor`, new ObjectProvider(), {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    })
  );

  SaveFileActions.register(context);
  DataQueueActions.register(context);
  DataAreaActions.register(context);
  JobQueueActions.register(context);
  OutputQueueActions.register(context);
  UserSpaceActions.register(context);
  BindingDirectoryActions.register(context);
  JournalActions.register(context);
  SubsystemActions.register(context);
  MessageQueueActions.register(context);
  MessageFileActions.register(context);
  FileActions.register(context);
  UserIndexActions.register(context);
  JobDescriptionActions.register(context);
  DspobjActions.register(context);
  WrksplfActions.register(context);
  WrkjobActions.register(context);
  WrkactjobActions.register(context);
  WrkusrjobActions.register(context);

  // Register refresh command
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.refreshObject', async () => {
      // Get the active custom editor URI from the tab
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab?.input) {
        const input = activeTab.input as any;
        if (input.uri) {
          await ObjectProvider.refreshDocument(input.uri);
          vscode.window.showInformationMessage(vscode.l10n.t('Object refreshed successfully'));
        }
      }
    })
  );

  // Register object actions menu command
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.showObjectActions', async () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (!activeTab?.input) {
        return;
      }

      const input = activeTab.input as any;
      const uri = input.uri as vscode.Uri;
      if (!uri) {
        return;
      }

      // Determine object type from URI
      const ext = uri.path.split('.').pop()?.toUpperCase();
      const fragment = uri.fragment?.toUpperCase();

      // Build actions list based on object type
      const actions: { label: string; command: string; icon?: string }[] = [];

      switch (ext) {
        case 'DTAQ':
          actions.push(
            { label: vscode.l10n.t('Send data to Data Queue'), command: 'vscode-ibmi-fs.sendToDataQueue', icon: '$(mail)' },
            { label: vscode.l10n.t('Clear Data Queue'), command: 'vscode-ibmi-fs.clearDataQueue', icon: '$(trash)' }
          );
          break;

        case 'FILE':
          if (fragment === 'SAVF') {
            actions.push(
              { label: vscode.l10n.t('Download Save File'), command: 'vscode-ibmi-fs.downloadSavf', icon: '$(cloud-download)' },
              { label: vscode.l10n.t('Upload Save File'), command: 'vscode-ibmi-fs.uploadSavf', icon: '$(cloud-upload)' },
              { label: vscode.l10n.t('Save to Save File'), command: 'vscode-ibmi-fs.savf', icon: '$(save)' },
              { label: vscode.l10n.t('Restore from Save File'), command: 'vscode-ibmi-fs.restore', icon: '$(issue-reopened)' },
              { label: vscode.l10n.t('Clear Save File'), command: 'vscode-ibmi-fs.clearSavf', icon: '$(trash)' }
            );
          } else if (fragment === 'PF' || fragment === 'LF') {
            actions.push(
              { label: vscode.l10n.t('Query file'), command: 'vscode-ibmi-fs.QueryFile', icon: '$(file-code)' }
            );
          }
          break;

        case 'JOBQ':
          actions.push(
            { label: vscode.l10n.t('Hold Job Queue'), command: 'vscode-ibmi-fs.HldJobq', icon: '$(primitive-square)' },
            { label: vscode.l10n.t('Release Job Queue'), command: 'vscode-ibmi-fs.RlsJobq', icon: '$(play)' },
            { label: vscode.l10n.t('Clear Job Queue'), command: 'vscode-ibmi-fs.ClrJobq', icon: '$(trash)' }
          );
          break;

        case 'OUTQ':
          actions.push(
            { label: vscode.l10n.t('Hold Output Queue'), command: 'vscode-ibmi-fs.HldOutq', icon: '$(primitive-square)' },
            { label: vscode.l10n.t('Release Output Queue'), command: 'vscode-ibmi-fs.RlsOutq', icon: '$(play)' },
            { label: vscode.l10n.t('Clear Output Queue'), command: 'vscode-ibmi-fs.ClrOutq', icon: '$(trash)' },
            { label: vscode.l10n.t('Delete old spools'), command: 'vscode-ibmi-fs.DelOldSpool', icon: '$(calendar)' },
            { label: vscode.l10n.t('Manage Writer'), command: 'vscode-ibmi-fs.MngWtr', icon: '$(debug-disconnect)' }
          );
          break;

        case 'DTAARA':
          actions.push(
            { label: vscode.l10n.t('Change DTAARA'), command: 'vscode-ibmi-fs.ChgDtaara', icon: '$(edit)' }
          );
          break;

        case 'USRSPC':
          actions.push(
            { label: vscode.l10n.t('Change USRSPC'), command: 'vscode-ibmi-fs.chgUsrspc', icon: '$(edit)' }
          );
          break;

        case 'BNDDIR':
          actions.push(
            { label: vscode.l10n.t('Add Binding Directory Entry'), command: 'vscode-ibmi-fs.Addbnddire', icon: '$(plus)' }
          );
          break;

        case 'JRN':
          actions.push(
            { label: vscode.l10n.t('Generate new Journal Receiver'), command: 'vscode-ibmi-fs.GenJrnRcv', icon: '$(git-pull-request-new-changes)' },
            { label: vscode.l10n.t('Display Journal'), command: 'vscode-ibmi-fs.DspJrn', icon: '$(file-code)' }
          );
          break;

        case 'SBSD':
          actions.push(
            { label: vscode.l10n.t('Start Subsystem'), command: 'vscode-ibmi-fs.StrSbs', icon: '$(play)' },
            { label: vscode.l10n.t('End Subsystem'), command: 'vscode-ibmi-fs.EndSbs', icon: '$(primitive-square)' }
          );
          break;

        case 'MSGQ':
          actions.push(
            { label: vscode.l10n.t('Send Message to Message Queue'), command: 'vscode-ibmi-fs.sendToMessageQueue', icon: '$(mail)' },
            { label: vscode.l10n.t('Clear Message Queue'), command: 'vscode-ibmi-fs.clearMessageQueue', icon: '$(trash)' }
          );
          break;

        case 'MSGF':
          actions.push(
            { label: vscode.l10n.t('Add Message Description'), command: 'vscode-ibmi-fs.addMsgd', icon: '$(plus)' },
          );
          break;

        case 'USRIDX':
          actions.push(
            { label: vscode.l10n.t('Add User Index Entry'), command: 'vscode-ibmi-fs.AddUsridxEntry', icon: '$(plus)' },
            { label: vscode.l10n.t('Remove User Index Entry'), command: 'vscode-ibmi-fs.RmvUsridxEntry', icon: '$(trash)' }
          );
          break;

        case 'JOBD':
          actions.push(
            { label: vscode.l10n.t('Change Job Description'), command: 'vscode-ibmi-fs.changeJobd', icon: '$(edit)' }
          );
          break;
      }

      if (actions.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('No actions available for this object type'));
        return;
      }

      // Show quick pick menu
      const selected = await vscode.window.showQuickPick(
        actions.map(a => ({
          label: a.icon ? `${a.icon} ${a.label}` : a.label,
          command: a.command
        })),
        {
          placeHolder: vscode.l10n.t('Select an action')
        }
      );

      if (selected) {
        // Execute the command with the URI as parameter
        await vscode.commands.executeCommand(selected.command, uri);
      }
    })
  );

  // === FS Quick Start Status Bar ===
  const fsActionsStatusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  fsActionsStatusBar.text = "$(tools) FS Quick Start";
  fsActionsStatusBar.tooltip = "IBM i FS Quick Start";
  fsActionsStatusBar.command = "vscode-ibmi-fs.showFsActionsMenu";
  context.subscriptions.push(fsActionsStatusBar);

  // Function to update status bar visibility based on connection state
  const updateFsActionsStatusBar = () => {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Match the status bar colour picked in the connection settings, just like the core does
      const config = connection.getConfig();
      fsActionsStatusBar.color = getVSCodeTools()?.parseStatusBarColor(config?.statusBarColor);
      fsActionsStatusBar.show();
    } else {
      fsActionsStatusBar.hide();
    }
  };

  // Update initial visibility
  updateFsActionsStatusBar();

  // Periodically check connection state
  const connectionCheckInterval = setInterval(() => {
    updateFsActionsStatusBar();
  }, 2000); // Check every 2 seconds

  // Clean up interval when extension is deactivated
  context.subscriptions.push({
    dispose: () => clearInterval(connectionCheckInterval)
  });

  // Re-apply the status bar colour immediately when the connection settings change, just like the core does
  const base = loadBase();
  if (base) {
    context.subscriptions.push(
      base.onCodeForIBMiConfigurationChange("connectionSettings", () => updateFsActionsStatusBar())
    );
  }

  // Listen for extension changes (when Code for IBM i connects/disconnects)
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => {
      updateFsActionsStatusBar();
    })
  );

  // Command to show the FS Quick Start menu
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.showFsActionsMenu', async () => {
      const menuItems = getQuickStartMenuItems();

      const picks: (vscode.QuickPickItem & { command?: string; args?: string[] })[] = menuItems.map(item => ({
        label: item.icon ? `$(${item.icon}) ${item.label}` : item.label,
        description: item.description,
        command: item.command,
        args: item.args
      }));

      picks.push(
        { label: '', kind: vscode.QuickPickItemKind.Separator },
        { label: `$(gear) ${vscode.l10n.t('Customize FS Quick Start Menu...')}`, command: 'vscode-ibmi-fs.configureFsQuickStartMenu' }
      );

      const action = await vscode.window.showQuickPick(picks, { placeHolder: vscode.l10n.t('Select an FS action') });

      if (action?.command) {
        vscode.commands.executeCommand(action.command, ...(action.args ?? []));
      }
    })
  );

  // Command that opens the FS Quick Start menu management wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.configureFsQuickStartMenu', async () => {
      const action = await vscode.window.showQuickPick(
        [
          { label: `$(add) ${vscode.l10n.t('Add a menu entry...')}`, command: 'vscode-ibmi-fs.addQuickStartMenuItem' },
          { label: `$(edit) ${vscode.l10n.t('Edit a menu entry...')}`, command: 'vscode-ibmi-fs.editQuickStartMenuItem' },
          { label: `$(trash) ${vscode.l10n.t('Remove menu entries...')}`, command: 'vscode-ibmi-fs.removeQuickStartMenuItem' },
          { label: `$(arrow-up) ${vscode.l10n.t('Move a menu entry up...')}`, command: 'vscode-ibmi-fs.moveQuickStartMenuItemUp' },
          { label: `$(arrow-down) ${vscode.l10n.t('Move a menu entry down...')}`, command: 'vscode-ibmi-fs.moveQuickStartMenuItemDown' },
          { label: `$(discard) ${vscode.l10n.t('Reset to default menu')}`, command: 'vscode-ibmi-fs.resetQuickStartMenu' },
          { label: '', kind: vscode.QuickPickItemKind.Separator },
          { label: `$(settings-gear) ${vscode.l10n.t('Edit settings.json directly...')}`, command: 'vscode-ibmi-fs.openQuickStartMenuSettings' }
        ],
        { placeHolder: vscode.l10n.t('How do you want to customize the FS Quick Start menu?') }
      );

      if (action?.command) {
        vscode.commands.executeCommand(action.command);
      }
    })
  );

  // Command to open the Settings UI on the FS Quick Start menu setting
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.openQuickStartMenuSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'vscode-ibmi-fs.quickStartMenu');
    })
  );

  // Command to add a new FS Quick Start menu entry via a guided wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.addQuickStartMenuItem', async () => {
      const newItem = await promptForQuickStartMenuItem();
      if (!newItem) {
        return;
      }

      const items = getEditableQuickStartMenuItems();
      items.push(newItem);
      await saveQuickStartMenuItems(items);
      vscode.window.showInformationMessage(vscode.l10n.t('Added "{0}" to the FS Quick Start menu', newItem.label));
    })
  );

  // Command to edit an existing FS Quick Start menu entry via a guided wizard
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.editQuickStartMenuItem', async () => {
      const items = getEditableQuickStartMenuItems();
      if (items.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('The FS Quick Start menu has no entries yet'));
        return;
      }

      const index = await chooseQuickStartMenuItemIndex(items, vscode.l10n.t('Select the entry to edit'));
      if (index === undefined) {
        return;
      }

      const updated = await promptForQuickStartMenuItem(items[index]);
      if (!updated) {
        return;
      }

      items[index] = updated;
      await saveQuickStartMenuItems(items);
      vscode.window.showInformationMessage(vscode.l10n.t('Updated "{0}"', updated.label));
    })
  );

  // Command to remove one or more FS Quick Start menu entries
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.removeQuickStartMenuItem', async () => {
      const items = getEditableQuickStartMenuItems();
      if (items.length === 0) {
        vscode.window.showInformationMessage(vscode.l10n.t('The FS Quick Start menu has no entries yet'));
        return;
      }

      const picked = await vscode.window.showQuickPick(
        items.map((item, index) => ({
          label: item.icon ? `$(${item.icon}) ${item.label}` : item.label,
          description: item.description,
          index
        })),
        { placeHolder: vscode.l10n.t('Select the entries to remove'), canPickMany: true }
      );
      if (!picked || picked.length === 0) {
        return;
      }

      const toRemove = new Set(picked.map(p => p.index));
      const remaining = items.filter((_, index) => !toRemove.has(index));
      await saveQuickStartMenuItems(remaining);
      vscode.window.showInformationMessage(vscode.l10n.t('Removed {0} item(s) from the FS Quick Start menu', picked.length));
    })
  );

  // Commands to reorder FS Quick Start menu entries
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.moveQuickStartMenuItemUp', () => moveQuickStartMenuItem(-1)),
    vscode.commands.registerCommand('vscode-ibmi-fs.moveQuickStartMenuItemDown', () => moveQuickStartMenuItem(1))
  );

  // Command to reset the FS Quick Start menu to its built-in defaults
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.resetQuickStartMenu', async () => {
      const confirmLabel = vscode.l10n.t('Reset');
      const confirm = await vscode.window.showWarningMessage(
        vscode.l10n.t('Reset the FS Quick Start menu to its default entries? Your customizations will be lost.'),
        { modal: true },
        confirmLabel
      );
      if (confirm !== confirmLabel) {
        return;
      }

      await saveQuickStartMenuItems([]);
      vscode.window.showInformationMessage(vscode.l10n.t('FS Quick Start menu reset to defaults'));
    })
  );

  // DSPMSG QSYSOPR Command - Opens the QSYSOPR message queue
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.dspmsgQsysopr', async () => {
      try {
        // Create the URI for the QSYSOPR message queue in QSYS library
        const uri = vscode.Uri.parse('member:/QSYS/QSYSOPR.MSGQ');

        // Open in preview mode so the tab is less likely to persist across restarts.
        await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor', { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to open QSYSOPR: {0}', String(error)));
      }
    })
  );

  // DSPMSG Command - Opens the user's message queue
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.dspUsrMsg', async () => {
      try {

        const ibmi = getInstance();
        const connection = ibmi?.getConnection();
        if (!connection) {
          throw new Error(vscode.l10n.t("Not connected to IBM i"));
        }

        // Create the URI for the user's message queue in QSYS library
        const uri = vscode.Uri.parse(`member:/QUSRSYS/${connection.currentUser.toUpperCase()}.MSGQ`);

        // Open in preview mode so the tab is less likely to persist across restarts.
        await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor', { preview: true });
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t(`Failed to open user's message queue: {0}`, String(error)));
      }
    })
  );

  // DSPOBJ Detailed Command - Display any object (message queue, output queue, data queue, etc.)
  // given its library, name and type. Accepts them as arguments (e.g. from a customized FS Quick
  // Start menu entry) and only prompts for whichever of them wasn't provided.
  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-ibmi-fs.dspobjDetailed', async (library?: string, name?: string, type?: string) => {
      let lib = library?.trim();
      let objName = name?.trim();
      let objType = type?.trim();

      if (!lib) {
        lib = await vscode.window.showInputBox({
          prompt: vscode.l10n.t("Enter library name"),
          placeHolder: vscode.l10n.t("Library"),
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return vscode.l10n.t("Library name is required");
            }
            if (value.length > 10) {
              return vscode.l10n.t("Library name must be 10 characters or less");
            }
            return null;
          }
        });
        if (!lib) {
          return;
        }
      }

      if (!objName) {
        objName = await vscode.window.showInputBox({
          prompt: vscode.l10n.t("Enter object name"),
          placeHolder: vscode.l10n.t("Object name"),
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return vscode.l10n.t("Object name is required");
            }
            if (value.length > 10) {
              return vscode.l10n.t("Object name must be 10 characters or less");
            }
            return null;
          }
        });
        if (!objName) {
          return;
        }
      }

      if (!objType) {
        objType = await vscode.window.showInputBox({
          prompt: vscode.l10n.t("Enter object type (e.g., *PGM, *FILE, *DTAARA)"),
          placeHolder: vscode.l10n.t("*PGM"),
          value: "*PGM",
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return vscode.l10n.t("Object type is required");
            }
            if (!value.startsWith('*')) {
              return vscode.l10n.t("Object type must start with *");
            }
            return null;
          }
        });
        if (!objType) {
          return;
        }
      }

      try {
        // Remove leading asterisk (if any) from the type for the URI extension
        const typeExt = (objType.startsWith('*') ? objType.substring(1) : objType).toUpperCase();
        const uri = vscode.Uri.parse(`member:/${lib.toUpperCase()}/${objName.toUpperCase()}.${typeExt}`);
        await vscode.commands.executeCommand('vscode.openWith', uri, 'vscode-ibmi-fs.editor');
      } catch (error) {
        vscode.window.showErrorMessage(vscode.l10n.t('Failed to display object information: {0}', String(error)));
      }
    })
  );

  console.log(vscode.l10n.t('Congratulations, your extension "vscode-ibmi-fs" is now active!'));
}

/**
 * Extension deactivation function
 * This method is called when the extension is deactivated
 */
export function deactivate() { }
