DO $patch$
DECLARE
  target record;
  target_oid oid;
  original text;
  patched text;
  old_guard constant text := $old$coalesce(current_setting('request.jwt.claim.role',true),'')$old$;
  new_guard constant text := $new$coalesce(auth.jwt()->>'role','')$new$;
  original_acl aclitem[];
  original_owner oid;
  original_security_definer boolean;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('public.imperion_rsvp_cart_record_proof(uuid,text,text,text,text[])','912d68f3001aff1e2b7934eb9d5afc92','2145051972f1a83a14714f5a871399e6'),
    ('public.imperion_rsvp_cart_verify_credit(uuid,integer,text)','3f45dc7a1b3d1a53765028f97b6c677c','3703f43278eeac898810428941ffe508')
  ) AS t(signature,before_md5,after_md5) LOOP
    target_oid := target.signature::regprocedure;
    original := pg_get_functiondef(target_oid);
    IF md5(original) <> target.before_md5 OR
      (length(original)-length(replace(original,old_guard,'')))/length(old_guard) <> 1
    THEN RAISE EXCEPTION 'Unexpected baseline: %',target.signature; END IF;
    SELECT proacl,proowner,prosecdef INTO STRICT original_acl,original_owner,original_security_definer
      FROM pg_proc WHERE oid=target_oid;
    IF NOT original_security_definer OR
      has_function_privilege('anon',target_oid,'EXECUTE') OR
      has_function_privilege('authenticated',target_oid,'EXECUTE') OR
      NOT has_function_privilege('service_role',target_oid,'EXECUTE') OR
      EXISTS (SELECT 1 FROM aclexplode(coalesce(original_acl,acldefault('f',original_owner)))
              WHERE grantee=0 AND privilege_type='EXECUTE')
    THEN RAISE EXCEPTION 'Unexpected security baseline: %',target.signature; END IF;
    patched := replace(original,old_guard,new_guard);
    IF md5(patched) <> target.after_md5 THEN RAISE EXCEPTION 'Unexpected candidate: %',target.signature; END IF;
    EXECUTE patched;
    IF md5(pg_get_functiondef(target_oid)) <> target.after_md5 OR
      EXISTS (SELECT 1 FROM pg_proc WHERE oid=target_oid AND
         (proacl IS DISTINCT FROM original_acl OR proowner IS DISTINCT FROM original_owner OR
          prosecdef IS DISTINCT FROM original_security_definer))
    THEN RAISE EXCEPTION 'Readback differs: %',target.signature; END IF;
  END LOOP;
END;
$patch$;
