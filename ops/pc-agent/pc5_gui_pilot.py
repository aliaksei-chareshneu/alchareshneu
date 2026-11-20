"""IMPERION Agent #5 / NOT DEPLOYED: single-purpose, fail-closed Notepad GUI pilot.

Only route via the existing BrowserBridge `pc_operator` action after explicit
owner-approved local deployment.  A remotely supplied GO/approval is invalid.
No arbitrary shell, application, file path, URL, text, secret or clipboard.
A local out-of-band one-use ticket is required for *each* GUI task.

This module is a review candidate. Offline mock tests are NOT Windows E2E proof.
"""
from __future__ import annotations

import ctypes
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from ctypes import wintypes
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "pc_task_data"
LOCAL_APPROVALS = (
    Path(os.environ["LOCALAPPDATA"]) / "IMPERION" / "Agent5" / "gui_approvals"
    if os.environ.get("LOCALAPPDATA") else None
)
TASK_RE = re.compile(r"^A5-GUI-[A-Z0-9-]{8,32}$")
FIXTURE = b"A5 GUI PILOT"
ACTION = "append_marker_save"
APP = "notepad"
MIN_FREE_RAM_MB = 1024
MAX_APPROVAL_AGE_SECONDS = 900
MAX_OUTPUT_BYTES = 4096
GUI_MUTEX_FILE = ".gui_operator.lock"
FAILURE_SUFFIX = ".gui.failed.json"


class Denied(Exception):
    pass


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def blocked(reason: str) -> dict:
    return {"status": "BLOCKED", "reason": reason, "mode": "gui_pilot"}


def task_filename(task_id: str) -> str:
    return task_id + ".txt"


def expected_text(task_id: str) -> str:
    return "A5 GUI PILOT\nA5 GUI SAVED " + task_id


