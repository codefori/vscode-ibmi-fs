*  MessageQueue message viewer
    *  ✔ add message queue to viewer 
        *  ✔ refresh list
    *  ✔ sort list of message queues 
    *  ✔ delete any one message queue filter 
        *  ✔ refresh list
    *  ✔ refresh list of message queues in view
    *  Indicate if message is a inquiry or normal message
        *  ICON???
*  Clear message queue messages
    *  ✔ All 
        *  Refresh afterwards
    *  Selected
        *  Refresh afterwards
    *  Filtered
        *  Refresh afterwards
    *  by ID
        *  Refresh afterwards
*  Hoover over/tooltip 
    *  ✔ Message queue 
        *  ✔ Object Text 
            *  ✔ when no text replace null return with *BLANKS
        *  ✔ Message count 
    *  ✔ Message item 
        *  ✔ Message attributes 
*  View of message details (F9 on 5250)
    *  All of the message attributes
    *  First level text
    *  Second level text
        *  Formatting text as seen in DSPMSG 5250 tool
*  Show Inquiry Messages
    *  Option to send reply to Inqury Message

*  System object management for MSGQS
    *  Verify authority to MSGQ and lock if not authorized to edit
    *  CRTMSGQ (should also add a filter for the same Q name)
    *  CLRMSGQ (for remove all messages above)
    *  DLTMSGQ (should also remove the filter of the same Q name)
    *  CHGMSGQ (uncertain how this command prompt interface would work.  Could an action be added and then triggered to run???)