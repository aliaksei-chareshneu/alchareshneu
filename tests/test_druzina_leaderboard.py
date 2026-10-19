import importlib.util
import pathlib
import unittest
from datetime import date
SCRIPT=pathlib.Path(__file__).resolve().parents[1]/"scripts"/"druzina_leaderboard_export.py"
SPEC=importlib.util.spec_from_file_location("druzina_board",SCRIPT)
dm=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(dm)
TODAY=date(2026,10,19)
def profile(mid="adult1",name="Shield Bearer",minor=False, opt=True, revoked=False):
    return {"Member_ID":mid,"Display_Name":name,"Age_Class":"MINOR" if minor else "ADULT",
      "Name_Opt_In":"TRUE" if opt else "FALSE","Stats_Opt_In":"TRUE",
      "Awards_Opt_In":"TRUE","Photo_Opt_In":"FALSE","Consent_Evidence_Ref":"PRIVATE_RECORD_REFERENCE",
      "Consent_Checked_At":"2026-10-18","Approved_By":"OWNER","Approved_At":"2026-10-18",
      "Consent_Revoked_At":"2026-10-18" if revoked else "","Visibility_Status":"PUBLIC_APPROVED"}
def row(i,typ="TRAINING",member="adult1",day="2026-10-17",track="",minutes="0",approved=True):
    return {"Record_ID":f"R{i}","Member_ID":member,"Event_ID":f"E{i}","Event_Date":day,
      "Event_Type":typ,"Track":track,"Volunteer_Minutes":minutes,
      "Verification":"VERIFIED","Proof_Ref":"internal-proof",
      "Verified_By":"staff","Verified_At":"2026-10-18",
      "Source_System":"club","Approved_For_Count":"TRUE" if approved else "FALSE",
      "Unique_Key":f"event-record-{i}"}
