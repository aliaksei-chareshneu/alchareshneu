-- Run after the 2026-11-27 cart JWT migrations. No business rows are created.
DO $qa$
DECLARE
  target record;
  oid_target oid;
  guard_role text;
  should_pass boolean;
  create_error text;
  proof_error text;
  credit_error text;
  proof_result boolean;
  credit_result boolean;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('public.imperion_rsvp_cart_create(jsonb,jsonb)'),
    ('public.imperion_rsvp_cart_record_proof(uuid,text,text,text,text[])'),
    ('public.imperion_rsvp_cart_verify_credit(uuid,integer,text)')
  ) AS t(signature) LOOP
    oid_target := target.signature::regprocedure;
    IF position('request.jwt.claim.role' in pg_get_functiondef(oid_target))>0
      OR position('auth.jwt()' in pg_get_functiondef(oid_target))=0
      OR has_function_privilege('anon',oid_target,'EXECUTE')
      OR has_function_privilege('authenticated',oid_target,'EXECUTE')
      OR NOT has_function_privilege('service_role',oid_target,'EXECUTE')
      OR EXISTS (SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE p.oid=oid_target AND a.grantee=0 AND a.privilege_type='EXECUTE')
    THEN RAISE EXCEPTION 'JWT or ACL regression: %', target.signature; END IF;
  END LOOP;
  PERFORM set_config('request.jwt.claim','',true);
  PERFORM set_config('request.jwt.claim.role','',true);
  FOREACH guard_role IN ARRAY ARRAY['anon','authenticated','','service_role'] LOOP
    should_pass := guard_role='service_role';
    PERFORM set_config('request.jwt.claims',CASE WHEN guard_role='' THEN '{}' ELSE jsonb_build_object('role',guard_role)::text END,true);
    create_error := NULL;
    proof_error := NULL;
    credit_error := NULL;
    proof_result := NULL;
    credit_result := NULL;
    BEGIN
      PERFORM public.imperion_rsvp_cart_create('{}'::jsonb,'[]'::jsonb);
    EXCEPTION WHEN raise_exception THEN
      create_error := SQLERRM;
    END;
    IF create_error IS DISTINCT FROM (CASE WHEN should_pass THEN 'invalid_cart_size' ELSE 'not_authorized' END)
    THEN RAISE EXCEPTION 'QA unexpected create result: % / %', guard_role, create_error; END IF;
    BEGIN
      proof_result := public.imperion_rsvp_cart_record_proof(NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::text[]);
    EXCEPTION WHEN raise_exception THEN
      proof_error := SQLERRM;
    END;
    IF (should_pass AND (proof_result IS DISTINCT FROM false OR proof_error IS NOT NULL))
      OR (NOT should_pass AND proof_error IS DISTINCT FROM 'not_authorized')
    THEN RAISE EXCEPTION 'QA unexpected proof result: % / % / %', guard_role, proof_result, proof_error; END IF;
    BEGIN
      credit_result := public.imperion_rsvp_cart_verify_credit(NULL::uuid,NULL::integer,NULL::text);
    EXCEPTION WHEN raise_exception THEN
      credit_error := SQLERRM;
    END;
    IF (should_pass AND (credit_result IS DISTINCT FROM false OR credit_error IS NOT NULL))
      OR (NOT should_pass AND credit_error IS DISTINCT FROM 'not_authorized')
    THEN RAISE EXCEPTION 'QA unexpected credit result: % / % / %', guard_role, credit_result, credit_error; END IF;
  END LOOP;
END;
$qa$;
