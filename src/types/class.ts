/**
 * Class Management Module
 *
 * This module provides functionality for viewing IBM i Class objects (CLS).
 * Classes define the runtime attributes for batch jobs, including run priority,
 * time slice, and resource limits (CPU time, temporary storage, threads).
 *
 * Key Features:
 * - Display class information and attributes
 * - View run priority and time slice settings
 * - View resource limits (CPU time, temporary storage, threads)
 * - View default wait time settings
 * - View purge eligibility status
 * - View usage statistics (last used date, days used count)
 * - Automatic creation of required SQL objects (stored procedure, view, function)
 * - Read-only view (no modification capabilities)
 *
 * Technical Implementation:
 * - Uses QWCRCLSI API to retrieve class information
 * - Creates temporary SQL objects in the connection's temp library
 * - Leverages SQL stored procedures and table functions for data retrieval
 *
 * @module class
 */

import Base from "./base";
import { getInstance } from "../ibmi";
import { getColumns, generateDetailTable } from "../tools";
import * as vscode from 'vscode';
import { CommandResult } from "@halcyontech/vscode-ibmi-types";

/**
 * Class (CLS) object class
 * Handles display of IBM i Class information and attributes
 *
 * Classes define runtime attributes for batch jobs including:
 * - Run priority (1-99, lower = higher priority)
 * - Time slice (milliseconds of CPU time per time slice)
 * - Resource limits (CPU time, temporary storage, active threads)
 * - Default wait time for locks
 * - Purge eligibility
 */
export default class Cls extends Base {
  /** Class information retrieved from database */
  private cls?: any;
  /** Column definitions for display table */
  columns: Map<string, string> = new Map();
  /** SQL SELECT clause (unused in current implementation) */
  selectClause: string | undefined;

