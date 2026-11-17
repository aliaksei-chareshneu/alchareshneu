#!/usr/bin/env node
'use strict';
// Owner-only GAS deployment for already merged PR #357.
// No arguments = dry run; --apply = write only after three fresh cloud clones.
// No new OAuth, triggers, CRM, timers, emails, or external sends.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
crypto=require('node:crypto'),cp=require('node:child_process'),vm=require('node:vm');
const SCRIPT_ID='1a_AHisFPBBLsi7I_T5rXBL0NmikoA4Iux7UaqLVAiX8aYLtPY-G3CRhl';
const TARGET='ImperionIntakeSync.js';
const OLD='    var cfg=impPrivateConfig_(),ss=SpreadsheetApp.openById(cfg.sheetId);';
const NEW='    var cfg=impStartupReadWithRetry_(function(){return impPrivateConfig_();}),\n'+
'        ss=impStartupReadWithRetry_(function(){return SpreadsheetApp.openById(cfg.sheetId);});';
const MAIN='function imperionSyncPrivateIntake(){';
const EARLY='impAgent4CrmPull_(cfg,ss)';
const HELPER=String.raw