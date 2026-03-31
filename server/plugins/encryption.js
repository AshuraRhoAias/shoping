'use strict';

const fp = require('fastify-plugin');
const { encrypt, decrypt } = require('../utils/crypto');

/**
 * Adds `reply.sendEncrypted(data, level)` and `request.decryptBody(level)`.
 *
 * level: 'public' | 'user' | 'admin'
 *
 * Encrypted responses look like:
 *   { encrypted: true, level: 'user', payload: '<hex string>' }
 */
async function encryptionPlugin(fastify) {
  /** Encrypt and send a response */
  fastify.decorateReply('sendEncrypted', function (data, level = 'public') {
    const payload = encrypt(data, level);
    this.type('application/json').send({ encrypted: true, level, payload });
  });

  /** Decrypt the request body (client must send same format) */
  fastify.decorateRequest('decryptBody', function (level = 'public') {
    const body = this.body;
    if (!body || !body.encrypted || !body.payload) {
      throw this.server.httpErrors?.createError(400, 'Expected encrypted body') ||
            Object.assign(new Error('Expected encrypted body'), { statusCode: 400 });
    }
    return decrypt(body.payload, level);
  });
}

module.exports = fp(encryptionPlugin, { name: 'encryption-plugin' });
