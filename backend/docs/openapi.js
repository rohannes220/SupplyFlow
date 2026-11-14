// Builds the OpenAPI 3 document from the @openapi JSDoc comments in app.js and routes/*.js.
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const backendDir = dirname(dirname(fileURLToPath(import.meta.url)));

// Absolute paths so the spec builds no matter which directory the server starts from
// (Render runs `node backend/server.js` from the repository root). swagger-jsdoc passes these
// through glob, which needs forward slashes on Windows.
function annotatedFiles() {
  const routesDir = join(backendDir, 'routes');
  return [
    join(backendDir, 'app.js'),
    ...readdirSync(routesDir)
      .filter((file) => file.endsWith('.js'))
      .map((file) => join(routesDir, file)),
  ].map((file) => file.replaceAll('\\', '/'));
}

let cachedSpec;

/** Returns the OpenAPI document, parsing the comments once per process. */
export function getOpenApiSpec() {
  cachedSpec ??= swaggerJsdoc({
    failOnErrors: true,
    definition: {
      openapi: '3.0.3',
      info: {
        title: 'SupplyFlow API',
        version: '1.0.0',
        description:
          'Supply chain API for vendors, purchase orders and the dashboard. Log in with ' +
          'POST /api/auth/login, then use Authorize with the returned token.',
      },
      // No `servers`: Swagger UI then calls the API on the page's own origin, which works
      // locally and through the Vercel /api rewrite in production.
      tags: [
        { name: 'Health' },
        { name: 'Auth' },
        { name: 'Vendors' },
        { name: 'Orders' },
        { name: 'Dashboard' },
        { name: 'Docs' },
      ],
    },
    apis: annotatedFiles(),
  });
  return cachedSpec;
}
