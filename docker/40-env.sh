#!/bin/sh
set -eu

cat > /usr/share/nginx/html/env-config.js <<EOF
window.__ENV__ = Object.assign({}, window.__ENV__, {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_API_KEY: "${VITE_API_KEY:-}"
});
EOF
