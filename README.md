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
* Message queue viewer  - view your own message, message in any queue you have authority to, answer messages, clean up messages, deactivate view if not wanted through config setting `vscode-ibmi-fs.msgqBrowser.enabled`
* User Jobs view - view your own jobs, answer jobs waiting on a reply, clean up jobs, release and hold jobs, deactivate view if not wanted through config setting `vscode-ibmi-fs.userJobBrowser.enabled`
 

## TODO:

* More file types
