-- Run after the 2026-11-27 cart JWT migrations. No business rows are created.
DO $qa$
DECLARE
  target record;
  oid_target oid;
  guard_role text;
  should_pass boolean;
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
    BEGIN
      PERFORM public.imperion_rsvp_cart_create('{}'::jsonb,'[]'::jsonb);
      RAISE EXCEPTION 'QA unexpected create result';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> CASE WHEN should_pass THEN 'invalid_cart_size' ELSE 'not_authorized' END THEN RAISE; END IF;
    END;
    BEGIN
      IF public.imperion_rsvp_cart_record_proof(NULL::uuid,NULL::text,NULL::text,NULL::text,NULL::text[]) IS DISTINCT FROM false OR NOT should_pass THEN
        RAISE EXCEPTION 'QA unexpected proof result';
      END IF;
    EXCEPTION WHEN raise_exception THEN
      IF should_pass OR SQLERRM <> 'not_authorized' THEN RAISE; END IF;
    END;
    BEGIN
      IF public.imperion_rsvp_cart_verify_credit(NULL::uuid,NULL::integer,NULL::text) IS DISTINCT FROM false OR NOT should_pass THEN
        RAISE EXCEPTION 'QA unexpected credit result';
      END IF;
    EXCEPTION WHEN raise_exception THEN
      IF should_pass OR SQLERRM <> 'not_authorized' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$qa$;
