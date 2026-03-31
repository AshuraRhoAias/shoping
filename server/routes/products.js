'use strict';

const productsRepo = require('../db/repo/products');

async function productRoutes(fastify) {
  // ── GET / ─────────────────────────────────────────────────────────────────────
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          page:     { type: 'integer', minimum: 1, default: 1 },
          limit:    { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          category: { type: 'string' },
          branchId: { type: 'string' },
          search:   { type: 'string' },
          minPrice: { type: 'number', minimum: 0 },
          maxPrice: { type: 'number', minimum: 0 },
          inStock:  { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const result = await productsRepo.list(fastify.db, request.query);
    reply.header('X-Total-Count', String(result.total));
    return reply.sendEncrypted({ ...result, page: request.query.page, limit: request.query.limit }, 'public');
  });

  // ── GET /:id ──────────────────────────────────────────────────────────────────
  fastify.get('/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const product = await productsRepo.findById(fastify.db, request.params.id);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ product }, 'public');
  });

  // ── POST / ────────────────────────────────────────────────────────────────────
  fastify.post('/', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
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
          images:      { type: 'array', items: { type: 'string' } },
          active:      { type: 'boolean', default: true },
        },
      },
    },
  }, async (request, reply) => {
    const product = await productsRepo.create(fastify.db, request.body);
    return reply.code(201).sendEncrypted({ product }, 'user');
  });

  // ── PATCH /:id ────────────────────────────────────────────────────────────────
  fastify.patch('/:id', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
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
          active:      { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const product = await productsRepo.update(fastify.db, request.params.id, request.body);
    if (!product) return reply.code(404).send({ error: 'Not Found' });
    return reply.sendEncrypted({ product }, 'user');
  });

  // ── DELETE /:id ───────────────────────────────────────────────────────────────
  fastify.delete('/:id', {
    preHandler: [fastify.requireRole('admin','superadmin')],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const existing = await productsRepo.findById(fastify.db, request.params.id);
    if (!existing) return reply.code(404).send({ error: 'Not Found' });
    await productsRepo.remove(fastify.db, request.params.id);
    return reply.send({ message: 'Producto eliminado', id: request.params.id });
  });

  // ── POST /bulk ────────────────────────────────────────────────────────────────
  fastify.post('/bulk', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    config: { rateLimit: { max: 100, timeWindow: '1 minute' } },
    schema: {
      body: {
        type: 'object',
        required: ['products'],
        properties: {
          products: {
            type: 'array', minItems: 1, maxItems: 1000,
            items: {
              type: 'object', required: ['name','price'],
              properties: {
                id:       { type: 'string' },
                name:     { type: 'string' },
                price:    { type: 'number', minimum: 0 },
                sku:      { type: 'string' },
                category: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const result = await productsRepo.bulkUpsert(fastify.db, request.body.products);
    return reply.sendEncrypted(result, 'user');
  });

  // ── GET /:id/stock ────────────────────────────────────────────────────────────
  fastify.get('/:id/stock', {
    preHandler: [fastify.authenticate],
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } },
  }, async (request, reply) => {
    const stockByBranch = await productsRepo.stockByBranch(fastify.db, request.params.id);
    return reply.sendEncrypted({ productId: request.params.id, stockByBranch }, 'user');
  });

  // ── PATCH /:id/stock ──────────────────────────────────────────────────────────
  fastify.patch('/:id/stock', {
    preHandler: [fastify.requireRole('admin','superadmin','seller')],
    schema: {
      params: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      body: {
        type: 'object', required: ['branchId','quantity'],
        properties: {
          branchId:  { type: 'string' },
          quantity:  { type: 'integer' },
          operation: { type: 'string', enum: ['set','increment','decrement'], default: 'set' },
        },
      },
    },
  }, async (request, reply) => {
    const { branchId, quantity, operation = 'set' } = request.body;
    const row = await productsRepo.updateStock(fastify.db, request.params.id, branchId, quantity, operation);
    return reply.sendEncrypted({ ...row, updatedAt: new Date().toISOString() }, 'user');
  });
}

module.exports = productRoutes;
