# vscode-ibmi-fs

This extension provides additional functionality not found in the base for editing objects inside of the QSYS file system.

## Current functionality

Provides the ability to view and edit some objects in the IBM i QSYS File System.

Has support for:

* Message Files (MSGF)
* Binding Directories (BNDDIR)
* Programs and Service Programs (PGM/SRVPGM)
* Data Areas (DTAARA) - display and edit
* Data Queues (DTAQ) - display, send data, clear
* Save Files (SAVF) - display, download and upload
* Message queue viewer  
    - Command category `IBM i Messages:`
    - View your own Message
    - View messages in any queue you have authority to
    - Answer messages
    - Clean up messages
    - Deactivate view if not wanted through config setting `vscode-ibmi-fs.msgqBrowser.enabled`
* User Jobs view 
    - Command category `IBM i User Jobs:`
    - View your own jobs 
    - Answer jobs waiting on a reply 
    - Clean up jobs 
    - Release and hold jobs 
    - Deactivate view if not wanted through config setting `vscode-ibmi-fs.userJobBrowser.enabled`
    - Required system items, `table function QSYS2.JOB_INFO()` and `table function QSYS2.GET_JOB_INFO()`
 

## TODO:

* More file types
