#!/bin/sh
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec /bin/sh "${HERE}/xray-cloud-hook.sh" preToolUse pre-tool-use.js
