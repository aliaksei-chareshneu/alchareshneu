import io
from pathlib import Path
import unittest
from zipfile import ZipFile, ZIP_DEFLATED
from office_archive import (
    docx_text, xlsx_text, extract_text, inspect_official_zip, file_extension,
)
from city_assets import extract_property_strings

def zip_blob(files):
    out=io.BytesIO()
    with ZipFile(out,"w",compression=ZIP_DEFLATED) as z:
        for name,content in files.items():
            z.writestr(name,content)
    return out.getvalue()

class ArchiveOfficeTests(unittest.TestCase):
    def test_docx_text(self):
        doc=b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Klobasova 9</w:t></w:r></w:p></w:body></w:document>'
        blob=zip_blob({"word/document.xml":doc})
        text,status=docx_text(blob)
        self.assertEqual(status,"DOCX_TEXT_OK")
        self.assertIn("Klobasova 9",text)
    def test_excel_shared_string_and_separate_address_columns(self):
        strings=b'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Obla</t></si></sst>'
        sheet=b'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>54</v></c></row></sheetData></worksheet>'
        blob=zip_blob({"xl/sharedStrings.xml":strings,"xl/worksheets/sheet1.xml":sheet})
        text,status=xlsx_text(blob)
        self.assertEqual(status,"XLSX_TEXT_OK")
        self.assertIn("Obla 54",text)
    def test_xlsx_inline(self):
        sheet=b'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c t="inlineStr"><is><t>Vinohradska</t></is></c><c><v>78</v></c></row></sheetData></worksheet>'
        text,status=xlsx_text(zip_blob({"xl/worksheets/sheet1.xml":sheet}))
        self.assertIn("Vinohradska 78",text)
        self.assertEqual(status,"XLSX_TEXT_OK")
    def test_aggregate_only_no_raw_pdf_or_personal_contact(self):
        doc=b'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Obecni 27, kontakt soukromou osobu Jaroslav</w:t></w:r></w:p></w:body></w:document>'
        outer=zip_blob({"subdir/some-name.docx":zip_blob({"word/document.xml":doc}),
                        "nonsensical.xls":b"my secret user email xxx@example.com",
                        "folder/":b""})
        r=inspect_official_zip(outer,location_extractor=extract_property_strings)
        self.assertEqual(r["attachment_count"],2)
        self.assertEqual(r["file_types"],{".docx":1,".xls":1})
        self.assertEqual(r["location_hints"][0].lower().endswith("obecni 27"),True)
        self.assertNotIn("Jaroslav",str(r))
        self.assertNotIn("xxx@example",str(r))
        self.assertFalse(r["available_now_verified"])
    def test_risky_filename_extension_unknown(self):
        self.assertEqual(file_extension("../xx.exe"),"other")
        self.assertEqual(file_extension("a.xlsm"),"other")
        self.assertEqual(extract_text(b"abc","other")[1],"UNSUPPORTED_ATTACHMENT_TYPE")
    def test_bomb_guard(self):
        outer=zip_blob({"big.txt":b"a"*7_500_000})
        r=inspect_official_zip(outer,location_extractor=extract_property_strings)
        self.assertEqual(r["status"],"ZIP_TOO_MANY_FILES_OR_UNCOMPRESSED_BYTES")
    def test_broken_office_doc_fails_closed(self):
        text,status=docx_text(b"not a docx")
        self.assertEqual(text,"")
        self.assertEqual(status,"DOCX_UNREADABLE")
    def test_bad_archive(self):
        self.assertEqual(inspect_official_zip(b"garbage")["status"],"ZIP_CORRUPT_OR_UNREADABLE")
    def test_no_unverified_legal_title(self):
        r=inspect_official_zip(zip_blob({"test.txt":b"Libusino udoli 152"}),location_extractor=extract_property_strings)
        self.assertFalse(r["free_five_years_legally_verified"])

if __name__=="__main__":
    unittest.main()
