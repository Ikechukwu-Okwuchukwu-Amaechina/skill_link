const request = require('supertest');
const { app } = require('..\\app');

describe('Health endpoint', function () {
  it('GET /health returns ok', async function () {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown route returns 404 JSON', async function () {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error', 'Not Found');
  });
});
