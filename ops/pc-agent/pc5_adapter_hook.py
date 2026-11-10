"""Small review-only Agent5 route extension. Not installed by this PR.

In the existing browser_bridge_adapter.dispatch, invoke maybe_dispatch(action, payload)
BEFORE the legacy pc_operator branch. The existing authenticated Browser Bridge
and Supabase browser_jobs queue remain the sole queue/agent. Do not create a
new listener, service or process. No arbitrary shell payload is accepted.
"""
from pc5_maintenance import operate


PC5_MODES = frozenset({"audit_pc"})  # remediate_pc explicitly not installed


def maybe_dispatch(action, payload):
    if action != "pc_operator" or not isinstance(payload, dict):
        return None
    if payload.get("mode") not in PC5_MODES:
        return None
    return {
        "agent": "IMPERION_AGENT5_RESTRICTED",
        "requested": "pc_operator",
        "result": operate(payload),
    }