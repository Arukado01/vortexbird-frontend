#!/bin/sh
set -eu
: "${VITE_API_BASE_URL:=/api/v1}"
: "${VITE_KEYCLOAK_URL:=http://localhost:8080}"
: "${VITE_KEYCLOAK_REALM:=vortexbird}"
: "${VITE_KEYCLOAK_CLIENT_ID:=vortexbird-portal}"
: "${VITE_DEMO_AUTH:=false}"
# Public runtime values only. A restricted alphabet prevents executable JS injection.
for value in "$VITE_API_BASE_URL" "$VITE_KEYCLOAK_URL" "$VITE_KEYCLOAK_REALM" "$VITE_KEYCLOAK_CLIENT_ID" "$VITE_DEMO_AUTH"; do
  case "$value" in *[!a-zA-Z0-9_./:\-]*) echo 'Invalid public runtime configuration' >&2; exit 1;; esac
done
printf 'window.__VORTEX_CONFIG__ = {"VITE_API_BASE_URL":"%s","VITE_KEYCLOAK_URL":"%s","VITE_KEYCLOAK_REALM":"%s","VITE_KEYCLOAK_CLIENT_ID":"%s","VITE_DEMO_AUTH":"%s"};\n' "$VITE_API_BASE_URL" "$VITE_KEYCLOAK_URL" "$VITE_KEYCLOAK_REALM" "$VITE_KEYCLOAK_CLIENT_ID" "$VITE_DEMO_AUTH" > /tmp/config.js
exec nginx -g 'daemon off;'
