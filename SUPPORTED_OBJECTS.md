# Supported Object Types - Detailed Information

This document provides detailed information about all IBM i object types supported by the vscode-ibmi-fs extension, including their features and available actions.

## Object Types Summary

| Object Type | Type Code | Actions Available | View Only |
|-------------|-----------|-------------------|-----------|
| Save Files | `*SAVF` | ✅ Yes | ❌ No |
| Data Queues | `*DTAQ` | ✅ Yes | ❌ No |
| Data Areas | `*DTAARA` | ✅ Yes | ❌ No |
| Output Queues | `*OUTQ` | ✅ Yes | ❌ No |
| Job Queues | `*JOBQ` | ✅ Yes | ❌ No |
| User Spaces | `*USRSPC` | ✅ Yes | ❌ No |
| User Indexes | `*USRIDX` | ✅ Yes | ❌ No |
| Message Files | `*MSGF` | ❌ No | ✅ Yes |
| Message Queues | `*MSGQ` | ✅ Yes | ❌ No |
| Binding Directories | `*BNDDIR` | ✅ Yes | ❌ No |
| Programs | `*PGM` | ❌ No | ✅ Yes |
| Service Programs | `*SRVPGM` | ❌ No | ✅ Yes |
| Modules | `*MODULE` | ❌ No | ✅ Yes |
| Commands | `*CMD` | ❌ No | ✅ Yes |
| Job Descriptions | `*JOBD` | ❌ No | ✅ Yes |
| Journal Receivers | `*JRNRCV` | ❌ No | ✅ Yes |
| Journals | `*JRN` | ✅ Yes | ❌ No |
| DDM Files | `*DDMF` | ❌ No | ✅ Yes |
| Subsystem Descriptions | `*SBSD` | ✅ Yes | ❌ No |
| Classes | `*CLS` | ❌ No | ✅ Yes |
| Files | `*FILE` | ✅ Yes | ❌ No |
| Query Definitions | `*QRYDFN` | ✅ Yes | ❌ No |

---

## Detailed Object Information

### 📦 Save Files (*SAVF)

Save files are special file objects used to store saved objects and libraries.

**Available Actions:**
- ⬇️ **Download Save File** - Download save file to local system
- ⬆️ **Upload Save File** - Upload save file(s) from local system
- 🗑️ **Clear Save File** - Clear save file contents
- 💾 **Save to Save File** - Save objects/libraries to save file
- 📂 **Restore from Save File** - Restore objects/libraries from save file

**Display Features:**
- 📊 Display save file contents (objects, members, spooled files, IFS directories)
- 📋 View detailed information about saved items

---

### 📨 Data Queues (*DTAQ)

Data queues are objects used for inter-process communication, allowing programs to send and receive messages asynchronously.

**Available Actions:**
- ➡️ **Send Message** - Send new messages to the queue
- 🗑️ **Clear Queue** - Clear all messages from the queue

**Display Features:**
- 📊 Display data queue information and attributes
- 📋 View messages in the queue
- 🔑 Support for keyed and non-keyed data queues

---

### 📝 Data Areas (*DTAARA)

Data areas are objects that store data that can be accessed by multiple programs.

**Available Actions:**
- ✏️ **Change Data Area** - Change data area content

**Display Features:**
- 📊 Display data area information and current value
- 📋 View data area attributes (type, length, decimal positions)
- 🔢 Support for different data area types (*CHAR, *DEC, *LGL)

---

### 🖨️ Output Queues (*OUTQ)

Output queues manage spooled files and printer output.

**Available Actions:**
- ⏸️ **Hold/Release Queue** - Hold or release output queues
- 🗑️ **Clear Queue** - Clear output queue
- ▶️ **Start/Stop Writer** - Start or stop printer writers
- 📄 **Generate PDF** - Generate PDF from spooled files
- 🗑️ **Delete Spooled Files** - Delete individual or old spooled files

**Display Features:**
- 📊 Display output queue information and statistics
- 📋 List all spooled files in a queue with details
- 🎨 Dynamic UI based on queue and writer status

---

