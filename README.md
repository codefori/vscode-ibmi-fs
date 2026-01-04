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

### 💬 Message Files (MSGF)
Message files contain predefined messages used by IBM i applications.

**Features:**
- 📊 Display all messages in the message file
- 📋 View message details (ID, text, severity, reply type)
- 📄 First and second level message text
- ⚙️ Reply type and valid reply values
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
- 📋 View storage pools configuration
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

## Installation

This extension requires the [Code for IBM i](https://marketplace.visualstudio.com/items?itemName=HalcyonTechLtd.code-for-ibmi) extension to be installed and connected to an IBM i system.

## Usage

1. Connect to your IBM i system using Code for IBM i
2. Navigate to the Object Browser
3. Right-click on supported objects to see available actions
4. Double-click on objects to open them in the custom editor

## Requirements

- Visual Studio Code 1.90.0 or higher
- Code for IBM i extension
- Active connection to an IBM i system

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details
