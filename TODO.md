*  MessageQueue message viewer
    *  ✔ add message queue to viewer 
        *  ✔ refresh list
    *  ✔ sort list of message queues 
    *  ✔ delete any one message queue filter 
        *  ✔ refresh list
    *  ✔ refresh list of message queues in view
    *  ✔ Indicate if message is a inquiry or normal message
        * ✔ ICON???
*  Clear message queue messages
    *  ✔ All 
        *  Refresh afterwards
    *  ✔ All unanswered
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
*  Filtering of messages        
    * Do i need to know if there are entries for MSGQ before attempting to filter???
    *  If I do, how to I go about getting this count?
        *   Apply QTY to tree view item?
        *   Count the results of the query, run SQL again?
*  View of message details (F9 on 5250)
    *  ✔ All of the message attributes
    *  ✔ First level text
    *  ✔ Second level text
        *  ✔ Formatting text as seen in DSPMSG 5250 tool

*  Ordering / Sorting
    *   Do I create a package command for each order by to allow the menu labels to reflect possible action?
    *   Ordering by "Name" is that by MESSAGE_ID or MESSAGE_TEXT?
    
*  Show Inquiry Messages
    *  command to filter to INQUIRY messages only
    *  Option to send reply to INQURY Message

*  Message queue security
    *   How to do I reliably protect some MSGQs?
    *   Lock when *MSGQ is *EXCL by another job?
        *  Extension will not put a lock on the *MSGQ


*  System object management for MSGQS
    *  Verify authority to MSGQ and lock if not authorized to edit
    *  CLRMSGQ (for remove all messages above)

*  Add filtering based on user of messages
    *  All features for working with a message should be the same as with MSGQ name
    *  Add optional parameters to certain functions to load based on MSGQ or USER.
        *  Do I need to know if the filter is a MSGQ or USER filter type??
            *  If so, copy code from the SPOOLED FILE BROWSER extension to accomplish