  /**
   * Fetch class information from IBM i
   *
   * This method performs the following steps:
   * 1. Checks if required SQL objects exist (stored procedure, view, function)
   * 2. If missing, creates them using QWCRCLSI API wrapper
   * 3. Queries the class information from the created view
   *
   * The SQL objects are created in the connection's temporary library and include:
   * - QWCRCLSI: Stored procedure that calls the QWCRCLSI API
   * - CLASS_INFO: Table function that retrieves all classes using OBJECT_STATISTICS
   * - CLASS_INFO: View that exposes the table function results
   *
   * @throws Will show error message if SQL objects cannot be created
   */
  async fetch(): Promise<void> {
    const ibmi = getInstance();
    const connection = ibmi?.getConnection();
    if (connection) {
      // Check if required SQL objects exist in the temporary library
      // We need: QWCRCLSI procedure, CLASS_INFO view, and CLASS_INFO function
      let check = await connection.runSQL(
        `SELECT SUM(CONTEGGIO) AS objok
          FROM (
                  SELECT COUNT(*) AS CONTEGGIO
                      FROM qsys2.sysroutines
                      WHERE specific_schema = '${connection.getConfig().tempLibrary}'
                            AND SPECIFIC_NAME = 'QWCRCLSI'
                  UNION ALL
                  SELECT COUNT(*) AS CONTEGGIO
                      FROM QSYS2.sysviews
                      WHERE table_schema = '${connection.getConfig().tempLibrary}'
                            AND table_name = 'CLASS_INFO'
                  UNION ALL
                  SELECT COUNT(*) AS CONTEGGIO
                      FROM QSYS2.SYSFUNCS
                      WHERE specific_schema = '${connection.getConfig().tempLibrary}'
                            AND SPECIFIC_NAME = 'CLASS_INFO'
         )`);
     
     // If any of the 3 required objects are missing, create them all
     if(!check || check[0].OBJOK!==3){
       try{
         // Write SQL script to create the required objects
          const content=connection.getContent();
          if(content){
            // Create SQL script that defines:
            // 1. QWCRCLSI stored procedure (wrapper for QWCRCLSI API)
            // 2. CLASS_INFO table function (retrieves all classes)
            // 3. CLASS_INFO view (exposes the function results)
            await content.writeStreamfileRaw(connection.getConfig().tempDir+'/clsbuild.sql',`
              --
              -- Subject: Finding IBM i class objects and return the class attributes
              -- Author: Scott Forstie
              -- Date  : February, 2025
              --
              -- Co-author: Christian Jorgensen
              -- Date  : February, 2025
              --
              -- This service uses a stored procedure to call API QWCRCLSI,
              -- not using printed output from the Display Class (DSPCLS) CL command.
              --
              -- Features Used: This Gist uses object_statistics, SQL PL, Pipe
              --
              -- Resources:
              -- https://www.ibm.com/docs/api/v1/content/ssw_ibm_i_75/apis/qwcrclsi.htm
              --

              drop function if exists ${connection.getConfig().tempLibrary}.class_info;
              drop procedure if exists ${connection.getConfig().tempLibrary}.QWCRCLSI;

              --
              -- UDTF... return single class information via QWCRCLSI API
              --
              create or replace procedure ${connection.getConfig().tempLibrary}.QWCRCLSI(
                out   Buf     char( 112 )
              , in    BufLen  integer
              , in    Format  char(   8 )
              , in    QObj    char(  20 )
              , in    EC      char(   8 ) for bit data
              )
              language CL
              parameter style general
              program type main
              external name 'QSYS/QWCRCLSI'
              ;

              --
              -- UDTF... find class information
              --
              CREATE OR REPLACE FUNCTION ${connection.getConfig().tempLibrary}.class_info ()
                  RETURNS TABLE (
                      class_library VARCHAR(10) FOR SBCS DATA,
                      class_name VARCHAR(10) FOR SBCS DATA, 
                      text_description VARCHAR(50) FOR SBCS DATA,
                      last_used date, 
                      use_count INTEGER, 
                      run_priority INTEGER,
                      eligible_purge VARCHAR(4) FOR SBCS DATA,
                      time_slice INTEGER, 
                      default_wait VARCHAR(11) FOR SBCS DATA,
                      maximum_cpu_time  VARCHAR(11) FOR SBCS DATA,
                      maximum_temporary_storage_allowed VARCHAR(11) FOR SBCS DATA,
                      maximum_active_threads VARCHAR(11) FOR SBCS DATA
                  )
                  NOT DETERMINISTIC
                  EXTERNAL ACTION
                  MODIFIES SQL DATA
                  NOT FENCED
                  SET OPTION commit = *none, usrprf = *user, dynusrprf = *user
                  BEGIN
                      DECLARE local_sqlcode INTEGER;
                      DECLARE local_sqlstate CHAR(5);
                      DECLARE v_message_text VARCHAR(70);
                      DECLARE v_dspcls VARCHAR(1000);
                      --
                      -- QWCRCLSI detail
                      --
                      DECLARE v_class CHAR(10);
                      DECLARE v_class_library CHAR(10);
                      DECLARE v_class_run_priority INTEGER;
                      DECLARE v_class_time_slice INTEGER;
                      DECLARE v_class_eligible_purge VARCHAR(4) FOR SBCS DATA;
                      DECLARE v_class_dft_wait VARCHAR(11);
                      DECLARE v_class_max_cpu VARCHAR(11) FOR SBCS DATA;
                      DECLARE v_class_max_tmp_stg VARCHAR(11) FOR SBCS DATA;
                      DECLARE v_class_max_threads VARCHAR(11) FOR SBCS DATA;
                      --
                      -- OBJECT_STATISTICS detail
                      --
                      DECLARE find_classes_query_text VARCHAR(5000);
                      DECLARE v_cls_text VARCHAR(50);
                      DECLARE v_job_name VARCHAR(28);
                      DECLARE v_cls_last_use DATE;
                      DECLARE v_cls_use_count INTEGER;
                      DECLARE buffer char( 112 ) for bit data not null default '';
                      DECLARE c_find_classes CURSOR FOR find_classes_query;
                      DECLARE CONTINUE HANDLER FOR sqlexception
                      BEGIN
                          GET DIAGNOSTICS CONDITION 1
                                  local_sqlcode = db2_returned_sqlcode,
                                  local_sqlstate = returned_sqlstate;
                          SET v_message_text = 'systools.class_info() failed with: ' CONCAT
                                      local_sqlcode CONCAT '  AND ' CONCAT local_sqlstate;
                          SIGNAL SQLSTATE 'QPC01' SET MESSAGE_TEXT = v_message_text;
                      END;
                      SET find_classes_query_text =
              'select libs.objname, objs.OBJNAME, objs.OBJTEXT, objs.LAST_USED_TIMESTAMP, objs.DAYS_USED_COUNT from table (
                              qsys2.object_statistics(''QSYS      '', ''*LIB'')
                            ) libs, lateral ( select * FROM TABLE (qsys2.OBJECT_STATISTICS(libs.objname,''CLS    '')) AS a ) objs'
                      ;
                      PREPARE find_classes_query FROM find_classes_query_text;
                      OPEN c_find_classes;
                      l1: LOOP
                          FETCH FROM c_find_classes
                              INTO v_class_library, v_class, v_cls_text, v_cls_last_use,
                                  v_cls_use_count;
                          GET DIAGNOSTICS CONDITION 1
                                  local_sqlcode = db2_returned_sqlcode,
                                  local_sqlstate = returned_sqlstate;
                          IF (local_sqlstate = '02000') THEN
                              CLOSE c_find_classes;
                              RETURN;
                          END IF;
                          CALL ${connection.getConfig().tempLibrary}.QWCRCLSI( buffer, 112, 'CLSI0100', v_class concat v_class_library, x'00000000' );
                          SET v_class_run_priority = INTERPRET(SUBSTR(buffer, 29, 4 ) AS INTEGER);
                          SET v_class_time_slice = INTERPRET(SUBSTR(buffer, 33, 4 ) AS INTEGER);
                          SET v_class_eligible_purge = case when INTERPRET(SUBSTR(buffer, 37, 4 ) AS INTEGER) = 1 then '*YES' else '*NO' end;
                          SET v_class_dft_wait = INTERPRET(SUBSTR(buffer, 41, 4 ) AS INTEGER);
                          IF ( TRIM( v_class_dft_wait ) = '-1' ) THEN SET v_class_dft_wait = '*NOMAX'; END IF;
                          SET v_class_max_cpu = INTERPRET(SUBSTR(buffer, 45, 4 ) AS INTEGER);
                          IF ( TRIM( v_class_max_cpu ) = '-1' ) THEN SET v_class_max_cpu = '*NOMAX'; END IF;
                          SET v_class_max_tmp_stg = INTERPRET(SUBSTR(buffer, 109, 4 ) AS INTEGER);
                          IF ( TRIM( v_class_max_tmp_stg ) = '-1' ) THEN SET v_class_max_tmp_stg = '*NOMAX'; END IF;
                          SET v_class_max_threads = INTERPRET(SUBSTR(buffer, 53, 4 ) AS INTEGER);
                          IF ( TRIM( v_class_max_threads ) = '-1' ) THEN SET v_class_max_threads = '*NOMAX'; END IF;
                          PIPE (
                              v_class_library,
                              v_class, v_cls_text, v_cls_last_use, v_cls_use_count,
                              v_class_run_priority, v_class_eligible_purge, v_class_time_slice, v_class_dft_wait,
                              v_class_max_cpu, v_class_max_tmp_stg, v_class_max_threads);
                      END LOOP; /* L1 */
                      CLOSE c_find_classes;
                  END;


              --
              -- Create a view to expose the class information
              --
              CREATE OR REPLACE VIEW ${connection.getConfig().tempLibrary}.class_info (
                      class_library FOR COLUMN class_lib, class_name FOR COLUMN class,
                      TEXT_DESCRIPTION FOR COLUMN text,
                      LAST_USED_TIMESTAMP FOR COLUMN last_used, use_count,
                      run_priority FOR COLUMN priority, time_slice, eligible_purge,
                      default_wait FOR COLUMN DFTWAIT, maximum_cpu_time FOR COLUMN cpu_time,
                      maximum_temporary_storage_allowed FOR COLUMN max_stg,
                      maximum_active_threads FOR COLUMN max_thread) AS
                  SELECT *
                      FROM TABLE (
                              ${connection.getConfig().tempLibrary}.class_info()
                          );
            `)
            
            // Execute the SQL script to create the objects
            const runsql: CommandResult = await connection.runCommand({
              command: `RUNSQLSTM SRCSTMF('${connection.getConfig().tempDir}/clsbuild.sql') COMMIT(*NONE)`,
              environment: `ile`,
            });

            if (runsql.code !== 0) {
              vscode.window.showErrorMessage(`Unable to create necessary objects for displaying classes.`);
              return;
            } else {
              // Clean up the temporary SQL script file
              await connection.runCommand({
                command: `rm -f ${connection.getConfig().tempDir}/clsbuild.sql`,
                environment: `pase`,
              });
            }
          } else {
            vscode.window.showErrorMessage(`Unable to create necessary objects for displaying classes.`);
            return;
          }
        } catch (error) {
          console.dir(error)
          vscode.window.showErrorMessage(`Unable to create necessary objects for displaying classes.`);
          return;
        }
      }

      // Define column mappings for display
      // Maps database column names to user-friendly display labels
      this.columns= new Map<string,string>([
        ['TEXT_DESCRIPTION','Text'],
        ['LAST_USED_TIMESTAMP','Last used date'],
        ['USE_COUNT','Days used count'],
        ['RUN_PRIORITY','Run priority'],
        ['TIME_SLICE','Time slice in ms'],
        ['ELIGIBLE_PURGE','Eligible for purge'],
        ['DEFAULT_WAIT','Default wait time in s'],
        ['MAXIMUM_CPU_TIME','Maximum CPU time in ms'],
        ['MAXIMUM_TEMPORARY_STORAGE_ALLOWED','Maximum temporary storage in MB'],
        ['MAXIMUM_ACTIVE_THREADS','Maximum threads']
      ])

      // Query the class information for the specific class
      this.cls = await connection.runSQL(
        `SELECT TEXT_DESCRIPTION,
          LAST_USED_TIMESTAMP,
          USE_COUNT,
          RUN_PRIORITY,
          TIME_SLICE,
          ELIGIBLE_PURGE,
          DEFAULT_WAIT,
          MAXIMUM_CPU_TIME,
          MAXIMUM_TEMPORARY_STORAGE_ALLOWED,
          MAXIMUM_ACTIVE_THREADS
        FROM ${connection.getConfig().tempLibrary}.class_info
        where CLASS_LIBRARY= '${this.library}' and CLASS_NAME = '${this.name}'`)
    } else {
      vscode.window.showErrorMessage(`Not connected to IBM i`);
      return;
    }
  }

