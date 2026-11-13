"""Bounded read-only public Office documents inside official city property ZIP.

Bounded local OCR for one scanned PDF; no external network calls, no private uploads, no Office macros.
This reads only text in public PDF/DOCX/XLSX/OpenDocument attachments.
Names, personal contacts and raw document text do NOT enter public artifacts.
"""
from __future__ import annotations
from collections import Counter
import io
from pathlib import PurePosixPath
import re
import subprocess
import xml.etree.ElementTree as ET
from zipfile import ZipFile, BadZipFile

MAX_FILE = 3_000_000
MAX_ENTRY = 18
MAX_ZIP_EXPANSION = 7_000_000
MAX_XML = 3_000_000
MAX_SHEET_ROWS = 3000
MAX_SHEET_CELLS = 55000
MAX_CHARACTERS = 180_000

OOX_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
SH_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
ODF_NS = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def file_extension(filename: str) -> str:
    name = PurePosixPath(filename).name
    suffix = PurePosixPath(name).suffix.lower()
    return suffix if suffix in (".pdf",".docx",".xlsx",".txt",".csv",".ods",".doc",".xls",".xml") else "other"


def xml_read(z: ZipFile, name: str) -> bytes:
    try:
        info = z.getinfo(name)
    except KeyError:
        return b""
    if info.file_size > MAX_XML:
        return b""
    return z.read(info)


def docx_text(blob: bytes) -> tuple[str,str]:
    try:
        with ZipFile(io.BytesIO(blob)) as z:
            raw = xml_read(z,"word/document.xml")
            if not raw:
                return "","DOCX_DOCUMENT_XML_MISSING_OR_LARGE"
            root = ET.fromstring(raw)
            paras=[]
            for p in root.iter(OOX_NS+"p"):
                text="".join((t.text or "") for t in p.iter(OOX_NS+"t"))
                if text:
                    paras.append(text)
            return "\n".join(paras)[:MAX_CHARACTERS],"DOCX_TEXT_OK"
    except (OSError, ValueError, BadZipFile, ET.ParseError):
        return "","DOCX_UNREADABLE"


def xlsx_text(blob: bytes) -> tuple[str,str]:
    try:
        with ZipFile(io.BytesIO(blob)) as z:
            sstrings=[]
            shared=xml_read(z,"xl/sharedStrings.xml")
            if shared:
                root=ET.fromstring(shared)
                for si in root.iter(SH_NS+"si"):
                    sstrings.append("".join((t.text or "") for t in si.iter(SH_NS+"t")))
                    if len(sstrings)>=MAX_SHEET_CELLS:
                        break
            names=sorted(n for n in z.namelist() if re.fullmatch(r"xl/worksheets/sheet\d+\.xml",n))
            text=[]
            cells_seen=0
            for name in names[:8]:
                raw=xml_read(z,name)
                if not raw:
                    continue
                root=ET.fromstring(raw)
                rows=0
                for row in root.iter(SH_NS+"row"):
                    vals=[]
                    rows+=1
                    if rows>MAX_SHEET_ROWS or cells_seen>=MAX_SHEET_CELLS:
                        break
                    for cell in row.iter(SH_NS+"c"):
                        cells_seen+=1
                        if cells_seen>MAX_SHEET_CELLS:
                            break
                        typ=cell.get("t")
                        v=cell.find(SH_NS+"v")
                        inline=cell.find(SH_NS+"is")
                        if typ=="s" and v is not None and v.text:
                            try:val=sstrings[int(v.text)]
                            except (ValueError, IndexError):val=""
                        elif typ=="inlineStr" and inline is not None:
                            val="".join(x.text or "" for x in inline.iter(SH_NS+"t"))
                        elif v is not None:
                            val=v.text or ""
                        else:
                            val=""
                        if val.strip():
                            vals.append(val.strip()[:220])
                    if vals:
                        # Same row includes street, number, or cadastral
                        # identifiers in different cells; retain row boundary.
                        text.append(" ".join(vals))
                    if sum(map(len,text))>MAX_CHARACTERS:
                        break
                if sum(map(len,text))>MAX_CHARACTERS:
                    break
            return "\n".join(text)[:MAX_CHARACTERS],"XLSX_TEXT_OK"
    except (OSError, ValueError, BadZipFile, ET.ParseError):
        return "","XLSX_UNREADABLE"


def ods_text(blob: bytes) -> tuple[str,str]:
    try:
        with ZipFile(io.BytesIO(blob)) as z:
            raw=xml_read(z,"content.xml")
            if not raw:
                return "","ODS_CONTENT_XML_MISSING_OR_LARGE"
            root=ET.fromstring(raw)
            paras=[" ".join((node.text or "") for node in p.iter() if node.text)
                   for p in root.iter(ODF_NS+"p")]
            return "\n".join(x for x in paras if x.strip())[:MAX_CHARACTERS],"ODS_TEXT_OK"
    except (OSError, ValueError, BadZipFile, ET.ParseError):
        return "","ODS_UNREADABLE"


MAX_OCR_PAGES = 5
MAX_RENDERED_PAGE_BYTES = 8_000_000
MAX_OCR_CHARS = 100_000


