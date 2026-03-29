# vscode-ibmi-fs

This extension provides additional functionality not found in the base Code for IBM i extension for viewing and managing objects inside of the IBM i QSYS file system.

## Supported Object Types

### 📦 Save Files (SAVF)
Save files are special file objects used to store saved objects and libraries.

**Features:**
- 📊 Display save file contents (objects, members, spooled files, IFS directories)
- ⬇️ Download save file to local system
- ⬆️ Upload save file(s) from local system
- 🗑️ Clear save file contents
- 💾 Save objects/libraries to save file
- 📂 Restore objects/libraries from save file

---

### 📨 Data Queues (DTAQ)
Data queues are objects used for inter-process communication, allowing programs to send and receive messages asynchronously.

**Features:**
- 📊 Display data queue information and attributes
- 📋 View messages in the queue
- ➡️ Send new messages to the queue
- 🗑️ Clear all messages from the queue
- 🔑 Support for keyed and non-keyed data queues

---

### 📝 Data Areas (DTAARA)
Data areas are objects that store data that can be accessed by multiple programs.

**Features:**
- 📊 Display data area information and current value
- 📋 View data area attributes (type, length, decimal positions)
- ✏️ Change data area content
- 🔢 Support for different data area types (*CHAR, *DEC, *LGL)

---

### 🖨️ Output Queues (OUTQ)
Output queues manage spooled files and printer output.

**Features:**
- 📊 Display output queue information and statistics
- 📋 List all spooled files in a queue with details
- ⏸️ Hold/Release output queues
- 🗑️ Clear output queue
- ▶️ Start/Stop printer writers
- 📄 Generate PDF from spooled files
- 🗑️ Delete individual or old spooled files
- 🎨 Dynamic UI based on queue and writer status

---

### 📋 Job Queues (JOBQ)
Job queues manage batch jobs waiting to be processed.

**Features:**
- 📊 Display job queue information and statistics
- 📋 List all jobs in a queue with their details
- ⏸️ Hold/Release/Clear job queues
- ⏸️ Hold/Release/End individual jobs
- 🎨 Dynamic UI based on queue and job status

---

### 💾 User Spaces (USRSPC)
User spaces provide temporary or permanent storage for data that can be accessed by multiple programs.

**Features:**
- 📊 Display user space information and attributes
- 📋 View user space content (hexadecimal and text representation)
- ✏️ Change user space data at specific positions
- 📏 Support for different user space sizes
- 🔄 Automatic space extension capabilities

---

### 🔑 User Indexes (USRIDX)
User indexes provide fast keyed access to data stored in user-defined entries, similar to a hash table or dictionary.

**Features:**
- 📊 Display user index information and attributes
- 📋 View all entries with their keys and values
- ➕ Add new entries to the user index
- 🗑️ Remove entries from the user index
- 🔑 Support for variable-length entries
- 📏 View entry statistics and index configuration

---

###  Message Files (MSGF)
Message files contain predefined messages used by IBM i applications.

**Features:**
- 📊 Display all messages in the message file
- 📋 View message details (ID, text, severity, reply type)
- 📄 First and second level message text
- ⚙️ Reply type and valid reply values
- 🚀 Fast table component for performance with many messages

---

### 💬 Message Queues (MSGQ)
Message queues store messages sent by programs, system functions, or users, providing communication between jobs.

**Features:**
- 📊 Display message queue contents with detailed information
- 📋 View message text (first and second level)
- 📅 Show message metadata (severity, timestamp, sender job/user)
- 🗑️ Clear all messages from the queue
- 📨 Send message the queue
- 🚀 Fast table component for performance with many messages

---

### 🔗 Binding Directories (BNDDIR)
Binding directories contain lists of service programs and modules used during program binding.

**Features:**
- 📊 Display binding directory entries
- 📋 View bound objects (library, type, activation)
- 📅 Creation date and time information
- ➕ Add new entries to binding directory
- 🗑️ Delete entries from binding directory
- 🔍 View exported symbols from service programs

