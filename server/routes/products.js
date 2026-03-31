'use strict';

const crypto = require('node:crypto');

/**
 * Product catalog routes.
 * Encryption: public level (3 layers) for GET, user level for mutations.
 *
 * GET    /api/v1/products              – list products (paginated, filterable)
 * GET    /api/v1/products/:id          – product detail
 * POST   /api/v1/products              – create product (admin/seller)
 * PATCH  /api/v1/products/:id          – update product (admin/seller)
 * DELETE /api/v1/products/:id          – delete product (admin)
 * POST   /api/v1/products/bulk         – bulk upsert (for 100k+/h throughput)
 * GET    /api/v1/products/:id/stock    – stock across all branches
 * PATCH  /api/v1/products/:id/stock    – update stock for a branch
 */
async function productRoutes(fastify) {
  // In-memory store (replace with DB)
  const products = new Map();

  // ── List products ─────────────────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:       { type: 'integer', minimum: 1, default: 1 },
          limit:      { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          category:   { type: 'string' },
          branchId:   { type: 'string' },
          search:     { type: 'string' },
          minPrice:   { type: 'number', minimum: 0 },
          maxPrice:   { type: 'number', minimum: 0 },
          inStock:    { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = 1, limit = 50 } = request.query;
    let list = [...products.values()];

    // Simple filters (production: push to DB query)
    const { category, search, minPrice, maxPrice, inStock } = request.query;
    if (category) list = list.filter(p => p.category === category);
    if (search)   list = list.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()),
    );
    if (minPrice !== undefined) list = list.filter(p => p.price >= minPrice);
    if (maxPrice !== undefined) list = list.filter(p => p.price <= maxPrice);
    if (inStock !== undefined)  list = list.filter(p => (p.stock > 0) === inStock);

    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit);

    reply.header('X-Total-Count', String(list.length));
    return reply.sendEncrypted({ products: slice, total: list.length, page, limit }, 'public');
  });

  // ── Get single product ────────────────────────────────────────────────────────
  fastify.get('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const product = products.get(request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ product }, 'public');
  });

  // ── Create product ────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'price'],
        properties: {
          name:        { type: 'string', minLength: 2, maxLength: 200 },
          description: { type: 'string', maxLength: 5000 },
          price:       { type: 'number', minimum: 0 },
          costPrice:   { type: 'number', minimum: 0 },
          sku:         { type: 'string' },
          barcode:     { type: 'string' },
          category:    { type: 'string' },
          tags:        { type: 'array', items: { type: 'string' } },
          stock:       { type: 'integer', minimum: 0, default: 0 },
          branchId:    { type: 'string' },
          images:      { type: 'array', items: { type: 'string' } },
          active:      { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const id      = crypto.randomUUID();
    const product = { id, ...request.body, createdAt: new Date().toISOString() };
    products.set(id, product);
    return reply.code(201).sendEncrypted({ product }, 'user');
  });

  // ── Update product ────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          name:        { type: 'string' },
          description: { type: 'string' },
          price:       { type: 'number', minimum: 0 },
          costPrice:   { type: 'number', minimum: 0 },
          sku:         { type: 'string' },
          category:    { type: 'string' },
          tags:        { type: 'array', items: { type: 'string' } },
          stock:       { type: 'integer', minimum: 0 },
          active:      { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const product = products.get(request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    Object.assign(product, request.body, { updatedAt: new Date().toISOString() });
    return reply.sendEncrypted({ product }, 'user');
  });

  // ── Delete product ────────────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('admin', 'superadmin')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    if (!products.has(request.params.id)) return reply.code(404).send({ error: 'Not Found' });
    products.delete(request.params.id);
    return reply.send({ message: 'Product deleted', id: request.params.id });
  });

  // ── Bulk upsert (for high-throughput ingestion 100k+/h) ─────────────────────
  fastify.post('/bulk', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['products'],
        properties: {
          products: {
            type: 'array',
            minItems: 1,
            maxItems: 1000,
            items: {
              type: 'object',
              required: ['name', 'price'],
              properties: {
                id:       { type: 'string' },
                name:     { type: 'string' },
                price:    { type: 'number', minimum: 0 },
                sku:      { type: 'string' },
                stock:    { type: 'integer', minimum: 0 },
                branchId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const items    = request.body.products;
    const created  = [];
    const updated  = [];

    for (const item of items) {
      const id = item.id || crypto.randomUUID();
      if (products.has(id)) {
        Object.assign(products.get(id), item, { updatedAt: new Date().toISOString() });
        updated.push(id);
      } else {
        products.set(id, { id, ...item, createdAt: new Date().toISOString() });
        created.push(id);
      }
    }

    return reply.sendEncrypted({ created: created.length, updated: updated.length }, 'user');
  });

  // ── Stock across branches ─────────────────────────────────────────────────────
  fastify.get('/:id/stock', {
    preHandler: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request, reply) => {
    const product = products.get(request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    // Placeholder – query per-branch stock table
    return reply.sendEncrypted({ productId: request.params.id, stockByBranch: [] }, 'user');
  });

  // ── Update stock for a branch ─────────────────────────────────────────────────
  fastify.patch('/:id/stock', {
    preHandler: [fastify.requireRole('admin', 'superadmin', 'seller')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['branchId', 'quantity'],
        properties: {
          branchId: { type: 'string' },
          quantity: { type: 'integer' },
          operation:{ type: 'string', enum: ['set', 'increment', 'decrement'], default: 'set' },
        },
      },
    },
  }, async (request, reply) => {
    const product = products.get(request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    // Placeholder – update branch stock record
    return reply.sendEncrypted({
      productId: request.params.id,
      ...request.body,
      updatedAt: new Date().toISOString(),
    }, 'user');
  });
}

module.exports = productRoutes;
