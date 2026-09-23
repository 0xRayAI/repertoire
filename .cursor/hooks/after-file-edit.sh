#!/bin/sh
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec /bin/sh "${HERE}/xray-cloud-hook.sh" afterFileEdit after-file-edit.js
