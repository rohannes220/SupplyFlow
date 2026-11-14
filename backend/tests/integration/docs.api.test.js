// Issue #14: the OpenAPI spec (built from the @openapi comments) and Swagger UI are public.
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { createInMemoryOrderModel } from '../helpers/inMemoryOrderModel.js';
import { createInMemoryVendorModel } from '../helpers/inMemoryVendorModel.js';
import { createInMemoryDashboardModel } from '../helpers/inMemoryDashboardModel.js';
import { createInMemoryUserModel, TEST_JWT_SECRET } from '../helpers/inMemoryUserModel.js';

function buildApp() {
  const orderModel = createInMemoryOrderModel();
  const vendorModel = createInMemoryVendorModel();
  return createApp({
    orderModel,
    vendorModel,
    dashboardModel: createInMemoryDashboardModel({ orderModel, vendorModel }),
    userModel: createInMemoryUserModel(),
    jwtSecret: TEST_JWT_SECRET,
  });
}

// Every route registered in backend/app.js and backend/routes/*.js, as [OpenAPI path, method].
const PUBLIC_OPERATIONS = [
  ['/api/health', 'get'],
  ['/api/auth/login', 'post'],
  ['/api/auth/register', 'post'],
];
const PROTECTED_OPERATIONS = [
  ['/api/auth/me', 'get'],
  ['/api/users', 'get'],
  ['/api/vendors', 'get'],
  ['/api/vendors', 'post'],
  ['/api/vendors/{id}', 'get'],
  ['/api/vendors/{id}', 'put'],
  ['/api/dashboard', 'get'],
  ['/api/orders', 'get'],
  ['/api/orders', 'post'],
  ['/api/orders/{id}', 'get'],
  ['/api/orders/{id}', 'put'],
  ['/api/orders/{id}', 'delete'],
  ['/api/orders/{id}/status', 'patch'],
];

// Collects every "$ref" string anywhere in the spec.
function collectRefs(node, refs = []) {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, refs));
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

describe('GET /api/docs.json', () => {
  let app;
  let res;
  beforeAll(async () => {
    app = buildApp();
    res = await request(app).get('/api/docs.json');
  });

  it('returns 200 JSON without a token', () => {
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('is an OpenAPI 3 document titled "SupplyFlow API" with a version', () => {
    expect(res.body.openapi).toMatch(/^3\./);
    expect(res.body.info).toMatchObject({ title: 'SupplyFlow API' });
    expect(typeof res.body.info.version).toBe('string');
    expect(res.body.info.version).not.toBe('');
  });

  it('defines the bearerAuth JWT security scheme', () => {
    expect(res.body.components?.securitySchemes?.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it.each([...PUBLIC_OPERATIONS, ...PROTECTED_OPERATIONS])(
    'documents %s %s from the @openapi comments',
    (path, method) => {
      const operation = res.body.paths?.[path]?.[method];
      expect(operation, `${method.toUpperCase()} ${path} missing from spec`).toBeDefined();
      expect(operation.responses).toBeDefined();
    },
  );

  it.each(PROTECTED_OPERATIONS)('marks %s %s as requiring bearerAuth', (path, method) => {
    expect(res.body.paths?.[path]?.[method]?.security).toEqual([{ bearerAuth: [] }]);
  });

  it.each(PUBLIC_OPERATIONS)('does not mark %s %s as requiring login', (path, method) => {
    const operation = res.body.paths?.[path]?.[method];
    expect(operation).toBeDefined();
    expect(operation.security ?? []).toEqual([]);
  });

  it('documents no paths outside /api', () => {
    expect(Object.keys(res.body.paths ?? {}).length).toBeGreaterThan(0);
    for (const path of Object.keys(res.body.paths ?? {})) expect(path).toMatch(/^\/api\//);
  });

  it('resolves every $ref to a component defined in the spec', () => {
    const refs = collectRefs(res.body);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref).toMatch(/^#\/components\//);
      const target = ref
        .slice(2)
        .split('/')
        .reduce((node, key) => node?.[key], res.body);
      expect(target, `unresolved ${ref}`).toBeDefined();
    }
  });

  it('ignores an invalid token instead of rejecting the request', async () => {
    const withBadToken = await request(app)
      .get('/api/docs.json')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(withBadToken.status).toBe(200);
  });
});

describe('GET /api/docs', () => {
  let app;
  beforeAll(() => {
    app = buildApp();
  });

  // Swagger UI may redirect /api/docs to /api/docs/ first; a browser follows that.
  it('returns the Swagger UI HTML page without a token', async () => {
    const res = await request(app).get('/api/docs').redirects(1);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toMatch(/swagger-ui/i);
  });

  it('serves the scripts and styles the page loads', async () => {
    const page = await request(app).get('/api/docs').redirects(1);
    const assets = [...page.text.matchAll(/(?:src|href)="\.?\/?([^"?#]+\.(?:js|css))"/g)].map(
      ([, file]) => file,
    );
    expect(assets.length).toBeGreaterThan(0);
    for (const file of assets) {
      const asset = await request(app).get(`/api/docs/${file}`);
      expect(asset.status, `/api/docs/${file}`).toBe(200);
    }
  });
});

describe('existing API behavior with docs mounted', () => {
  it('still requires login for the protected routes', async () => {
    const app = buildApp();
    for (const path of ['/api/orders', '/api/vendors', '/api/dashboard', '/api/users']) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });

  it('still answers unknown /api paths with 404 JSON', async () => {
    const res = await request(buildApp()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