### 📋 Job Queues (*JOBQ)

Job queues manage batch jobs waiting to be processed.

**Available Actions:**
- ⏸️ **Hold/Release Queue** - Hold or release job queues
- 🗑️ **Clear Queue** - Clear job queue
- ⏸️ **Hold/Release Job** - Hold or release individual jobs
- 🛑 **End Job** - End individual jobs

**Display Features:**
- 📊 Display job queue information and statistics
- 📋 List all jobs in a queue with their details
- 🎨 Dynamic UI based on queue and job status

---

### 💾 User Spaces (*USRSPC)

User spaces provide temporary or permanent storage for data that can be accessed by multiple programs.

**Available Actions:**
- ✏️ **Change User Space** - Change user space data at specific positions

**Display Features:**
- 📊 Display user space information and attributes
- 📋 View user space content (hexadecimal and text representation)
- 📏 Support for different user space sizes
- 🔄 Automatic space extension capabilities

---

### 🔑 User Indexes (*USRIDX)

User indexes provide fast keyed access to data stored in user-defined entries, similar to a hash table or dictionary.

**Available Actions:**
- ➕ **Add Entry** - Add new entries to the user index
- 🗑️ **Remove Entry** - Remove entries from the user index

**Display Features:**
- 📊 Display user index information and attributes
- 📋 View all entries with their keys and values
- 🔑 Support for variable-length entries
- 📏 View entry statistics and index configuration

---

### 📄 Message Files (*MSGF)

Message files contain predefined messages used by IBM i applications.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display all messages in the message file
- 📋 View message details (ID, text, severity, reply type)
- 📄 First and second level message text
- ⚙️ Reply type and valid reply values
- 🚀 Fast table component for performance with many messages

---

### 💬 Message Queues (*MSGQ)

Message queues store messages sent by programs, system functions, or users, providing communication between jobs.

**Available Actions:**
- 📨 **Send Message** - Send message to the queue
- 🗑️ **Clear Queue** - Clear all messages from the queue

**Display Features:**
- 📊 Display message queue contents with detailed information
- 📋 View message text (first and second level)
- 📅 Show message metadata (severity, timestamp, sender job/user)
- 🚀 Fast table component for performance with many messages

---

### 🔗 Binding Directories (*BNDDIR)

Binding directories contain lists of service programs and modules used during program binding.

**Available Actions:**
- ➕ **Add Entry** - Add new entries to binding directory
- 🗑️ **Delete Entry** - Delete entries from binding directory

**Display Features:**
- 📊 Display binding directory entries
- 📋 View bound objects (library, type, activation)
- 📅 Creation date and time information
- 🔍 View exported symbols from service programs

---

### 🔧 Programs and Service Programs (*PGM, *SRVPGM)

Programs and service programs are executable objects.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display comprehensive program information
- 📋 View program attributes and properties
- 🔗 List bound modules
- 📦 List bound service programs
- 🔍 View exported symbols (for service programs)
- 🐛 Debug data availability information
- 📅 Creation and compilation information

---

### 🧩 Modules (*MODULE)

Modules are compiled ILE objects that contain executable code and can be bound into programs or service programs.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display comprehensive module information
- 📋 View module attributes (creation date, source file, compiler options)
- 📏 Detailed size information (code size, data size, debug data)
- 🔧 List all procedures defined in the module
- 🔗 View imported and exported symbols
- 📦 Display referenced system objects
- ©️ Show copyright information
- 🎨 Multi-tab interface for organized information display

---

### ⚙️ Commands (*CMD)

Command objects define IBM i CL commands.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display command definition
- 📋 View all command parameters
- 🔑 Parameter keywords and values
- 📝 Parameter descriptions
- 🔢 CCSID information

---

### 📄 Job Descriptions (*JOBD)

Job descriptions define the runtime environment for batch jobs.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display job description attributes
- 📋 View job queue, output queue, and message queue
- 👤 User profile and initial library list
- ⚙️ Job attributes and system values
- 🔧 Routing data and request data

---

### 📓 Journal Receivers (*JRNRCV)