def pdf_ocr_text(blob: bytes) -> tuple[str, str]:
    """Last-resort bounded local OCR for a *public* scanned PDF.

    Only an official allowlisted municipal attachment can reach this call.
    No third-party OCR, external API, shell, saved images or persistent text.
    Caller publishes only cautious property address hints, never OCR lines.
    """
    if not 0 < len(blob) <= MAX_FILE:
        return "", "PDF_OCR_FILE_TOO_LARGE"
    try:
        info = subprocess.run(
            ["pdfinfo", "-"], input=blob, capture_output=True,
            timeout=10, check=False
        )
        if info.returncode:
            return "", "PDF_OCR_INFO_FAILED"
        match = re.search(rb"(?m)^Pages:\s+(\d+)\s*$", info.stdout)
        if not match:
            return "", "PDF_OCR_PAGE_COUNT_UNKNOWN"
        pages = int(match.group(1))
        if pages == 0 or pages > MAX_OCR_PAGES:
            return "", "PDF_OCR_PAGE_LIMIT_" + str(pages)
        texts = []
        for page in range(1, pages + 1):
            rendered = subprocess.run(
                ["pdftoppm", "-f", str(page), "-l", str(page),
                 "-singlefile", "-scale-to", "1850", "-png", "-"],
                input=blob, capture_output=True, timeout=20, check=False
            )
            png = rendered.stdout
            if (rendered.returncode or not png.startswith(b"\x89PNG\r\n\x1a\n")
                    or len(png) > MAX_RENDERED_PAGE_BYTES):
                return "", "PDF_OCR_RENDER_FAILED"
            ocr = subprocess.run(
                ["tesseract", "stdin", "stdout", "-l", "ces+eng",
                 "--psm", "3"],
                input=png, capture_output=True, timeout=30, check=False
            )
            if ocr.returncode or len(ocr.stdout) > MAX_OCR_CHARS:
                return "", "PDF_OCR_ENGINE_FAILED"
            texts.append(ocr.stdout.decode("utf-8", errors="replace"))
        combined = "\n".join(texts).strip()
        return (combined[:MAX_CHARACTERS],
                "PDF_OCR_ALL_PAGES_" + str(pages) if combined
                else "PDF_OCR_EMPTY_ALL_PAGES_" + str(pages))
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return "", "PDF_OCR_EXECUTION_UNAVAILABLE"


def pdf_text(blob: bytes) -> tuple[str,str]:
    # Fixed executable with stdin/stdout and timeout. No shell/no file writes.
    try:
        result=subprocess.run(["pdftotext","-layout","-","-"],input=blob,
                              capture_output=True,timeout=12,check=False)
        if result.returncode:
            return "","PDF_TEXT_UNREADABLE"
        text=result.stdout.decode("utf-8",errors="replace")[:MAX_CHARACTERS]
        return (text, "PDF_TEXT_OK") if text.strip() else pdf_ocr_text(blob)
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return "","PDF_EXTRACTOR_UNAVAILABLE"


def extract_text(blob: bytes, extension: str) -> tuple[str,str]:
    if len(blob)>MAX_FILE:
        return "","DOCUMENT_TOO_LARGE"
    if extension==".docx":
        return docx_text(blob)
    if extension==".xlsx":
        return xlsx_text(blob)
    if extension==".ods":
        return ods_text(blob)
    if extension==".pdf":
        return pdf_text(blob)
    if extension in (".txt",".csv"):
        return blob.decode("utf-8-sig",errors="replace")[:MAX_CHARACTERS],"PLAIN_TEXT_OK"
    return "","UNSUPPORTED_ATTACHMENT_TYPE"


def inspect_official_zip(raw: bytes, location_extractor=None) -> dict:
    """Only type and aggregate statistics returned; file names remain private.

    Caller may supply a cautious property-address/location extractor.
    """
    try:
        with ZipFile(io.BytesIO(raw)) as z:
            infos=[x for x in z.infolist() if not x.is_dir()]
            if len(infos)>MAX_ENTRY or sum(x.file_size for x in infos)>MAX_ZIP_EXPANSION:
                return {"status":"ZIP_TOO_MANY_FILES_OR_UNCOMPRESSED_BYTES",
                        "attachment_count":len(infos), "file_types":{},
                        "document_checks":[],"location_hints":[]}
            docs=[]
            locations=[]
            for info in infos:
                ext=file_extension(info.filename)
                blob=z.read(info) if info.file_size<=MAX_FILE else b""
                text,state=extract_text(blob,ext) if blob else ("","DOCUMENT_TOO_LARGE")
                hints=location_extractor(text) if location_extractor and text else []
                locations.extend(hints[:30])
                docs.append({"type":ext,"bytes_uncompressed":info.file_size,
                             "extraction_status":state,
                             "text_characters":len(text),
                             "location_hints":len(hints)})
            counts=Counter(x["type"] for x in docs)
            return {"status":"PUBLIC_ARCHIVE_ATTACHMENT_TYPES_CHECKED",
                    "attachment_count":len(infos),
                    "file_types":dict(sorted(counts.items())),
                    "document_checks":docs,
                    "location_hints":list(dict.fromkeys(locations))[:70],
                    "available_now_verified":False,
                    "free_five_years_legally_verified":False}
    except (OSError,ValueError,BadZipFile):
        return {"status":"ZIP_CORRUPT_OR_UNREADABLE",
                "attachment_count":0, "file_types":{},
                "document_checks":[],"location_hints":[]}