---

### 🔧 Programs and Service Programs (PGM/SRVPGM)
Programs and service programs are executable objects.

**Features:**
- 📊 Display comprehensive program information
- 📋 View program attributes and properties
- 🔗 List bound modules
- 📦 List bound service programs
- 🔍 View exported symbols (for service programs)
- 🐛 Debug data availability information
- 📅 Creation and compilation information

---

### 🧩 Modules (MODULE)
Modules are compiled ILE objects that contain executable code and can be bound into programs or service programs.

**Features:**
- 📊 Display comprehensive module information
- 📋 View module attributes (creation date, source file, compiler options)
- 📏 Detailed size information (code size, data size, debug data)
- 🔧 List all procedures defined in the module
- 🔗 View imported and exported symbols
- 📦 Display referenced system objects
- ©️ Show copyright information
- 🎨 Multi-tab interface for organized information display

---

### ⚙️ Commands (CMD)
Command objects define IBM i CL commands.

**Features:**
- 📊 Display command definition
- 📋 View all command parameters
- 🔑 Parameter keywords and values
- 📝 Parameter descriptions
- 🔢 CCSID information

---

### 📄 Job Descriptions (JOBD)
Job descriptions define the runtime environment for batch jobs.

**Features:**
- 📊 Display job description attributes
- 📋 View job queue, output queue, and message queue
- 👤 User profile and initial library list
- ⚙️ Job attributes and system values
- 🔧 Routing data and request data

---

### 📓 Journal Receivers (JRNRCV)
Journal receivers store journal entries for auditing, recovery, and replication purposes.

**Features:**
- 📊 Display journal receiver information and attributes
- 📋 View receiver status and statistics
- 🔢 View sequence number ranges (first/last)
- 📅 View attachment and detachment timestamps
- 🔗 View linked receivers (previous/next in chain)
- 🌐 View remote journal configuration
- 🔍 View filter settings (objects, images, programs)
- 💾 View size and threshold information

---

### 📓 Journals (JRN)
Journals record changes to database files, data areas, and other objects for auditing, recovery, and replication.

**Features:**
- 📊 Display journal information and configuration
- 📋 View journal receiver chain with details
- 🔗 View attached receiver and receiver statistics
- 🔢 View sequence number ranges for each receiver
- 📅 View attachment, detachment, and save timestamps
- 🌐 View remote journal configuration
- 🔍 Display journal entries using SQL queries
- ➕ Generate new journal receivers
- 💾 View size and threshold information
- ⚙️ View journal settings (cache, filtering, fixed-length data options)

---

### 🌐 DDM Files (DDMF)
DDM (Distributed Data Management) files provide access to files on remote systems.

**Features:**
- 📊 Display DDM file configuration and attributes
- 🌐 View remote location information (system name/address, port)
- 🔗 View remote file name and library
- ⚙️ View access method and file attributes
- 🔒 View security and connection settings
- 📋 Support for multi-line field values

---

### 🖥️ Subsystem Descriptions (SBSD)
Subsystem descriptions define independent operating environments within IBM i that control how work enters the system and how resources are allocated.

**Features:**
- 📊 Display subsystem information and status (active/inactive)
- 📋 View memory pools configuration
- 🚀 View autostart job entries (AJEs)
- 💻 View workstation entries (WSEs)
- 📋 View job queue entries (JOBQEs)
- 🔀 View routing entries (RTGEs)
- ⚡ View prestart job entries (PJEs)
- 👥 View active jobs in the subsystem (when active)
- ▶️ Start subsystem
- ⏹️ End subsystem with multiple options (*IMMED, *CNTRLD)
- 🛑 End individual jobs within the subsystem
- 🎨 Dynamic UI based on subsystem status

---

### 🎯 Classes (CLS)
Classes define the runtime attributes for batch jobs, controlling how jobs execute and consume system resources.

