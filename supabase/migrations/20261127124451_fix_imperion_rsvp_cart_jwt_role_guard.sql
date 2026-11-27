DO $patch$
DECLARE
  target_oid oid := 'public.imperion_rsvp_cart_create(jsonb,jsonb)'::regprocedure;
  original text := pg_get_functiondef(target_oid);
  old_guard constant text := $old$IF coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' THEN$old$;
  new_guard constant text := $new$IF coalesce(auth.jwt()->>'role','') <> 'service_role' THEN$new$;
  expected_old constant text := '46da7ae861ede6d347728436d25abcb9';
  expected_new constant text := '6a56f72bb8a352eff45437a4c7fa6853';
  patched text;
  original_acl aclitem[];
  original_owner oid;
  original_security_definer boolean;
BEGIN
  IF md5(original) <> expected_old THEN
    RAISE EXCEPTION 'Baseline changed: stop and review, no changes applied';
  END IF;
  IF (length(original)-length(replace(original,old_guard,'')))/length(old_guard) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one old authorization guard';
  END IF;
  SELECT proacl, proowner, prosecdef INTO STRICT original_acl, original_owner, original_security_definer
    FROM pg_proc WHERE oid=target_oid;
  IF NOT original_security_definer OR
     has_function_privilege('anon',target_oid,'EXECUTE') OR
     has_function_privilege('authenticated',target_oid,'EXECUTE') OR
     NOT has_function_privilege('service_role',target_oid,'EXECUTE') OR
     EXISTS (SELECT 1 FROM aclexplode(coalesce(original_acl,acldefault('f',original_owner)))
             WHERE grantee=0 AND privilege_type='EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected authorization or ACL baseline';
  END IF;
  patched := replace(original,old_guard,new_guard);
  IF md5(patched) <> expected_new THEN RAISE EXCEPTION 'Unexpected candidate hash'; END IF;
  EXECUTE patched;
  IF md5(pg_get_functiondef(target_oid)) <> expected_new OR
     EXISTS (SELECT 1 FROM pg_proc WHERE oid=target_oid AND
       (proacl IS DISTINCT FROM original_acl OR proowner IS DISTINCT FROM original_owner OR
        prosecdef IS DISTINCT FROM original_security_definer)) THEN
    RAISE EXCEPTION 'Readback differs: transaction aborted';
  END IF;
END;
$patch$;
