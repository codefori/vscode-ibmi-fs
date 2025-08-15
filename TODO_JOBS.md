*   Summary
    ✔️  View to see jobs for a particular user, like command WRKUSRJOB.
    ✔️  No search provided. 
    ✔️  Jobs to monitor, user profile

*  Actions 
    ✔️  Adding filter
    ✔️  Removing filter
    ✔️  Specialized filtering for jobs in message wait status
    ✔️  Auto sorting filter list when modifying filter list
    ✔️  Default sort by date job enterd system in descending order
    ✔️  Ability to sort by job name or date job enterd system, ascending or descending order
    ✔️  Viewing job details, AKA, DSPJOB ... OUTPUT(*PRINT) OPTION( *ALL)
    ✔️  Answering a job in message wait status
    ✔️  Holding a job
    ✔️  Releasing a job

*  System requirements
    ✔️  table function QSYS2.JOB_INFO(JOB_USER_FILTER => '???') JI, lists jobs in any status still on system
    ✔️  table function QSYS2.GET_JOB_INFO(JI.JOB_NAME,V_IGNORE_ERRORS =>'YES') GJI, use primarily for knowing if job is in MSGW status.
 
