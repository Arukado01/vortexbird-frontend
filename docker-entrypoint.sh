#!/bin/sh
set -eu
: "${PORT:=8080}"
: "${VITE_API_BASE_URL:=/api/v1}"
: "${VITE_OIDC_PROVIDER:=keycloak}"
: "${VITE_KEYCLOAK_URL:=http://localhost:8080}"
: "${VITE_KEYCLOAK_REALM:=vortexbird}"
: "${VITE_KEYCLOAK_CLIENT_ID:=vortexbird-portal}"
: "${VITE_COGNITO_ISSUER:=}"
: "${VITE_COGNITO_CLIENT_ID:=}"
: "${VITE_COGNITO_AUTHORIZATION_ORIGIN:=}"
: "${VITE_DEMO_AUTH:=false}"
: "${API_PROXY_ENABLED:=true}"

case "$PORT" in
  *[!0-9]*|??????*) echo 'Invalid HTTP port' >&2; exit 1;;
esac
if [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo 'Invalid HTTP port' >&2; exit 1
fi

case "$VITE_OIDC_PROVIDER" in
  keycloak) ;;
  cognito)
    if [ -z "$VITE_COGNITO_ISSUER" ] || [ -z "$VITE_COGNITO_CLIENT_ID" ] || [ -z "$VITE_COGNITO_AUTHORIZATION_ORIGIN" ]; then
      echo 'Missing public Cognito configuration' >&2; exit 1
    fi
    if [ "$API_PROXY_ENABLED" = false ]; then
      case "$VITE_API_BASE_URL" in
        https://*) ;;
        *) echo 'Cognito requires an HTTPS API URL without the local proxy' >&2; exit 1;;
      esac
    fi ;;
  *) echo 'Invalid identity provider' >&2; exit 1;;
esac

# Public runtime values only. A restricted alphabet prevents executable JS injection.
for value in "$VITE_API_BASE_URL" "$VITE_OIDC_PROVIDER" "$VITE_KEYCLOAK_URL" "$VITE_KEYCLOAK_REALM" \
  "$VITE_KEYCLOAK_CLIENT_ID" "$VITE_COGNITO_ISSUER" "$VITE_COGNITO_CLIENT_ID" \
  "$VITE_COGNITO_AUTHORIZATION_ORIGIN" "$VITE_DEMO_AUTH"; do
  case "$value" in *[!a-zA-Z0-9_./:\-]*) echo 'Invalid public runtime configuration' >&2; exit 1;; esac
done
printf 'window.__VORTEX_CONFIG__ = {"VITE_API_BASE_URL":"%s","VITE_OIDC_PROVIDER":"%s","VITE_KEYCLOAK_URL":"%s","VITE_KEYCLOAK_REALM":"%s","VITE_KEYCLOAK_CLIENT_ID":"%s","VITE_COGNITO_ISSUER":"%s","VITE_COGNITO_CLIENT_ID":"%s","VITE_COGNITO_AUTHORIZATION_ORIGIN":"%s","VITE_DEMO_AUTH":"%s"};\n' \
  "$VITE_API_BASE_URL" "$VITE_OIDC_PROVIDER" "$VITE_KEYCLOAK_URL" "$VITE_KEYCLOAK_REALM" \
  "$VITE_KEYCLOAK_CLIENT_ID" "$VITE_COGNITO_ISSUER" "$VITE_COGNITO_CLIENT_ID" \
  "$VITE_COGNITO_AUTHORIZATION_ORIGIN" "$VITE_DEMO_AUTH" > /tmp/config.js

printf 'listen 0.0.0.0:%s;\nlisten [::]:%s;\n' "$PORT" "$PORT" > /tmp/vortexbird-listen.conf
case "$API_PROXY_ENABLED" in
  true) cp /etc/nginx/vortexbird-api-proxy.conf /tmp/vortexbird-api.conf ;;
  false) printf '%s\n' 'location /api/ { return 404; }' > /tmp/vortexbird-api.conf ;;
  *) echo 'Invalid API proxy configuration' >&2; exit 1 ;;
esac
exec nginx -g 'daemon off;'