**Features:**
- 📊 Display class information and attributes
- 🎚️ View run priority (1-99, lower number = higher priority)
- ⏱️ View time slice in milliseconds
- 💾 View maximum temporary storage allowed
- ⚡ View maximum CPU time limit
- 👥 View maximum active threads
- ⏳ View default wait time for locks
- 🗑️ View purge eligibility status
- 📅 View usage statistics (last used date, days used count)
- 🔧 Automatic creation of required SQL objects using QWCRCLSI API
- 📖 Read-only view (use CHGCLS command to modify)

---

### 📁 Files (FILE)
File objects include physical files (PF), logical files (LF), views, and indexes that store and organize data.

**Features:**
- 📊 Display comprehensive file/table/view/index information
- 📋 View file attributes (creation date, owner, journaling status, CCSID)
- 📈 View detailed statistics (row counts, operations, I/O metrics)
- 👥 Display file members with their statistics
- 🧭 Display columns and data types
- 🔗 Show dependent objects (indexes, views, constraints)
- 🔍 Query file contents using SQL SELECT
- 📄 View view definitions and capabilities
- 🎯 Support for both DDS and SQL-based files
- 🎨 Multi-tab interface for organized information display

---

### 🔍 Query Definitions (*QRYDFN)
Query definitions are objects created by Query/400 or Query Manager that define database queries.

**Features:**
- 📊 Translate *QRYDFN objects to SQL statements in text editor
- 🔗 Automatic file reference conversion (LIB/FILE → LIB.FILE)
- 📖 Read-only view (use Query/400 or Query Manager to modify)

---

### 🔧 Display Object Information
A generic action that provides comprehensive information about any IBM i object, similar to the WRKOBJ/DSPOBJD command.

**Features:**
- 📊 Display detailed object information (owner, definer, creation date, size, text description)
- 🔒 View object locks with lock state, status, scope, and job information
- 👥 View object authorizations for all users and groups
- 📅 View usage statistics (last used timestamp, days used count)
- 💾 View save and restore timestamps
- 🔑 View authorization list information
- 🎨 Multi-tab interface with Information, Locks, and Authorizations tabs
- 🚀 Works with any IBM i object type (*PGM, *FILE, *DTAARA, etc.)
- 📱 Available from Object Browser context menu and editor toolbar
- ⌨️ **Keyboard shortcut**: `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac)
  - Prompts for library name, object name, and object type
  - Quick access to object information without navigating the Object Browser

---

## Installation

This extension requires the [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi) extension to be installed and connected to an IBM i system.

## Usage

1. Connect to your IBM i system using Code for IBM i
2. Navigate to the Object Browser
3. Actions available inside the **Action Bar** (top right)

## Requirements

- Code for IBM i extension
- Active connection to an IBM i system

## Localization (L10N)

This extension supports multiple languages through VSCode's built-in localization framework.

### Supported Languages

- 🇬🇧 **English** (default)
- 🇮🇹 **Italian**
- 🇫🇷 **French**
- 🇩🇪 **German**
- 🇪🇸 **Spanish**
- 🇯🇵 **Japanese**
- 🇰🇷 **Korean**
- 🇧🇷 🇵🇹 **Brazilian Portuguese**
- 🇨🇳 **Simplified and traditional Chinese**

### Features

- 🌍 **Automatic language detection** - The extension automatically uses your VSCode display language
- 📝 **1200+ translated strings** including:
  - User interface messages and labels
  - Tab and panel titles
  - Table column headers
  - IBM i database column names
- 🔄 **Dynamic translation** - All UI elements are translated in real-time

### Adding New Languages

To contribute translations for a new language:

1. Create a new file `l10n/bundle.l10n.<locale>.json` (e.g., `bundle.l10n.fr.json` for French)
2. Copy the structure from `l10n/bundle.l10n.en.json`
3. Translate all values while keeping the keys unchanged
4. Submit a pull request

Translation files use the standard VSCode L10N format where English text serves as the key.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details
