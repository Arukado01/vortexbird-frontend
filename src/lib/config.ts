const setting = (name: string, fallback: string) => window.__VORTEX_CONFIG__?.[name] ?? import.meta.env[name] ?? fallback;
export const usesCognito = setting('VITE_OIDC_PROVIDER', 'keycloak') === 'cognito';
export const config = {
  apiUrl: setting('VITE_API_BASE_URL', '/api/v1'),
  keycloakUrl: setting('VITE_KEYCLOAK_URL', 'http://localhost:8080'),
  realm: setting('VITE_KEYCLOAK_REALM', 'vortexbird'),
  clientId: setting('VITE_KEYCLOAK_CLIENT_ID', 'vortexbird-portal'),
  cognitoIssuer: setting('VITE_COGNITO_ISSUER', ''),
  cognitoClientId: setting('VITE_COGNITO_CLIENT_ID', ''),
  cognitoAuthorizationOrigin: setting('VITE_COGNITO_AUTHORIZATION_ORIGIN', ''),
  demoAuth: !usesCognito && setting('VITE_DEMO_AUTH', 'false') === 'true',
};
