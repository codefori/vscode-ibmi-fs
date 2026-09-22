# vscode-ibmi-fs

<img src="./icon.png" align="right" width="256">

This extension provides additional functionality not found in the base Code for IBM i extension for viewing and managing objects inside of the IBM i QSYS file system.

### Supported Object Types

The extension supports **22 different IBM i object types** with comprehensive viewing capabilities and interactive actions. Below is a summary table of all supported object types:

| Object Type | Type Code | Actions |
|-------------|-----------|---------|
| 📦 Save Files | `*SAVF` | ✅ |
| 📨 Data Queues | `*DTAQ` | ✅ |
| 📝 Data Areas | `*DTAARA` | ✅ |
| 🖨️ Output Queues | `*OUTQ` | ✅ |
| 📋 Job Queues | `*JOBQ` | ✅ |
| 💾 User Spaces | `*USRSPC` | ✅ |
| 🔑 User Indexes | `*USRIDX` | ✅ |
| 📄 Message Files | `*MSGF` | ✅ |
| 💬 Message Queues | `*MSGQ` | ✅ |
| 🔗 Binding Directories | `*BNDDIR` | ✅ |
| 🔧 Programs | `*PGM` | ❌ |
| 🔧 Service Programs | `*SRVPGM` | ❌ |
| 🧩 Modules | `*MODULE` | ❌ |
| ⚙️ Commands | `*CMD` | ❌ |
| 📄 Job Descriptions | `*JOBD` | ✅ |
| 📓 Journal Receivers | `*JRNRCV` | ❌ |
| 📓 Journals | `*JRN` | ✅ |
| 🌐 DDM Files | `*DDMF` | ❌ |
| 🖥️ Subsystem Descriptions | `*SBSD` | ✅ |
| 🎯 Classes | `*CLS` | ❌ |
| 📁 Files | `*FILE` | ✅ |
| 🔍 Query Definitions | `*QRYDFN` | ❌ |

**Legend:**
- ✅ **Actions Available** - Interactive operations (create, modify, delete, etc.)
- ❌ **View Only** - Read-only information display

> 📖 **For detailed information** about each object type, including all available features and actions, see [**SUPPORTED_OBJECTS.md**](SUPPORTED_OBJECTS.md)

---

### Generic Actions

Every object opened in the Object Editor gets these toolbar actions, whatever its type:

| Action | Description |
|--------|-------------|
| 🔄 **Refresh Object** | Reload the object's data from the system |
| ⚡ **Object Actions** | Quick pick listing every action available for the current object |
| 🔧 **Additional Information** | Display Object Information (see below) |

#### 🔧 Display Object Information

A generic action available for **all object types** that provides comprehensive information similar to the WRKOBJ/DSPOBJD command.

**Features:**
- 📊 Display detailed object information (owner, definer, creation date, size, text description)
- 🔒 View object locks with lock state, status, scope, and job information
- 👥 View object authorizations for all users and groups
- 📅 View usage statistics (last used timestamp, days used count)
- 💾 View save and restore timestamps
- 🔑 View authorization list information
- 🎨 Multi-tab interface with Information, Locks, and Authorizations tabs
- 📱 Available from Object Browser context menu and editor toolbar

---

### FS Quick Start Menu

Click on **"FS Quick Start"** in the status bar (bottom left) to access these commands:

| Command | Description |
|---------|-------------|
| 📥 **DSPMSG** | Display User's message queue |
| 💬 **DSPMSG QSYSOPR** | Display System Operator Messages |
| 📋 **DSPOBJ** | Display Object Information (from context menu) |
| 🔍 **DSPOBJ Detailed** | Display Object Information (prompts for library, name and type) |
| 📄 **WRKSPLF** | Work with Spooled Files |
| 💼 **WRKJOB** | Work with Job |
| 🔄 **WRKACTJOB** | Work with Active Jobs |
| 👥 **WRKUSRJOB** | Work with User Jobs |
| 🏢 **WRKSBS** | Work with Subsystems |

#### Customizing the menu

The menu is fully customizable through the `vscode-ibmi-fs.quickStartMenu` setting. Click the ⚙️ **"Customize FS Quick Start Menu..."** entry at the bottom of the menu (or run `FS Quick Start: Configure FS Quick Start Menu` from the Command Palette) to open a guided wizard that lets you:

- ➕ **Add** an entry pointing to any built-in or contributed VS Code command (with optional arguments)
- ✏️ **Edit** an existing entry's label, description, icon or command
- 🗑️ **Remove** one or more entries
- ⬆️⬇️ **Move** entries up or down to reorder the menu
- ♻️ **Reset** the menu back to the built-in defaults
- ⚙️ **Open Settings** to edit the list as JSON

Each entry needs a `label` and a `command`, and may also define a `description`, an `icon` (a codicon name, e.g. `server-process`) and `args`. When the setting is empty the built-in menu shown above is used; when it is set, it completely replaces the defaults.

> 📖 **For detailed information** about all views and their features, see [**VIEWS.md**](VIEWS.md)

---

### Installation

This extension requires the [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi) extension to be installed and connected to an IBM i system.

### Usage

1. Connect to your IBM i system using Code for IBM i
2. Navigate to the Object Browser and open an object
3. Object-level actions are available in the editor **Action Bar** (top right), or through the **Object Actions** quick pick
4. Row-level actions (hold/release/end a job, reply to a message, open a spooled file, ...) are buttons inside the tables of the object view itself

### Requirements

- Code for IBM i extension
- Active connection to an IBM i system

### Localization (L10N)

This extension supports multiple languages through VSCode's built-in localization framework.

#### Supported Languages

- 🇬🇧 **English** (default)
- 🇮🇹 **Italian**
- 🇫🇷 **French**
- 🇩🇪 **German**
- 🇪🇸 **Spanish**
- 🇯🇵 **Japanese**
- 🇰🇷 **Korean**
- 🇧🇷 🇵🇹 **Brazilian Portuguese**
- 🇨🇳 **Simplified and traditional Chinese**

#### Features

- 🌍 **Automatic language detection** - The extension automatically uses your VSCode display language
- 📝 **1600+ translated strings** including:
  - User interface messages and labels
  - Tab and panel titles
  - Table column headers
  - IBM i database column names
- 🔄 **Dynamic translation** - All UI elements are translated in real-time

#### Adding New Languages

To contribute translations for a new language:

1. Create a new file `l10n/bundle.l10n.<locale>.json` (e.g., `bundle.l10n.fr.json` for French)
2. Copy the structure from `l10n/bundle.l10n.en.json`
3. Translate all values while keeping the keys unchanged
4. Submit a pull request

Translation files use the standard VSCode L10N format where English text serves as the key.

### Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

### License

MIT License - see LICENSE file for details
