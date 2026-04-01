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
| 📄 Message Files | `*MSGF` | ❌ |
| 💬 Message Queues | `*MSGQ` | ✅ |
| 🔗 Binding Directories | `*BNDDIR` | ✅ |
| 🔧 Programs | `*PGM` | ❌ |
| 🔧 Service Programs | `*SRVPGM` | ❌ |
| 🧩 Modules | `*MODULE` | ❌ |
| ⚙️ Commands | `*CMD` | ❌ |
| 📄 Job Descriptions | `*JOBD` | ❌ |
| 📓 Journal Receivers | `*JRNRCV` | ❌ |
| 📓 Journals | `*JRN` | ✅ |
| 🌐 DDM Files | `*DDMF` | ❌ |
| 🖥️ Subsystem Descriptions | `*SBSD` | ✅ |
| 🎯 Classes | `*CLS` | ❌ |
| 📁 Files | `*FILE` | ✅ |
| 🔍 Query Definitions | `*QRYDFN` | ✅ |

**Legend:**
- ✅ **Actions Available** - Interactive operations (create, modify, delete, etc.)
- ❌ **View Only** - Read-only information display

> 📖 **For detailed information** about each object type, including all available features and actions, see [**SUPPORTED_OBJECTS.md**](SUPPORTED_OBJECTS.md)

---

### Generic Actions

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
- ⌨️ **Keyboard shortcut**: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)

---

### Installation

This extension requires the [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi) extension to be installed and connected to an IBM i system.

### Usage

1. Connect to your IBM i system using Code for IBM i
2. Navigate to the Object Browser
3. Actions available inside the **Action Bar** (top right)

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
- 📝 **1200+ translated strings** including:
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
