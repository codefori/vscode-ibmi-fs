import { ExtensionContext } from "vscode";
export interface Profile {
  profile: string
}

export interface JobLog {
  timestamp: string
  messageId: string
  severity: number
  texte: string
}

export interface JobFilter {
  nameFilter: string
  jobNameFilter: string
  jobUserFilter: string
  jobNumberFilter: string
  profileFilter: string
  subsystemFilter: string
}

export interface ActiveJobInfo {
  jobName: string
  jobNameShort: string
  jobUser: string
  jobNumber: string
  jobStatus: string
}

export interface SubSystemInfo extends JobFilter {
  subsystemName: string
  subsystemLibrary: string
  subsystemDescription: string
}

export interface JobInfo {
  jobName: string
  jobNameShort: string
  jobUser: string
  jobNumber: string
}

export interface JobChange {
  jobName: string
  jobUser: string
  jobNumber: string
  jobpty: string
  outpty: string
  prtdev: string
  outq: string
  runpty: string
  jobq: string
  prttxt: string
  log: string
  logclpgm: string
  logoutput: string
  jobmsgqfl: string
  inqmsgrpy: string
  brkmsg: string
  stsmsg: string
  ddmcnv: string
  scddate: string
  scdtime: string
  date: string
  datfmt: string
  datsep: string
  timsep: string
  sws: string
  timeslice: string
  purge: string
  dftwait: string
  devrcyacn: string
  tsepool: string
  prtkeyfmt: string
  srtseq: string
  langid: string
  cntryid: string
  ccsid: string
  decfmt: string
  chridctl: string
  splfacn: string
  wlcgrp: string
  cputime: string
  maxtmpstg: string
  prcrscpty: string
  dupjobopt: string
}