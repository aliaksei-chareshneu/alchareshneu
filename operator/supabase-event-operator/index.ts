import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzKdIEwIF4gH9Cku3IQPC8uTrvR1CtHjMAOIzexrR3Mz9nDSLQ1znfT8Y2SS873jCtsLg/exec";
const WORKER = "supabase-event-operator";

const dbHeaders = {
  "apikey": SERVICE_ROLE_KEY,
  "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json"
};

async function rpc(name: string, body: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: dbHeaders,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`RPC ${name} HTTP ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function patchCommand(id: string, patch: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/operator_commands?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { ...dbHeaders, "Prefer": "return=minimal" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`PATCH command HTTP ${res.status}: ${(await res.text()).slice(0, 500)}`);
}

async function logEvent(commandId: string, eventType: string, detail: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/operator_command_events`, {
    method: "POST",
    headers: { ...dbHeaders, "Prefer": "return=minimal" },
    body: JSON.stringify({ command_id: commandId, event_type: eventType, detail }),
  });
  if (!res.ok) console.error("event log failed", res.status, await res.text());
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callAppsScript(commandId: string, token: string) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({
      kind: "operator.command",
      commandId,
      capabilityToken: token,
    }),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); }
  catch { throw new Error(`Apps Script invalid JSON HTTP ${res.status}: ${text.slice(0, 500)}`); }
  if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}: ${text.slice(0, 500)}`);
  return data;
}

async function verifyCapabilityRequest(req: Request) {
  let body: any;
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  const commandId = String(body?.commandId || "");
  const capabilityToken = String(body?.capabilityToken || "");
  if (!commandId || !capabilityToken) return new Response("Forbidden", { status: 403 });

  const capabilityHash = await sha256Hex(capabilityToken);
  const now = encodeURIComponent(new Date().toISOString());
  const url =
    `${SUPABASE_URL}/rest/v1/operator_commands` +
    `?id=eq.${encodeURIComponent(commandId)}` +
    `&state=eq.claimed` +
    `&claimed_by=eq.${encodeURIComponent(WORKER)}` +
    `&lease_expires_at=gt.${now}` +
    `&capability_hash=eq.${capabilityHash}` +
    `&select=command,subject_id,payload,requires_owner_gate`;

  const res = await fetch(url, { headers: dbHeaders });
  if (!res.ok) return new Response("Forbidden", { status: 403 });
  const rows = await res.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return new Response("Forbidden", { status: 403 });

  const verified = {
    command: row.command,
    subjectId: row.subject_id,
    payload: row.payload || {},
    approved: row.payload?.approved === true,
    requiresOwnerGate: row.requires_owner_gate === true,
  };
  return new Response(JSON.stringify(verified), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST required", { status: 405 });

  if (new URL(req.url).pathname.endsWith("/verify")) {
    return verifyCapabilityRequest(req);
  }

  const triggerToken = req.headers.get("x-cron-token") || "";
  if (!triggerToken) return new Response("Unauthorized", { status: 401 });

  const processed: Array<Record<string, unknown>> = [];
  try {
    const triggerOk = await rpc("verify_operator_cron_token", { p_token: triggerToken });
    if (triggerOk !== true) return new Response("Forbidden", { status: 403 });

    await rpc("recover_operator_commands");

    for (let i = 0; i < 5; i++) {
      const capabilityToken = randomToken();
      const capabilityHash = await sha256Hex(capabilityToken);
      const job = await rpc("claim_operator_command", {
        p_worker: WORKER,
        p_capability_hash: capabilityHash,
      });
      if (!job?.id) break;

      await logEvent(job.id, "claimed", { worker: WORKER, attempt: job.attempts });

      try {
        const result = await callAppsScript(job.id, capabilityToken);
        const evidence = result?.evidence ? [result.evidence] : [];

        if (result?.waitingOwner) {
          await patchCommand(job.id, {
            state: "waiting_owner",
            result,
            evidence,
            error: result.error || null,
            capability_hash: null,
            lease_expires_at: null,
          });
          await logEvent(job.id, "waiting_owner", { result });
          processed.push({ id: job.id, state: "waiting_owner" });
          continue;
        }

        if (result?.ok) {
          await patchCommand(job.id, {
            state: "done",
            completed_at: new Date().toISOString(),
            result,
            evidence,
            error: null,
            capability_hash: null,
            lease_expires_at: null,
          });
          await logEvent(job.id, "done", { result });
          processed.push({ id: job.id, state: "done" });
          continue;
        }

        await patchCommand(job.id, {
          state: "error",
          completed_at: new Date().toISOString(),
          result,
          evidence,
          error: result?.error || "Apps Script returned ok=false",
          capability_hash: null,
          lease_expires_at: null,
        });
        await logEvent(job.id, "error", { result });
        processed.push({ id: job.id, state: "error", error: result?.error || "ok=false" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const retry = Number(job.attempts || 0) < Number(job.max_attempts || 3);
        await patchCommand(job.id, {
          state: retry ? "queued" : "error",
          completed_at: retry ? null : new Date().toISOString(),
          error: message,
          capability_hash: null,
          claimed_by: retry ? null : WORKER,
          claimed_at: retry ? null : job.claimed_at,
          lease_expires_at: null,
        });
        await logEvent(job.id, retry ? "retry" : "error", { error: message });
        processed.push({ id: job.id, state: retry ? "queued" : "error", error: message });
        if (retry) break;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return new Response(JSON.stringify({ ok: false, error: message, processed }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});