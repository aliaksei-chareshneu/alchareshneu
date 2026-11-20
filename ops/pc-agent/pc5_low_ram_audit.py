"""Agent5 M6: lightweight Windows health snapshot without PowerShell or GUI.

Purpose: report only coarse RAM, fixed OS disk free, uptime and process counts
when the full offline audit is blocked by low RAM. Never closes applications,
reads files, collects command lines, changes a setting or asks a model.
"""
from __future__ import annotations
import ctypes
import os
import re
import shutil
import sys
from pathlib import Path
from pc_desktop_v4 import CATALOG, app_count


def denied(reason):
    return {"status":"BLOCKED", "mode":"audit_light", "reason":reason,
            "changes_applied":0}


def operate(payload, *, platform=None, memory_reader=None, disk_reader=None,
            uptime_reader=None, names_reader=None, env=None):
    if not isinstance(payload,dict) or set(payload)!={"mode"} or payload.get("mode")!="audit_light":
        return denied("FIELDS_NOT_ALLOWED")
    if (sys.platform if platform is None else platform)!="win32":
        return denied("WINDOWS_REQUIRED")
    env=os.environ if env is None else env
    drive=env.get("SystemDrive","C:")
    if not isinstance(drive,str) or not re.fullmatch(r"[A-Za-z]:",drive):
        return denied("SYSTEM_DRIVE_UNAVAILABLE")
    drive=drive.upper()
    try:
        if memory_reader is None:
            from pc_desktop_v4 import win_memory
            memory_reader=win_memory
        if disk_reader is None:
            disk_reader=shutil.disk_usage
        if names_reader is None:
            from pc_desktop_v4 import win_process_names
            names_reader=win_process_names
        if uptime_reader is None:
            fn=ctypes.windll.kernel32.GetTickCount64
            fn.restype=ctypes.c_ulonglong
            uptime_reader=lambda:round(fn()/60000)
        free,total=memory_reader()
        disk=disk_reader(Path(drive+"\\"))
        uptime=uptime_reader()
        names=names_reader()
    except (OSError,ValueError,RuntimeError,TypeError,AttributeError):
        return denied("READ_ONLY_PROBE_UNAVAILABLE")
    if (type(free) is not int or type(total) is not int or total <= 0 or
            free < 0 or free > total or type(uptime) is not int or
            uptime < 0 or not isinstance(names,list) or len(names) > 5000 or
            any(type(n) is not str or len(n)>260 for n in names)):
        return denied("PROBE_DATA_INVALID")
    try:
        disk_free,disk_total=disk.free,disk.total
        if (type(disk_free) is not int or type(disk_total) is not int or
                disk_total <= 0 or disk_free < 0 or disk_free > disk_total):
            return denied("PROBE_DATA_INVALID")
        counts={app:app_count(app,names) for app in ("chrome","edge","notepad","python","ollama")}
    except (TypeError,ValueError,AttributeError,KeyError):
        return denied("PROBE_DATA_INVALID")
    return {
        "status":"DONE", "mode":"audit_light", "scope":"COARSE_READ_ONLY_NO_PATHS",
        "ram_free_mb":free,"ram_total_mb":total,
        "ram_gui_ready":free>=1024,"ram_local_4b_ready":free>=5120,
        "system_drive":drive,"disk_free_gb":round(disk_free/(1024**3),1),
        "disk_total_gb":round(disk_total/(1024**3),1),
        "uptime_minutes":uptime, "allowlisted_process_counts":counts,
        "defender_status":"NOT_CHECKED_USE_FULL_AUDIT",
        "changes_applied":0,"apps_terminated":0,"worker_restarted":False,
    }