Journal receivers store journal entries for auditing, recovery, and replication purposes.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display journal receiver information and attributes
- 📋 View receiver status and statistics
- 🔢 View sequence number ranges (first/last)
- 📅 View attachment and detachment timestamps
- 🔗 View linked receivers (previous/next in chain)
- 🌐 View remote journal configuration
- 🔍 View filter settings (objects, images, programs)
- 💾 View size and threshold information

---

### 📓 Journals (*JRN)

Journals record changes to database files, data areas, and other objects for auditing, recovery, and replication.

**Available Actions:**
- ➕ **Generate Receiver** - Generate new journal receivers
- 🔍 **Display Entries** - Display journal entries using SQL queries

**Display Features:**
- 📊 Display journal information and configuration
- 📋 View journal receiver chain with details
- 🔗 View attached receiver and receiver statistics
- 🔢 View sequence number ranges for each receiver
- 📅 View attachment, detachment, and save timestamps
- 🌐 View remote journal configuration
- 💾 View size and threshold information
- ⚙️ View journal settings (cache, filtering, fixed-length data options)

---

### 🌐 DDM Files (*DDMF)

DDM (Distributed Data Management) files provide access to files on remote systems.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
- 📊 Display DDM file configuration and attributes
- 🌐 View remote location information (system name/address, port)
- 🔗 View remote file name and library
- ⚙️ View access method and file attributes
- 🔒 View security and connection settings
- 📋 Support for multi-line field values

---

### 🖥️ Subsystem Descriptions (*SBSD)

Subsystem descriptions define independent operating environments within IBM i that control how work enters the system and how resources are allocated.

**Available Actions:**
- ▶️ **Start Subsystem** - Start subsystem
- ⏹️ **End Subsystem** - End subsystem with multiple options (*IMMED, *CNTRLD)
- 🛑 **End Job** - End individual jobs within the subsystem

**Display Features:**
- 📊 Display subsystem information and status (active/inactive)
- 📋 View memory pools configuration
- 🚀 View autostart job entries (AJEs)
- 💻 View workstation entries (WSEs)
- 📋 View job queue entries (JOBQEs)
- 🔀 View routing entries (RTGEs)
- ⚡ View prestart job entries (PJEs)
- 👥 View active jobs in the subsystem (when active)
- 🎨 Dynamic UI based on subsystem status

---

### 🎯 Classes (*CLS)

Classes define the runtime attributes for batch jobs, controlling how jobs execute and consume system resources.

**Available Actions:**
- ❌ None (View only)

**Display Features:**
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

### 📁 Files (*FILE)

File objects include physical files (PF), logical files (LF), views, and indexes that store and organize data.

**Available Actions:**
- 🔍 **Query File** - Query file contents using SQL SELECT

**Display Features:**
- 📊 Display comprehensive file/table/view/index information
- 📋 View file attributes (creation date, owner, journaling status, CCSID)
- 📈 View detailed statistics (row counts, operations, I/O metrics)
- 👥 Display file members with their statistics
- 🧭 Display columns and data types
- 🔗 Show dependent objects (indexes, views, constraints)
- 📄 View view definitions and capabilities
- 🎯 Support for both DDS and SQL-based files
- 🎨 Multi-tab interface for organized information display

---

### 🔍 Query Definitions (*QRYDFN)

Query definitions are objects created by Query/400 or Query Manager that define database queries.

**Available Actions:**
- 📊 **Translate to SQL** - Translate *QRYDFN objects to SQL statements in text editor

**Display Features:**
- 🔗 Automatic file reference conversion (LIB/FILE → LIB.FILE)
- 📖 Read-only view (use Query/400 or Query Manager to modify)

---

## Generic Actions

### 🔧 Display Object Information

A generic action that provides comprehensive information about any IBM i object, similar to the WRKOBJ/DSPOBJD command.

**Available for:** All object types

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

## Notes

- **Actions Available**: Objects with this designation have interactive buttons or commands that allow you to perform operations on them
- **View Only**: Objects with this designation provide read-only information display without modification capabilities
- All object types support the generic "Display Object Information" action for viewing comprehensive object details