"""IMPERION Agent5 v4: low-memory read-only Windows application supervision.

Only named allowlisted application process counts and coarse memory metrics.
No shell, arbitrary process name, process arguments, PID, window title,
file paths, account data, application startup or termination from cloud.
"""
import ctypes
import json
import os
import sys
from ctypes import wintypes

CATALOG = {
    "notepad": ("notepad.exe",),
    "calculator": ("calculatorapp.exe", "calculator.exe"),
    "vscode": ("code.exe",),
    "chrome": ("chrome.exe",),
    "edge": ("msedge.exe",),
    "python": ("python.exe", "pythonw.exe"),
    "ollama": ("ollama.exe",),
}
MEMORY_LAUNCH_MIN_MB = 1024


class PROCESSENTRY32W(ctypes.Structure):
    _fields_ = [
        ("dwSize", wintypes.DWORD),
        ("cntUsage", wintypes.DWORD),
        ("th32ProcessID", wintypes.DWORD),
        ("th32DefaultHeapID", ctypes.c_size_t),
        ("th32ModuleID", wintypes.DWORD),
        ("cntThreads", wintypes.DWORD),
        ("th32ParentProcessID", wintypes.DWORD),
        ("pcPriClassBase", wintypes.LONG),
        ("dwFlags", wintypes.DWORD),
        ("szExeFile", wintypes.WCHAR * 260),
    ]


class MEMORYSTATUSEX(ctypes.Structure):
    _fields_ = [
        ("dwLength", wintypes.DWORD),
        ("dwMemoryLoad", wintypes.DWORD),
        ("ullTotalPhys", ctypes.c_ulonglong),
        ("ullAvailPhys", ctypes.c_ulonglong),
        ("ullTotalPageFile", ctypes.c_ulonglong),
        ("ullAvailPageFile", ctypes.c_ulonglong),
        ("ullTotalVirtual", ctypes.c_ulonglong),
        ("ullAvailVirtual", ctypes.c_ulonglong),
        ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
    ]


def blocked(reason):
    return {"status": "BLOCKED", "reason": reason}


def win_process_names():
    kernel = ctypes.windll.kernel32
    kernel.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
    kernel.Process32FirstW.restype = wintypes.BOOL
    kernel.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
    kernel.Process32NextW.restype = wintypes.BOOL
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel.CloseHandle.restype = wintypes.BOOL
    snap = kernel.CreateToolhelp32Snapshot(2, 0)
    invalid = ctypes.c_void_p(-1).value
    if snap in (-1, invalid, None):
        raise OSError("WINDOWS_SNAPSHOT_FAILED")
    found = []
    try:
        entry = PROCESSENTRY32W()
        entry.dwSize = ctypes.sizeof(PROCESSENTRY32W)
        ok = kernel.Process32FirstW(snap, ctypes.byref(entry))
        while ok:
            found.append(str(entry.szExeFile).casefold())
            if len(found) > 4000:
                raise OSError("PROCESS_COUNT_LIMIT")
            ok = kernel.Process32NextW(snap, ctypes.byref(entry))
    finally:
        kernel.CloseHandle(snap)
    return found


def win_memory():
    kernel = ctypes.windll.kernel32
    kernel.GlobalMemoryStatusEx.argtypes = [ctypes.POINTER(MEMORYSTATUSEX)]
    kernel.GlobalMemoryStatusEx.restype = wintypes.BOOL
    data = MEMORYSTATUSEX()
    data.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
    if not kernel.GlobalMemoryStatusEx(ctypes.byref(data)):
        raise OSError("WINDOWS_MEMORY_QUERY_FAILED")
    return round(data.ullAvailPhys / 1048576), round(data.ullTotalPhys / 1048576)


def app_count(app, names):
    targets = CATALOG[app]
    return sum(name.casefold() in targets for name in names)


