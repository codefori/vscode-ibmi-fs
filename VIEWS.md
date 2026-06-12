# IBM i Views Documentation

This document provides detailed information about all interactive views available in the vscode-ibmi-fs extension.

## Table of Contents

- [Display Object Information (DSPOBJ)](#display-object-information-dspobj)
- [Work with Active Jobs (WRKACTJOB)](#work-with-active-jobs-wrkactjob)
- [Work with Job (WRKJOB)](#work-with-job-wrkjob)
- [Work with Spooled Files (WRKSPLF)](#work-with-spooled-files-wrksplf)
- [Work with User Jobs (WRKUSRJOB)](#work-with-user-jobs-wrkusrjob)

---

## Display Object Information (DSPOBJ)

**Command:** `vscode-ibmi-fs.dspobj`

### Overview

A generic action available for **all object types** that provides comprehensive information similar to the IBM i WRKOBJ/DSPOBJD command. This view displays detailed object information, locks, and authorizations in a multi-tab interface.

### How to Access

1. **From FS Quick Start Menu:** Click "FS Quick Start" in the status bar → Select "DSPOBJ"
2. **From Object Browser:** Right-click on any object → Select "Display Object Information"
3. **From Editor Toolbar:** Click the toolbar icon when viewing an object
4. **From Command Palette:** Run `Display Object Information` command

### Features

#### Information Tab
Displays comprehensive object details:
- **SQL Name** - SQL object name
- **SQL Type** - SQL object type
- **Owner** - Object owner
- **Definer** - Object definer
- **Size** - Object size in bytes
- **ASP Group** - Auxiliary Storage Pool group (for libraries)
- **Text Description** - Object text description
- **Created** - Creation timestamp
- **Changed** - Last change timestamp
- **Last Used** - Last usage timestamp
- **Days Used** - Number of days the object has been used
- **Saved** - Last save timestamp
- **Save Device** - Device used for last save
- **Save Volume** - Volume used for last save
- **Save Sequence** - Save sequence number
- **Restored** - Last restore timestamp
- **Journaled** - Journal status and journal name
- **Authorization List** - Authorization list name

#### Locks Tab
Shows all active locks on the object:
- **Lock State** - Current lock state (e.g., *SHRNUP, *EXCL)
- **Lock Status** - Lock status (e.g., HELD)
- **Lock Scope** - Lock scope (e.g., *JOB, *THREAD)
- **Job Name** - Job holding the lock (format: number/user/name)

#### Authorizations Tab
Displays object authorizations for all users and groups:
- **Authorization Name** - User or group name
- **Object Authority** - Overall object authority (e.g., *ALL, *USE, *CHANGE)
- **Operational** - Object operational authority (YES/NO)
- **Management** - Object management authority (YES/NO)
- **Existence** - Object existence authority (YES/NO)
- **Alter** - Object alter authority (YES/NO)
- **Reference** - Object reference authority (YES/NO)
- **Read** - Data read authority (YES/NO)
- **Add** - Data add authority (YES/NO)
- **Update** - Data update authority (YES/NO)
- **Delete** - Data delete authority (YES/NO)
- **Execute** - Data execute authority (YES/NO)

### Technical Details

**SQL Services Used:**
- `QSYS2.OBJECT_STATISTICS` - Object information and statistics
- `QSYS2.OBJECT_LOCK_INFO` - Lock information
- `QSYS2.OBJECT_PRIVILEGES` - Authorization information

---

## Work with Active Jobs (WRKACTJOB)

**Command:** `vscode-ibmi-fs.wrkactjob`

### Overview

Displays and manages all active jobs in the IBM i system. Provides real-time monitoring and control of running jobs with search and filtering capabilities.

### Features

#### Job List Display
Shows all active jobs with the following information:
- **Subsystem** - Subsystem name where the job is running
- **Job** - Job name (format: number/user/name)
- **User** - Authorization name (user running the job)
- **Type** - Job type (e.g., BCH, INT, SBS)
- **Function** - Current function being performed
- **Status** - Job status (e.g., ACTIVE, HLD)
- **Temp. Storage** - Temporary storage used (KB)
- **Elapsed CPU %** - Elapsed CPU percentage
- **Elapsed I/O** - Elapsed total disk I/O count
- **CPU Time** - Total CPU time used (milliseconds)
- **Total I/O** - Total disk I/O count

#### Available Actions

For each active job (except subsystem jobs):

1. **Details** - Opens the Work with Job (WRKJOB) view for detailed information
2. **Hold** - Holds the job (only shown if job is not held)
3. **Release** - Releases a held job (only shown if job is held)
4. **End** - Ends the job with confirmation
5. **Debug** - Starts service entry for debugging the job

#### Search and Filter
- Real-time search across all job fields
- Search by job name, user, type, status, subsystem, or function
- Results update automatically as you type

#### Auto-Refresh
- Manual refresh available via toolbar button
- Automatic refresh every 30 seconds (for active jobs only)

### Technical Details

**SQL Services Used:**
- `QSYS2.ACTIVE_JOB_INFO` - Active job information with detailed statistics

---

## Work with Job (WRKJOB)

**Command:** `vscode-ibmi-fs.wrkjob`

### Overview

Displays comprehensive information about a specific job, including job details, activation groups, call stack, locks, open files, spool files, and job log. This is the most detailed view for job analysis and troubleshooting.

### How to Access

1. **From Command Palette:** Run `Work with Job` and enter job name
2. **From WRKACTJOB:** Click "Details" button on any job
3. **From WRKUSRJOB:** Click "Details" button on any job
4. **Programmatically:** Call with job name parameter

### Features

#### Job Info Tab
Displays comprehensive job information:
- **Job Status** - Overall job status (ACTIVE, OUTQ, etc.)
- **Active Status** - Active job status (RUN, HLD, etc.)
- **Function** - Current function being performed
- **Job Type** - Type of job
- **Subsystem** - Subsystem where job is running
- **Job Description** - Job description (library/name)
- **Submitter Job** - Job that submitted this job
- **Entered System Time** - When job entered the system
- **Scheduled Time** - Scheduled start time
- **Active Time** - When job became active
- **End Time** - When job ended
- **End Severity** - Job end severity
- **Completion Status** - Job completion status
- **Job Queue** - Job queue (library/name)
- **Allow Multiple Threads** - Thread support
- **Peak Temporary Storage** - Peak temporary storage used
- **Default Wait** - Default wait time
- **Max Processing Time** - Maximum processing time allowed
- **Max Temporary Storage** - Maximum temporary storage allowed
- **CCSID** - Coded character set identifier
- **Character ID Control** - Character identifier control
- **Date Format** - Date format
- **Date Separator** - Date separator character
- **Time Separator** - Time separator character
- **Decimal Format** - Decimal format
- **Message Logging** - Message logging level and severity
- **Inquiry Message Reply** - Inquiry message reply setting
- **Spooled File Action** - Spooled file action
- **Temporary Storage** - Current temporary storage
- **Elapsed CPU %** - Elapsed CPU percentage
- **Elapsed I/O** - Elapsed I/O count
- **CPU Time** - Total CPU time
- **Total I/O** - Total I/O count

**Available Actions:**
- **Release Job** - Release a held job (shown only if job is held)
- **End Job** - End the job

#### Job Statistics Tab
Contains six sub-sections:

##### Library List
Shows the job library list:
- **Library** - Library name
- **Type** - Library type (SYS, CUR, USR)
- **ASP** - ASP name
- **Description** - Library description

##### Activation Groups
Shows all activation groups currently available:
- **Group** - Activation group name
- **Number** - Activation group number
- **State** - Activation group state
- **Library** - Program library
- **Program** - Program name
- **Type** - Program type
- **In Use** - In-use indicator

##### Call Stack
Shows the program call stack:
- **Position** - Ordinal position in stack
- **Program** - Program name (library/program)
- **Statement** - Statement identifier
- **Procedure** - Procedure name

##### Locks
Shows all locks held by the job:
- **Object** - Object name (library/object)
- **Type** - Object type
- **State** - Lock state
- **Status** - Lock status
- **Scope** - Lock scope
- **Member Lock** - Member lock type

##### Open Files
Shows all files opened by the job:
- **File** - File name (library/file)
- **Member** - Member name
- **Type** - File type
- **Option** - Open option
- **Shared** - Shared opens count
- **Writes** - Write count
- **Reads** - Read count

##### Spooled Files
Shows all spool files created by the job:
- **Name** - Spooled file name
- **User Data** - User data
- **Status** - Spool status
- **Pages** - Number of pages
- **Timestamp** - Creation timestamp

**Spool Actions:**
- **Open** - Open spool file in editor
- **Download** - Download spool as PDF
- **Delete** - Delete spool file

#### Job Log Tab
Displays all job log messages:
- **MSGID** - Message ID
- **Message** - Message text
- **Second Level** - Second level message text (collapsible)
- **Severity** - Message severity
- **From Program** - Program that sent the message
- **Timestamp** - Message timestamp

### Auto-Refresh

- Automatic refresh every 30 seconds
- Auto-refresh stops when job status is OUTQ
- Manual refresh available via toolbar button
- Tab state is preserved during refresh

### Technical Details

**SQL Services Used:**
- `QSYS2.JOB_INFO` - Job information
- `QSYS2.ACTIVE_JOB_INFO` - Active job information
- `QSYS2.ACTIVATION_GROUP_INFO` - Activation groups information
- `QSYS2.STACK_INFO` - Call stack information
- `QSYS2.JOB_LOCK_INFO` - Lock information
- `QSYS2.OPEN_FILES` - Open files information
- `QSYS2.SPOOLED_FILE_INFO` - Spool file information
- `QSYS2.JOBLOG_INFO` - Job log messages

---

## Work with Spooled Files (WRKSPLF)

**Command:** `vscode-ibmi-fs.wrksplf`

### Overview

Displays and manages all spooled files in the IBM i system. Provides comprehensive spool file management with search, pagination, and multiple actions.

### Features

#### Spool File List Display
Shows all spool files with the following information:
- **Name** - Spooled file name
- **Data** - User data
- **Status** - Spool status (RDY, HLD, etc.)
- **User** - User who created the spool
- **Job** - Job name that created the spool
- **Number** - Spool file number
- **Timestamp** - Creation timestamp
- **Pages** - Number of pages
- **Size (KB)** - Spool file size in kilobytes

#### Available Actions

For each spool file:

1. **Open** - Opens the spool file in VS Code editor
2. **Download** - Downloads the spool file as PDF
3. **Delete** - Deletes the spool file with confirmation

#### Search and Filter
- Real-time search across all spool fields
- Search by name, user, user data, status, or job name
- Results update automatically as you type

#### Pagination
- Configurable items per page (default: 50)
- Navigate between pages
- Shows total count and current page
- Maintains search filter across pages

#### Manual Refresh
- Refresh button available in toolbar
- Updates spool list with current search and pagination settings

### Technical Details

**SQL Services Used:**
- `QSYS2.SPOOLED_FILE_INFO` - Spool file information

**Pagination:**
- Uses SQL LIMIT and OFFSET for efficient data retrieval
- Separate count query for total items
- Maintains state across refreshes

---

## Work with User Jobs (WRKUSRJOB)

**Command:** `vscode-ibmi-fs.wrkusrjob`

### Overview

Displays all jobs in the system, both active and inactive. Provides a comprehensive view of all jobs with their current status and allows management of active jobs.

### Features

#### Job List Display
Shows all jobs with the following information:
- **Job** - Job name (format: number/user/name)
- **Job Status** - Overall job status (ACTIVE, OUTQ, JOBQ, etc.)
- **Active Status** - Active job status (RUN, HLD, etc.) - only for active jobs
- **Type** - Job type (BCH, INT, etc.)
- **End Severity** - Job end severity
- **Completion** - Completion status
- **Function** - Current function being performed (for active jobs)

#### Available Actions

Actions are conditionally displayed based on job status:

1. **Details** - Opens the Work with Job (WRKJOB) view (available for all jobs)
2. **Hold** - Holds the job (only for active jobs that are not held)
3. **Release** - Releases a held job (only for active jobs that are held)
4. **End** - Ends the job (only for active jobs)

#### Search and Filter
- Real-time search across all job fields
- Search by job name, job status, active status, type, completion status, or function
- Results update automatically as you type

#### Manual Refresh
- Refresh button available in toolbar
- Updates job list with current search settings

### Technical Details

**SQL Services Used:**
- `QSYS2.JOB_INFO` - All job information (active and inactive)
- `QSYS2.ACTIVE_JOB_INFO` - Additional information for active jobs

**Join Logic:**
- LEFT JOIN between JOB_INFO and ACTIVE_JOB_INFO
- Provides complete job information including inactive jobs
- Active status and function only available for active jobs

---

## Common Features Across All Views

### Multilingual Support
All views support 9 languages with automatic detection:
- English (default)
- Italian
- French
- German
- Spanish
- Japanese
- Korean
- Brazilian Portuguese
- Simplified and Traditional Chinese

### Modern UI
- Based on VSCode Webview Toolkit
- Consistent look and feel with VS Code
- Responsive design
- Dark/Light theme support

### Interactive Tables
- Sortable columns (where applicable)
- Sticky headers for easy navigation
- Collapsible columns for detailed information
- Action buttons integrated in table rows

### Error Handling
- Graceful handling of missing SQL services
- Clear error messages
- Validation of user inputs
- Connection status checks

### Performance
- Efficient SQL queries with proper filtering
- Pagination for large datasets
- Optimized data fetching
- Minimal resource usage

---