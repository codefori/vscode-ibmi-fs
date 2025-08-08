*  View to see jobs for a particular user, like command WRKUSRJOB.
*  No search over needed. 
*  Jobs to monitor
  *  User
  *  Others??
*  The only actions allowed are...
  *  Adding filter
  *  Removing filter
  *  Answering a job in MSGW

*  System items needed...
  *  table function QSYS2.JOB_INFO(JOB_USER_FILTER => '???') JI, lists jobs in any status still on system
  *  table function QSYS2.GET_JOB_INFO(JI.JOB_NAME,V_IGNORE_ERRORS =>'YES') GJI, use primarily for knowing if job is in MSGW status.

*  How to get the message details for the message that needs answering for job??
*  