def operate(payload, *, names_reader=None, memory_reader=None, system=None):
    system = sys.platform if system is None else system
    if not isinstance(payload, dict) or not isinstance(payload.get("mode"), str):
        return blocked("BAD_PAYLOAD")
    try:
        if len(json.dumps(payload, ensure_ascii=True)) > 256:
            return blocked("PAYLOAD_SIZE_DENIED")
    except (TypeError, ValueError):
        return blocked("BAD_PAYLOAD")
    mode = payload["mode"]
    if mode not in ("app_status", "machine_readiness"):
        return blocked("MODE_NOT_ALLOWED")
    if mode == "app_status":
        if set(payload) != {"mode", "app"} or not isinstance(payload.get("app"), str):
            return blocked("FIELDS_NOT_ALLOWED")
        app = payload["app"]
        if app not in CATALOG:
            return blocked("APP_NOT_ALLOWLISTED")
    elif set(payload) != {"mode"}:
        return blocked("FIELDS_NOT_ALLOWED")
    if system != "win32":
        return blocked("WINDOWS_REQUIRED")
    names_reader = win_process_names if names_reader is None else names_reader
    memory_reader = win_memory if memory_reader is None else memory_reader
    try:
        if mode == "app_status":
            names = names_reader()
            count = app_count(app, names)
            return {"status": "DONE", "mode": mode, "app": app,
                    "running": count > 0, "instances": min(count, 4000),
                    "scope": "ALLOWLIST_PROCESS_NAME_COUNTS_ONLY"}
        free_mb, total_mb = memory_reader()
        if not isinstance(free_mb, int) or not isinstance(total_mb, int):
            return blocked("MEMORY_READBACK_INVALID")
        if free_mb < 0 or total_mb <= 0 or free_mb > total_mb:
            return blocked("MEMORY_READBACK_INVALID")
        return {"status": "DONE", "mode": mode,
                "free_ram_mb": free_mb, "total_ram_mb": total_mb,
                "gui_pilot_memory_ready": free_mb >= MEMORY_LAUNCH_MIN_MB,
                "gui_pilot_min_free_mb": MEMORY_LAUNCH_MIN_MB,
                "app_launch_from_cloud": "DISABLED",
                "known_apps": sorted(CATALOG),
                "scope": "READ_ONLY_NO_PIDS_NO_ARGS_NO_WINDOW_TITLES"}
    except (OSError, ValueError, RuntimeError):
        return blocked("HOST_METRIC_UNAVAILABLE")


def selftest():
    checks = []
    def check(key, ok):
        checks.append((key, bool(ok)))
    example = ["notepad.exe", "chrome.exe", "chrome.exe", "code.exe", "python.exe"]
    names = lambda: example
    ram = lambda: (2048, 16384)
    def run(payload, *, platform="win32", memory=ram):
        return operate(payload, names_reader=names, memory_reader=memory, system=platform)
    x = run({"mode": "app_status", "app": "notepad"})
    check("notepad_fixed_process_count", x.get("status") == "DONE" and x.get("instances") == 1)
    y = run({"mode": "app_status", "app": "chrome"})
    check("chrome_fixed_process_count", y.get("status") == "DONE" and y.get("instances") == 2)
    check("uninstalled_tool_report",run({"mode":"app_status","app":"ollama"}).get("instances")==0)
    ready = run({"mode":"machine_readiness"})
    check("memory_readback",ready.get("status")=="DONE" and ready.get("free_ram_mb")==2048)
    check("threshold_ready",ready.get("gui_pilot_memory_ready") is True)
    check("threshold_not_ready",run({"mode":"machine_readiness"},memory=lambda:(256,16384)).get("gui_pilot_memory_ready") is False)
    check("no_arbitrary_pids",all(word not in json.dumps(x).lower() for word in ("pid", "exe", "cmd", "username")))
    check("no_window_titles",not any(key in ready for key in ("window_title", "commandline", "username", "pid")))
    check("no_shell_program",run({"mode":"app_status","app":"powershell"}).get("reason")=="APP_NOT_ALLOWLISTED")
    check("no_custom_process_name",run({"mode":"app_status","app":"malware.exe"}).get("reason")=="APP_NOT_ALLOWLISTED")
    check("no_arbitrary_command",run({"mode":"app_status","app":"notepad","args":["/c","del"]}).get("reason")=="FIELDS_NOT_ALLOWED")
    check("no_create_program",run({"mode":"app_launch","app":"notepad"}).get("reason")=="MODE_NOT_ALLOWED")
    check("no_fake_go",run({"mode":"machine_readiness","ownerApproved":True}).get("reason")=="FIELDS_NOT_ALLOWED")
    check("nonwindows_denied",run({"mode":"app_status","app":"chrome"},platform="linux").get("reason")=="WINDOWS_REQUIRED")
    check("host_failure_block",run({"mode":"machine_readiness"},memory=lambda: (_ for _ in ()).throw(OSError())).get("status")=="BLOCKED")
    check("invalid_memory_block",run({"mode":"machine_readiness"},memory=lambda:(20000,16384)).get("status")=="BLOCKED")
    check("only_advertised_apps",set(ready.get("known_apps",[]))==set(CATALOG))
    check("no_policy_escalation",ready.get("app_launch_from_cloud")=="DISABLED")
    good=all(ok for _,ok in checks)
    return {"status":"PASS" if good else "FAIL","passed":sum(ok for _,ok in checks),
            "total":len(checks),"checks":checks}


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--selftest":
        result = selftest()
        print(json.dumps(result,ensure_ascii=True))
        sys.exit(0 if result["status"] == "PASS" else 1)
    print(json.dumps(blocked("SELFTEST_ONLY")))
    sys.exit(2)
