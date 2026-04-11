// Production environment. The frontend and backend share a host in production
// (served by the same Nginx reverse proxy), so apiUrl is a relative path —
// requests to /api/... hit the nginx `location /api/` block which forwards them
// to the backend container. No hardcoded hostname means the build is portable
// across any domain (staging, prod, preview).
export const environment = {
  production: true,
  apiUrl: '/api',
};