def stable_json(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def safe_directory(p: Path) -> Path:
    if p.is_symlink() or (hasattr(p, "is_junction") and p.is_junction()):
        raise Denied("UNSAFE_DIRECTORY_LINK")
    if not p.is_dir():
        raise Denied("DIRECTORY_MISSING")
    return p


def safe_read(p: Path, *, maximum: int) -> bytes:
    if p.is_symlink() or (hasattr(p, "is_junction") and p.is_junction()):
        raise Denied("UNSAFE_FILE_LINK")
    if not p.is_file():
        raise Denied("FILE_MISSING")
    st = p.stat()
    if not 0 < st.st_size <= maximum or st.st_nlink != 1:
        raise Denied("FILE_SIZE_OR_LINK_DENIED")
    data = p.read_bytes()
    if len(data) != st.st_size:
        raise Denied("FILE_CHANGED_DURING_READ")
    return data


def normalize_saved_bytes(data: bytes) -> str:
    # Notepad versions can use CRLF and a UTF-8 BOM. No other transformations pass.
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as e:
        raise Denied("OUTPUT_NOT_UTF8") from e
    return text.replace("\r\n", "\n")


def source_file(root: Path, task_id: str) -> Path:
    safe_directory(root)
    src = safe_directory(root / "inbox") / task_filename(task_id)
    if safe_read(src, maximum=1024) != FIXTURE:
        raise Denied("ONLY_FIXED_SYNTHETIC_FIXTURE_ALLOWED")
    return src


def work_dir(root: Path) -> Path:
    return root / "gui_work"


def receipt_dir(root: Path) -> Path:
    return safe_directory(root / "receipts")


def get_ticket(approvals: Path, task_id: str, source_sha: str, clock: datetime) -> tuple[Path, bytes, dict]:
    safe_directory(approvals)
    path = approvals / (task_id + ".json")
    if (approvals / (task_id + ".claimed")).exists():
        raise Denied("APPROVAL_ALREADY_CONSUMED")
    raw = safe_read(path, maximum=1300)
    try:
        ticket = json.loads(raw)
    except (ValueError, UnicodeDecodeError) as e:
        raise Denied("BAD_APPROVAL_JSON") from e
    expected = {"task_id", "app", "action", "source_sha256", "expires_at", "approval_ref"}
    if not isinstance(ticket, dict) or set(ticket) != expected:
        raise Denied("APPROVAL_FIELDS_NOT_ALLOWED")
    if (ticket["task_id"] != task_id or ticket["app"] != APP or
            ticket["action"] != ACTION or ticket["source_sha256"] != source_sha):
        raise Denied("APPROVAL_SCOPE_MISMATCH")
    ref = ticket.get("approval_ref")
    if not isinstance(ref, str) or not re.fullmatch(r"GO-[A-Z0-9-]{8,48}", ref):
        raise Denied("APPROVAL_REFERENCE_INVALID")
    expiry = ticket["expires_at"]
    if not isinstance(expiry, str):
        raise Denied("APPROVAL_EXPIRY_INVALID")
    try:
        expires = datetime.fromisoformat(expiry.replace("Z", "+00:00"))
    except ValueError as e:
        raise Denied("APPROVAL_EXPIRY_INVALID") from e
    if expires.tzinfo is None:
        raise Denied("APPROVAL_EXPIRY_INVALID")
    seconds_left = (expires - clock).total_seconds()
    if not 0 < seconds_left <= MAX_APPROVAL_AGE_SECONDS:
        raise Denied("APPROVAL_EXPIRED_OR_TOO_LONG")
    return path, raw, ticket


def claim_ticket(approvals: Path, task_id: str, raw: bytes) -> str:
    """One-use lock created atomically. Keep claim permanently; never auto-retry GUI."""
    claim = approvals / (task_id + ".claimed")
    if claim.is_symlink() or (hasattr(claim, "is_junction") and claim.is_junction()):
        raise Denied("UNSAFE_APPROVAL_CLAIM")
    try:
        with claim.open("xb") as handle:
            handle.write(raw)
            handle.flush()
            os.fsync(handle.fileno())
    except FileExistsError as e:
        raise Denied("APPROVAL_ALREADY_CONSUMED") from e
    return sha(raw)


def ensure_fresh_work(root: Path, task_id: str) -> Path:
    folder = work_dir(root)
    if not folder.exists():
        folder.mkdir(mode=0o700)
    safe_directory(folder)
    path = folder / task_filename(task_id)
    if path.is_symlink() or path.exists():
        raise Denied("WORK_FILE_ALREADY_EXISTS")
    with path.open("xb") as handle:
        handle.write(FIXTURE)
        handle.flush()
        os.fsync(handle.fileno())
    if safe_read(path, maximum=MAX_OUTPUT_BYTES) != FIXTURE:
        raise Denied("WORK_COPY_READBACK_FAILED")
    return path


def make_receipt(root: Path, task_id: str, ticket_hash: str, approval_ref: str,
                 actual: bytes, window_verified: bool, clock: datetime) -> dict:
    body = {
        "schema": "imperion.pc5.gui_pilot.v1",
        "task_id": task_id,
        "app": APP,
        "action": ACTION,
        "source_sha256": sha(FIXTURE),
        "output_sha256": sha(actual),
        "output_bytes": len(actual),
        "approval_sha256": ticket_hash,
        "approval_ref": approval_ref,
        "window_verified": window_verified,
        "verified_at": clock.isoformat(),
        "status": "DONE",
    }
    path = receipt_dir(root) / (task_id + ".gui.json")
    if path.exists() or path.is_symlink():
        raise Denied("RECEIPT_ALREADY_EXISTS")
    content = stable_json(body)
    with path.open("xb") as handle:
        handle.write(content)
        handle.flush()
        os.fsync(handle.fileno())
    if safe_read(path, maximum=MAX_OUTPUT_BYTES) != content:
        raise Denied("RECEIPT_READBACK_FAILED")
    return {"status": "DONE", "mode": "gui_pilot", "step": "execute", "task_id": task_id,
            "file": task_filename(task_id), "output_sha256": body["output_sha256"],
            "receipt_sha256": sha(content), "window_verified": window_verified,
            "replay": False, "scope": "SYNTHETIC_NOTEPAD_ONLY"}


def verify(root: Path, task_id: str, *, approvals: Path | None = None) -> dict:
    src = source_file(root, task_id)
    del src
    path = receipt_dir(root) / (task_id + ".gui.json")
    body_raw = safe_read(path, maximum=MAX_OUTPUT_BYTES)
    try:
        body = json.loads(body_raw)
    except (ValueError, UnicodeDecodeError) as e:
        raise Denied("RECEIPT_INVALID") from e
    if (not isinstance(body, dict) or body.get("status") != "DONE" or
            body.get("task_id") != task_id or body.get("app") != APP or
            body.get("action") != ACTION or body.get("window_verified") is not True or
            body.get("source_sha256") != sha(FIXTURE)):
        raise Denied("RECEIPT_SCOPE_MISMATCH")
    if approvals is not None:
        claim = safe_directory(approvals) / (task_id + ".claimed")
        claim_raw = safe_read(claim, maximum=1300)
        if body.get("approval_sha256") != sha(claim_raw):
            raise Denied("APPROVAL_RECEIPT_MISMATCH")
    target = safe_directory(work_dir(root)) / task_filename(task_id)
    data = safe_read(target, maximum=MAX_OUTPUT_BYTES)
    if (normalize_saved_bytes(data) != expected_text(task_id) or
            body.get("output_sha256") != sha(data) or
            body.get("output_bytes") != len(data)):
        raise Denied("OUTPUT_READBACK_MISMATCH")
    return {"status": "DONE", "mode": "gui_pilot", "step": "verify", "task_id": task_id,
            "file": task_filename(task_id), "output_sha256": sha(data),
            "receipt_sha256": sha(body_raw), "independent_disk_readback": True,
            "scope": "SYNTHETIC_NOTEPAD_ONLY"}



def incomplete_state(root: Path, task_id: str, approvals: Path | None = None) -> dict:
    """Read-only crash recovery inspection: never resume an interrupted GUI write."""
    receipts = receipt_dir(root)
    complete = receipts / (task_id + ".gui.json")
    if complete.exists() or complete.is_symlink():
        return verify(root, task_id, approvals=approvals)
    failed = receipts / (task_id + FAILURE_SUFFIX)
    if failed.exists() or failed.is_symlink():
        body = json.loads(safe_read(failed, maximum=MAX_OUTPUT_BYTES))
        if not isinstance(body, dict) or body.get("task_id") != task_id or body.get("schema") != "imperion.pc5.gui_failure.v1":
            raise Denied("FAILURE_RECEIPT_INVALID")
        return blocked("INCOMPLETE_ATTEMPT_MANUAL_REVIEW")
    if approvals is not None:
        claimed = Path(approvals) / (task_id + ".claimed")
        if claimed.exists() or claimed.is_symlink():
            return blocked("INCOMPLETE_ATTEMPT_MANUAL_REVIEW")
    return {"status": "BLOCKED", "mode": "gui_pilot", "reason": "NO_COMPLETED_RECEIPT"}


@contextmanager
def exclusive_gui_slot(root: Path, task_id: str, clock: datetime):
    """One global local GUI lock. A crash leaves a marker for manual inspection."""
    directory = receipt_dir(root)
    lock = directory / GUI_MUTEX_FILE
    marker_bytes = stable_json({"task_id": task_id, "created_at": clock.isoformat()})
    if lock.is_symlink() or (hasattr(lock, "is_junction") and lock.is_junction()):
        raise Denied("GUI_LOCK_UNSAFE")
    try:
        with lock.open("xb") as handle:
            handle.write(marker_bytes)
            handle.flush()
            os.fsync(handle.fileno())
    except FileExistsError as e:
        raise Denied("GUI_BUSY_OR_RECOVERY_REQUIRED") from e
    try:
        yield
    finally:
        try:
            if lock.is_file() and not lock.is_symlink() and lock.read_bytes() == marker_bytes:
                lock.unlink()
        except OSError:
            # Stop subsequent jobs if lock cannot be safely removed.
            pass


def write_failure_receipt(root: Path, task_id: str, approval_sha: str,
                          reason: str, clock: datetime) -> None:
    """Private failure evidence once a trusted approval has been consumed."""
    if not re.fullmatch(r"[A-Z0-9_]{3,80}", reason):
        reason = "EXECUTION_FAILED"
    target = receipt_dir(root) / (task_id + FAILURE_SUFFIX)
    body = {"schema": "imperion.pc5.gui_failure.v1", "task_id": task_id,
            "status": "BLOCKED", "reason": reason, "approval_sha256": approval_sha,
            "recorded_at": clock.isoformat(), "automatic_retry": False}
    try:
        with target.open("xb") as handle:
            handle.write(stable_json(body))
            handle.flush()
            os.fsync(handle.fileno())
    except FileExistsError:
        pass


# The default OS driver is deliberately strict and may refuse a Windows 11
# packaged Notepad that does not bind the newly spawned HWND to the process PID.
# That is a safe compatibility failure, not permission to pick a different HWND.
class Win32NotepadDriver:
    def __init__(self):
        if sys.platform != "win32":
            raise Denied("WINDOWS_REQUIRED")
        self.user32 = ctypes.windll.user32
        self.kernel32 = ctypes.windll.kernel32
        self.ENUMPROC = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
        # WinAPI pointer-sized prototypes matter on 64-bit Windows.
        u, k = self.user32, self.kernel32
        u.GetForegroundWindow.restype = wintypes.HWND
        u.IsWindowVisible.argtypes = [wintypes.HWND]
        u.IsWindowVisible.restype = wintypes.BOOL
        u.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        u.GetWindowTextLengthW.argtypes = [wintypes.HWND]
        u.GetWindowTextLengthW.restype = ctypes.c_int
        u.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        u.EnumWindows.argtypes = [self.ENUMPROC, wintypes.LPARAM]
        u.EnumWindows.restype = wintypes.BOOL
        u.SetForegroundWindow.argtypes = [wintypes.HWND]
        u.SetForegroundWindow.restype = wintypes.BOOL
        u.SendInput.argtypes = [wintypes.UINT, ctypes.c_void_p, ctypes.c_int]
        u.SendInput.restype = wintypes.UINT
        u.GetLastInputInfo.argtypes = [ctypes.c_void_p]
        u.GetLastInputInfo.restype = wintypes.BOOL
        u.GetAsyncKeyState.argtypes = [ctypes.c_int]
        u.GetAsyncKeyState.restype = ctypes.c_short
        u.OpenInputDesktop.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        u.OpenInputDesktop.restype = wintypes.HANDLE
        u.GetThreadDesktop.argtypes = [wintypes.DWORD]
        u.GetThreadDesktop.restype = wintypes.HANDLE
        u.GetUserObjectInformationW.argtypes = [wintypes.HANDLE, ctypes.c_int,
                                                ctypes.c_void_p, wintypes.DWORD,
                                                ctypes.POINTER(wintypes.DWORD)]
        u.GetUserObjectInformationW.restype = wintypes.BOOL
        u.CloseDesktop.argtypes = [wintypes.HANDLE]
        u.CloseDesktop.restype = wintypes.BOOL
        k.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        k.OpenProcess.restype = wintypes.HANDLE
        k.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                                wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
        k.QueryFullProcessImageNameW.restype = wintypes.BOOL
        k.CloseHandle.argtypes = [wintypes.HANDLE]
        k.CloseHandle.restype = wintypes.BOOL
        k.GetCurrentProcessId.restype = wintypes.DWORD
        k.GetCurrentThreadId.restype = wintypes.DWORD
        k.GetTickCount.restype = wintypes.DWORD
        k.WTSGetActiveConsoleSessionId.restype = wintypes.DWORD
        k.ProcessIdToSessionId.argtypes = [wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
        k.ProcessIdToSessionId.restype = wintypes.BOOL

    def _process_names(self):
        from pc_desktop_v4 import win_process_names, app_count
        return app_count("notepad", win_process_names())

    def _desktop_name(self, handle) -> str:
        out = ctypes.create_unicode_buffer(128)
        needed = wintypes.DWORD()
        if not self.user32.GetUserObjectInformationW(handle, 2, out,
                                                     ctypes.sizeof(out), ctypes.byref(needed)):
            raise Denied("INPUT_DESKTOP_NAME_UNAVAILABLE")
        return out.value.casefold()

    def _assert_unlocked_console(self) -> None:
        active = self.kernel32.WTSGetActiveConsoleSessionId()
        mysession = wintypes.DWORD(0)
        if (active == 0xFFFFFFFF or
            not self.kernel32.ProcessIdToSessionId(self.kernel32.GetCurrentProcessId(),
                                                   ctypes.byref(mysession)) or
            mysession.value != active):
            raise Denied("ACTIVE_CONSOLE_SESSION_REQUIRED")
        inp = self.user32.OpenInputDesktop(0, False, 0x0001)  # DESKTOP_READOBJECTS
        if not inp:
            raise Denied("INPUT_DESKTOP_NOT_AVAILABLE")
        try:
            if self._desktop_name(inp) != "default":
                raise Denied("WINDOWS_LOCKED_OR_SECURE_DESKTOP")
            running = self.user32.GetThreadDesktop(self.kernel32.GetCurrentThreadId())
            if not running or self._desktop_name(running) != "default":
                raise Denied("WORKER_NOT_ON_INPUT_DESKTOP")
        finally:
            self.user32.CloseDesktop(inp)

    def _idle_ms(self) -> int:
        class LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", wintypes.UINT), ("dwTime", wintypes.DWORD)]
        info = LASTINPUTINFO()
        info.cbSize = ctypes.sizeof(info)
        if not self.user32.GetLastInputInfo(ctypes.byref(info)):
            raise Denied("LAST_INPUT_UNAVAILABLE")
        return (int(self.kernel32.GetTickCount()) - info.dwTime) & 0xFFFFFFFF

    def _require_no_held_modifiers(self) -> None:
        if any(self.user32.GetAsyncKeyState(vk) & 0x8000
               for vk in (0x10, 0x11, 0x12, 0x5B, 0x5C)):
            raise Denied("MODIFIER_KEY_HELD")

    def preflight(self) -> None:
        self._assert_unlocked_console()
        if self._process_names() != 0:
            raise Denied("EXISTING_NOTEPAD_REFUSE_TO_INTERFERE")
        if not self.user32.GetForegroundWindow():
            raise Denied("INTERACTIVE_DESKTOP_NOT_READY")
        if self._idle_ms() < 5000:
            raise Denied("USER_ACTIVE_GUI_DEFERRED")
        self._require_no_held_modifiers()

    def _verified_executable_for_pid(self, pid: int, expected: Path) -> bool:
        handle = self.kernel32.OpenProcess(0x1000, False, pid)
        if not handle:
            return False
        try:
            path_buf = ctypes.create_unicode_buffer(32768)
            size = wintypes.DWORD(len(path_buf))
            if not self.kernel32.QueryFullProcessImageNameW(handle, 0, path_buf, ctypes.byref(size)):
                return False
            actual = os.path.normcase(os.path.normpath(path_buf.value))
            approved = os.path.normcase(os.path.normpath(str(expected)))
            return actual == approved
        finally:
            self.kernel32.CloseHandle(handle)

    def _window_for_spawned_pid(self, pid: int, filename: str) -> int:
        found = []
        def visit(hwnd, _):
            if not self.user32.IsWindowVisible(hwnd):
                return True
            process = wintypes.DWORD(0)
            self.user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process))
            if process.value != pid:
                return True
            n = self.user32.GetWindowTextLengthW(hwnd)
            if n == 0 or n > 250:
                return True
            title = ctypes.create_unicode_buffer(n + 1)
            self.user32.GetWindowTextW(hwnd, title, n + 1)
            if filename.casefold() in title.value.casefold():
                found.append(int(hwnd))
            return True
        cb = self.ENUMPROC(visit)
        self.user32.EnumWindows(cb, 0)
        return found[0] if len(found) == 1 else 0

    def _send(self, codes: list[tuple[int, int, int]]) -> None:
        # All events sent as one Win32 INPUT array to avoid interleaving typing.
        ULONG_PTR = ctypes.c_size_t
        class MOUSEINPUT(ctypes.Structure):
            _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                        ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                        ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]
        class KEYBDINPUT(ctypes.Structure):
            _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                        ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                        ("dwExtraInfo", ULONG_PTR)]
        class HARDWAREINPUT(ctypes.Structure):
            _fields_ = [("uMsg", wintypes.DWORD), ("wParamL", wintypes.WORD),
                        ("wParamH", wintypes.WORD)]
        class INNER(ctypes.Union):
            _fields_ = [("mi", MOUSEINPUT), ("ki", KEYBDINPUT), ("hi", HARDWAREINPUT)]
        class INPUT(ctypes.Structure):
            _fields_ = [("type", wintypes.DWORD), ("union", INNER)]
        expected_size = 40 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28
        if ctypes.sizeof(INPUT) != expected_size:
            raise Denied("SENDINPUT_ABI_LAYOUT_UNVERIFIED")
        arr = (INPUT * len(codes))()
        for i, (vk, scancode, flags) in enumerate(codes):
            arr[i].type = 1
            arr[i].union.ki = KEYBDINPUT(vk, scancode, flags, 0, 0)
        sent = self.user32.SendInput(len(codes), ctypes.byref(arr), ctypes.sizeof(INPUT))
        if sent != len(codes):
            raise Denied("SEND_INPUT_FAILED")

    @staticmethod
    def _control_codes(key: int):
        return [(0x11, 0, 0), (key, 0, 0), (key, 0, 2), (0x11, 0, 2)]

    @staticmethod
    def _unicode_codes(text: str):
        units = text.encode("utf-16-le")
        pairs = []
        for i in range(0, len(units), 2):
            u = int.from_bytes(units[i:i + 2], "little")
            pairs.extend([(0, u, 4), (0, u, 6)])
        return pairs

    def append_save(self, working_path: Path, task_id: str) -> dict:
        exe = Path(os.environ.get("WINDIR", r"C:\Windows")) / "System32" / "notepad.exe"
        if not exe.is_file():
            raise Denied("NOTEPAD_EXECUTABLE_MISSING")
        try:
            process = subprocess.Popen([str(exe), str(working_path)], executable=str(exe),
                                       shell=False, cwd=str(working_path.parent), close_fds=True)
        except OSError as e:
            raise Denied("NOTEPAD_LAUNCH_FAILED") from e
        until = time.monotonic() + 8
        hwnd = 0
        while time.monotonic() < until:
            hwnd = self._window_for_spawned_pid(process.pid, working_path.name)
            if hwnd:
                break
            if process.poll() is not None:
                break
            time.sleep(0.12)
        if not hwnd:
            # Do not close anything on an unverifiable/packaged Notepad path.
            raise Denied("NEW_NOTEPAD_WINDOW_NOT_VERIFIED")
        if not self._verified_executable_for_pid(process.pid, exe):
            raise Denied("NOTEPAD_PROCESS_IDENTITY_MISMATCH")
        self._assert_unlocked_console()
        self._require_no_held_modifiers()
        if self._idle_ms() < 5000:
            raise Denied("USER_ACTIVE_GUI_DEFERRED")
        if not self.user32.SetForegroundWindow(hwnd) or self.user32.GetForegroundWindow() != hwnd:
            raise Denied("NOTEPAD_FOREGROUND_NOT_VERIFIED")
        time.sleep(0.15)
        if (self.user32.GetForegroundWindow() != hwnd or
            not self._verified_executable_for_pid(process.pid, exe) or
            self._window_for_spawned_pid(process.pid, working_path.name) != hwnd):
            raise Denied("FOCUS_LOST_BEFORE_ACTION")
        self._assert_unlocked_console()
        self._require_no_held_modifiers()
        # Ctrl+End, Enter, fixed marker, Ctrl+S -- no clipboard or arbitrary input.
        codes = (self._control_codes(0x23) + [(0x0D, 0, 0), (0x0D, 0, 2)] +
                 self._unicode_codes("A5 GUI SAVED " + task_id) + self._control_codes(0x53))
        self._send(codes)
        if self.user32.GetForegroundWindow() != hwnd:
            raise Denied("FOCUS_LOST_AFTER_ACTION")
        return {"window_verified": True, "input_sent": True, "save_sent": True}


