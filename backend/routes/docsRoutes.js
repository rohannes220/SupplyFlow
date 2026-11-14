import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Public API documentation (#14): the OpenAPI JSON at /api/docs.json and Swagger UI at
 * /api/docs/ (/api/docs redirects there so the page's relative asset URLs resolve).
 * Every URL is relative or path-only, so the docs also work through the Vercel /api rewrite.
 * Mount at /api.
 */
export function createDocsRoutes(spec) {
  const router = Router();

  /**
   * @openapi
   * /api/docs.json:
   *   get:
   *     tags: [Docs]
   *     summary: This OpenAPI document (no login needed); Swagger UI is at /api/docs
   *     responses:
   *       200: { description: OpenAPI 3 document, content: { application/json: { schema: { type: object } } } }
   */
  router.get('/docs.json', (_req, res) => {
    res.json(spec);
  });

  // serveFiles (not serve) keeps this app's spec in its own init script instead of the
  // module-wide one swagger-ui-express shares between apps.
  router.use(
    '/docs',
    swaggerUi.serveFiles(spec),
    swaggerUi.setup(spec, { customSiteTitle: 'SupplyFlow API docs' }),
  );

  return router;
}
