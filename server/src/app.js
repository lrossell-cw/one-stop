/**
 * Express routing over FiberService.
 *
 * Kept deliberately thin: all decisions live in service.js, which is testable
 * without a server. Anything non-trivial appearing here is a smell.
 */

import express from 'express';
import { FiberService } from './service.js';

/**
 * @param {object} opts
 * @param {import('./store.js').SqliteStatusStore} opts.store
 * @param {{name: string, load: () => Promise<object>}} opts.source
 */
export function createApp({ store, source }) {
  const service = new FiberService({ store, source });
  const app = express();
  app.use(express.json());

  const send = (res) => (out) => (out.error
    ? res.status(out.error.code).json({ error: out.error.message })
    : res.json(out.result));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, source: source.name });
  });

  app.get('/api/circuits', (req, res, next) => {
    service.circuits().then((body) => res.json(body)).catch(next);
  });

  app.post('/api/reload', (req, res, next) => {
    service.reload().then((body) => res.json(body)).catch(next);
  });

  app.post('/api/circuits/:circuitId/hops/:hopId/status', (req, res, next) => {
    service
      .setStatus(req.params.circuitId, req.params.hopId, req.body ?? {})
      .then(send(res))
      .catch(next);
  });

  app.delete('/api/circuits/:circuitId/hops/:hopId/status', (req, res, next) => {
    service
      .clearStatus(req.params.circuitId, req.params.hopId)
      .then(send(res))
      .catch(next);
  });

  app.get('/api/history', (req, res) => {
    res.json(service.history(Number(req.query.limit) || 100));
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  app.locals.service = service;
  return app;
}
