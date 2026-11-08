#!/bin/sh
# No shell startup files or working-directory dependent environment are required.
LITERATURE_PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
if [ -f "$LITERATURE_PROJECT_DIR/config/node-path" ]; then
  IFS= read -r LITERATURE_NODE < "$LITERATURE_PROJECT_DIR/config/node-path"
else
  LITERATURE_NODE=$(command -v node)
fi
exec "$LITERATURE_NODE" "$LITERATURE_PROJECT_DIR/dist/server.js"