class ExportSecurityTest(unittest.TestCase):
    def test_initially_empty(self):
        res,stats=dm.build([],[],today=TODAY)
        self.assertTrue(all(not v for v in res["categories"].values()))
        self.assertEqual(stats["profiles_eligible"],0)
    def test_only_approved_adults_with_verified_events(self):
        people=[profile(),profile("minor1","Hidden Child",minor=True),profile("optout1","Hidden Adult",opt=False),profile("revoked1","Former Member",revoked=True)]
        events=[
          row(1),row(2,"ARCHERY",track="ARCHERY"),
          row(3,"BATTLE"),row(4,"VOLUNTEER",minutes="65"),
          row(5,"MENTOR"),
          row(6,"TRAINING",member="minor1"),
          row(7,"TRAINING",member="optout1"),
          row(8,"BATTLE",member="revoked1"),
          row(9,"BATTLE",approved=False),row(10,"TRAINING",day="2026-10-23")]
        res,stats=dm.build(people,events,today=TODAY)
        self.assertEqual(stats["profiles_eligible"],1)
        self.assertEqual(res["categories"]["training"][0]["count"],2)
        self.assertEqual(res["categories"]["battles"][0]["count"],1)
        self.assertEqual(res["categories"]["archery"][0]["count"],1)
        self.assertEqual(res["categories"]["volunteer"][0]["count"],65)
        self.assertEqual(res["categories"]["mentor"][0]["count"],1)
        self.assertEqual(res["categories"]["consistency"][0]["count"],1)
        serialized=str(res)
        for bad in ("Hidden Child","Hidden Adult","Former Member","PRIVATE_RECORD_REFERENCE","adult1","staff","internal-proof"):
            self.assertNotIn(bad,serialized)
    def test_dedupes_event_and_rejects_unverified(self):
        e=row(10)
        dup={**e,"Record_ID":"different","Unique_Key":"different_key"}
        unverified={**row(11),"Verification":"PENDING"}
        res,stats=dm.build([profile()],[e,dup,unverified],today=TODAY)
        self.assertEqual(res["categories"]["training"][0]["count"],1)
        self.assertEqual(stats["records_verified"],1)
    def test_photo_requires_separate_opt_in_and_safe_local_path(self):
        p=profile();p["Photo_Opt_In"]="TRUE";p["Approved_Photo_Path"]="https://other.example/photo.jpg";p["Portrait_Alt"]="portrait"
        res,_=dm.build([p],[row(1)],today=TODAY)
        self.assertIsNone(res["categories"]["training"][0]["photo_path"])
        p["Approved_Photo_Path"]="images/portraits/adult-member.webp"
        res,_=dm.build([p],[row(1)],today=TODAY)
        self.assertEqual(res["categories"]["training"][0]["photo_path"],"images/portraits/adult-member.webp")
    def test_expires_or_revoked_block_all_public_output(self):
        p=profile();p["Consent_Expires_At"]="2026-10-18"
        res,_=dm.build([p],[row(1)],today=TODAY)
        self.assertFalse(res["categories"]["training"])
        p["Consent_Expires_At"]=""
        p["Consent_Revoked_At"]="2026-10-19"
        res,_=dm.build([p],[row(1)],today=TODAY)
        self.assertFalse(res["categories"]["training"])
    def test_month_is_distinct_from_verified_all_time(self):
        historical=row(20,day="2026-09-30")
        current=row(21,day="2026-10-17")
        result,stats=dm.build([profile()],[historical,current],today=TODAY)
        self.assertEqual(result["version"],2)
        self.assertEqual(result["categories"]["training"][0]["count"],1)
        self.assertEqual(result["all_time_categories"]["training"][0]["count"],2)
        self.assertEqual(stats["records_verified"],2)
        self.assertEqual(stats["period_records_verified"],1)
    def test_training_archery_alias_same_session_counted_once(self):
        original=row(10,typ="TRAINING",track="ARCHERY")
        double={**row(11,typ="ARCHERY",track="ARCHERY"),"Event_ID":original["Event_ID"]}
        result,_=dm.build([profile()],[original,double],today=TODAY)
        self.assertEqual(result["categories"]["training"][0]["count"],1)
        self.assertEqual(result["categories"]["archery"][0]["count"],1)
    def test_profile_duplicates_are_private_until_reconciled(self):
        active=profile()
        old={**active,"Consent_Revoked_At":"2026-10-19"}
        result,_=dm.build([active,old],[row(1)],today=TODAY)
        self.assertFalse(result["categories"]["training"])
        self.assertFalse(result["all_time_categories"]["training"])
    def test_verification_cannot_precede_activity(self):
        suspicious=row(40)
        suspicious["Verified_At"]="2026-10-16"
        result,_=dm.build([profile()],[suspicious],today=TODAY)
        self.assertFalse(result["categories"]["training"])
    def test_skills_only_after_instructor_pass_and_activated_catalog(self):
        catalog=[{"Checkpoint_ID":"AR1-01","Track_ID":"ARCHERY","Tier":"1","Status":"DRAFT"}]
        check={"Check_ID":"CHK1","Member_ID":"adult1","Track_ID":"ARCHERY",
               "Tier":"1","Checkpoint_ID":"AR1-01","Session_ID":"SESS1",
               "Demonstrated_On":"2026-10-17","Instructor_Ref":"coach",
               "Safety_Verified":"TRUE","Skill_Verified":"TRUE",
               "Assessment_Status":"PASSED","Verified_At":"2026-10-18",
               "Evidence_Ref":"PRIVATE_PROOF"}
        result,_=dm.build([profile()],[],today=TODAY,skill_checks=[check],catalog=catalog)
        self.assertFalse(result["categories"]["skills"])
        catalog[0]["Status"]="ACTIVE"
        result,_=dm.build([profile()],[],today=TODAY,skill_checks=[check],catalog=catalog)
        self.assertEqual(result["categories"]["skills"][0]["count"],1)
        self.assertEqual(result["all_time_categories"]["skills"][0]["count"],1)
        self.assertNotIn("PRIVATE_PROOF",str(result))
        revoked={**check,"Check_ID":"CHK2","Assessment_Status":"REVOKED",
                 "Verified_At":"2026-10-19"}
        result,_=dm.build([profile()],[],today=TODAY,skill_checks=[check,revoked],catalog=catalog)
        self.assertFalse(result["categories"]["skills"])
    def test_skill_retake_does_not_create_second_milestone(self):
        cat=[{"Checkpoint_ID":"AR1-01","Track_ID":"ARCHERY","Tier":"1","Status":"ACTIVE"}]
        old={"Check_ID":"C1","Member_ID":"adult1","Track_ID":"ARCHERY","Tier":"1",
             "Checkpoint_ID":"AR1-01","Session_ID":"S1","Demonstrated_On":"2026-09-18",
             "Instructor_Ref":"coach","Safety_Verified":"TRUE","Skill_Verified":"TRUE",
             "Assessment_Status":"PASSED","Verified_At":"2026-09-20","Evidence_Ref":"private"}
        retake={**old,"Check_ID":"C2","Session_ID":"S2","Demonstrated_On":"2026-10-17",
                "Verified_At":"2026-10-18"}
        result,_=dm.build([profile()],[],today=TODAY,skill_checks=[old,retake],catalog=cat)
        self.assertFalse(result["categories"]["skills"])
        self.assertEqual(result["all_time_categories"]["skills"][0]["count"],1)
    def test_existing_pesak_internal_status_never_grants_public_skill(self):
        module={"Module_ID":"PESAK-05","Status":"APPROVED_INTERNAL_NOT_PUBLIC"}
        check={"Progress_ID":"P5","Member_ID":"adult1","Module_ID":"PESAK-05",
               "Session_ID":"S99","Training_Date":"2026-10-17",
               "Instructor_Ref":"coach","Attendance_Verified":"TRUE",
               "Safety_Verified":"TRUE","Skill_Verified":"TRUE",
               "Module_Status":"PASSED","Checked_At":"2026-10-18",
               "Evidence_Ref":"private-module-proof"}
        kw={"today":TODAY,"pesak_checks":[check,check],"pesak_modules":[module]}
        data,_=dm.build([profile()],[],**kw)
        self.assertFalse(data["categories"]["skills"])
        module["Status"]="PUBLIC_APPROVED"
        data,_=dm.build([profile()],[],**kw)
        self.assertEqual(data["categories"]["skills"][0]["count"],1)
        self.assertNotIn("private-module-proof",str(data))
    def test_pesak_skill_without_attendance_safety_instructor_is_excluded(self):
        modules=[{"Module_ID":"PESAK-01","Status":"PUBLIC_APPROVED"}]
        bad={"Progress_ID":"P1","Member_ID":"adult1","Module_ID":"PESAK-01",
             "Session_ID":"S1","Training_Date":"2026-10-17",
             "Instructor_Ref":"coach","Attendance_Verified":"FALSE",
             "Safety_Verified":"TRUE","Skill_Verified":"TRUE",
             "Module_Status":"PASSED","Checked_At":"2026-10-18",
             "Evidence_Ref":"private-proof"}
        result,_=dm.build([profile()],[],today=TODAY,pesak_checks=[bad],pesak_modules=modules)
        self.assertFalse(result["categories"]["skills"])
    def test_archery_and_training_alias_are_order_independent(self):
        normal=row(50,typ="TRAINING")
        bow={**row(51,typ="ARCHERY",track="ARCHERY"),"Event_ID":normal["Event_ID"]}
        for rows in ([normal,bow],[bow,normal]):
            result,_=dm.build([profile()],rows,today=TODAY)
            self.assertEqual(result["categories"]["training"][0]["count"],1)
            self.assertEqual(result["categories"]["archery"][0]["count"],1)
if __name__=="__main__":unittest.main()