def operate(payload: object, *, root: Path = ROOT, approvals: Path | None = LOCAL_APPROVALS,
            driver=None, clock: datetime | None = None, platform: str | None = None,
            free_ram_mb: int | None = None) -> dict:
    try:
        if not isinstance(payload, dict) or payload.get("mode") != "gui_pilot":
            raise Denied("BAD_MODE")
        if len(stable_json(payload)) > 350:
            raise Denied("PAYLOAD_TOO_LARGE")
        step = payload.get("step")
        if step == "capabilities":
            if set(payload) != {"mode", "step"}:
                raise Denied("FIELDS_NOT_ALLOWED")
            return {"status": "DONE", "mode": "gui_pilot", "step": "capabilities",
                    "available": ["capabilities", "plan", "status", "execute", "verify"],
                    "app": APP, "action": ACTION, "requires_local_owner_ticket": True,
                    "scope": "FIXED_SYNTHETIC_NOTEPAD_ONLY"}
        if step not in ("execute", "verify", "plan", "status") or set(payload) != {"mode", "step", "task_id", "app"}:
            raise Denied("FIELDS_NOT_ALLOWED")
        task_id = payload.get("task_id")
        if not isinstance(task_id, str) or not TASK_RE.fullmatch(task_id):
            raise Denied("TASK_ID_NOT_ALLOWED")
        if payload.get("app") != APP:
            raise Denied("APP_NOT_ALLOWLISTED")
        root = Path(root)
        if step == "verify":
            return verify(root, task_id, approvals=approvals)
        if step == "status":
            return incomplete_state(root, task_id, approvals=approvals)
        if step == "plan":
            src = source_file(root, task_id)
            return {"status": "READY", "mode": "gui_pilot", "step": "plan",
                    "task_id": task_id, "app": APP, "action": ACTION,
                    "source_sha256": sha(safe_read(src, maximum=1024)),
                    "requires_local_owner_ticket": True, "no_action_executed": True}
        existing = root / "receipts" / (task_id + ".gui.json")
        if existing.exists() or existing.is_symlink():
            old = verify(root, task_id, approvals=approvals)
            return {**old, "step": "execute", "replay": True}
        if (sys.platform if platform is None else platform) != "win32":
            raise Denied("WINDOWS_REQUIRED")
        if approvals is None:
            raise Denied("LOCAL_OWNER_APPROVALS_NOT_CONFIGURED")
        source_file(root, task_id)
        clock = clock or datetime.now(timezone.utc)
        if clock.tzinfo is None:
            raise Denied("CLOCK_MUST_BE_TIMEZONE_AWARE")
        ticket_path, raw_ticket, ticket = get_ticket(approvals, task_id, sha(FIXTURE), clock)
        del ticket_path
        if free_ram_mb is None:
            from pc_desktop_v4 import win_memory
            free_ram_mb, _ = win_memory()
        if type(free_ram_mb) is not int or free_ram_mb < MIN_FREE_RAM_MB:
            raise Denied("GUI_LOW_MEMORY_NO_EXECUTION")
        driver = Win32NotepadDriver() if driver is None else driver
        with exclusive_gui_slot(root, task_id, clock):
            # Serialize preflight with execution: two tasks cannot drive GUI together.
            driver.preflight()
            if (work_dir(root) / task_filename(task_id)).exists():
                raise Denied("WORK_FILE_ALREADY_EXISTS")
            ticket_hash = claim_ticket(approvals, task_id, raw_ticket)
            try:
                working = ensure_fresh_work(root, task_id)
                state = driver.append_save(working, task_id)
                if state != {"window_verified": True, "input_sent": True, "save_sent": True}:
                    raise Denied("GUI_DRIVER_READBACK_NOT_ATTESTED")
                deadline = time.monotonic() + 7
                while True:
                    actual = safe_read(working, maximum=MAX_OUTPUT_BYTES)
                    if normalize_saved_bytes(actual) == expected_text(task_id):
                        break
                    if time.monotonic() >= deadline:
                        raise Denied("GUI_SAVE_NOT_VERIFIED")
                    time.sleep(0.12)
                return make_receipt(root, task_id, ticket_hash, ticket["approval_ref"],
                                    actual, True, clock)
            except Exception as exc:
                reason = str(exc) if isinstance(exc, Denied) else "LOCAL_" + type(exc).__name__.upper()
                try:
                    write_failure_receipt(root, task_id, ticket_hash, reason, clock)
                except (OSError, ValueError, TypeError):
                    pass  # Consumed approval still prevents all automatic retries.
                raise
    except Denied as e:
        return blocked(str(e))
    except (OSError, ValueError, TypeError, KeyError, RuntimeError) as e:
        return blocked("LOCAL_" + type(e).__name__.upper())