  /**
   * Generate HTML for the class information view
   *
   * Creates a detailed table displaying all class attributes including:
   * - Text description
   * - Usage statistics (last used date, days used count)
   * - Run priority and time slice
   * - Resource limits (CPU time, temporary storage, threads)
   * - Default wait time and purge eligibility
   *
   * @returns HTML string containing the formatted class information table
   */
  generateHTML(): string {
    return generateDetailTable({
      title: `Class: ${this.library}/${this.name}`,
      subtitle: 'Class Information',
      columns: this.columns,
      data: this.cls,
      hideNullValues:true
    });
  }

  /**
   * Handle user actions from the webview
   *
   * Classes are read-only objects in this implementation,
   * so no actions are available to the user.
   *
   * @param data - Action data from the webview (unused)
   * @returns Empty action result indicating no actions were performed
   */
  async handleAction(data: any): Promise<HandleActionResult> {
    // No actions to handle for classes (read-only view)
    return {};
  }

  /**
   * Save changes to the class object
   *
   * This method is not implemented as classes are displayed
   * in read-only mode. Class attributes should be modified
   * using the CHGCLS (Change Class) CL command.
   */
  async save(): Promise<void> {
    // Classes are read-only in this view
    // Use CHGCLS command to modify class attributes
  }
}
