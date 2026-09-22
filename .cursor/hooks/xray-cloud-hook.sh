#!/bin/sh
# Cloud-safe Cursor hook runner. Command in hooks.json must be a relative path.
# Do not put env-assignment in hooks.json — Cloud execs argv[0] without a shell.
set -eu

EVENT="${1:-preToolUse}"
JS="${2:-pre-tool-use.js}"
MILL=""
REL=""

pick_mill() {
  mill="$1"
  rel="$2"
  if [ -f "${mill}/${rel}" ]; then
    MILL="$mill"
    REL="$rel"
    return 0
  fi
  return 1
}

if [ -n "${XRAY_AI_PATH:-}" ]; then
  pick_mill "${XRAY_AI_PATH}" "src/integrations/cursor/hooks/${JS}" || \
    pick_mill "${XRAY_AI_PATH}" "dist/integrations/cursor/hooks/${JS}" || true
fi
if [ -z "$MILL" ]; then
  pick_mill "$(pwd)" "src/integrations/cursor/hooks/${JS}" || \
    pick_mill "$(pwd)/../xray" "src/integrations/cursor/hooks/${JS}" || \
    pick_mill "$(pwd)/node_modules/0xray" "dist/integrations/cursor/hooks/${JS}" || \
    pick_mill "$(pwd)/node_modules/0xray" "src/integrations/cursor/hooks/${JS}" || true
fi

if [ -n "$MILL" ] && [ -d "$MILL" ]; then
  MILL="$(cd "$MILL" && pwd)"
fi

NODE_BIN="$(command -v node 2>/dev/null || true)"

log_invoke() {
  dest="$1"
  mkdir -p "${dest}/.xray/state" 2>/dev/null || true
  {
    printf 'ts=%s event=%s cwd=%s mill=%s node=%s\n' \
      "$(date -Iseconds)" "$EVENT" "$(pwd)" "${MILL:-MISSING}" "${NODE_BIN:-MISSING}"
  } >> "${dest}/.xray/state/cursor-hook-invoke.log" 2>/dev/null || true
}

log_invoke "$(pwd)"
if [ -n "$MILL" ]; then
  log_invoke "$MILL"
fi

if [ -z "$NODE_BIN" ] || [ -z "$MILL" ] || [ ! -f "${MILL}/${REL}" ]; then
  printf '{"permission":"allow","user_message":"xray-cloud-hook: mill missing — fail open"}\n'
  exit 0
fi

export XRAY_HOOK_EVENT="$EVENT"
export XRAY_AI_PATH="$MILL"
export XRAY_ROOT="$MILL"
exec "$NODE_BIN" "${MILL}/${REL}"
