const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Auth flow', () => {
  it('registers a user and returns token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ firstname: 'Jane', lastname: 'Doe', email: 'jane@example.com', phone: '+1234567890', password: 'secret123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).not.toHaveProperty('passwordHash');
  });

  it('logs in a user and returns token', async () => {
    // create user first
    const u = new User({ name: 'John Doe', firstname: 'John', lastname: 'Doe', email: 'john@example.com', phone: '+1234567891', passwordHash: 'temp' });
    u.setPassword('secret123');
    await u.save();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'john@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns current user with valid token', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ firstname: 'Sam', lastname: 'Smith', email: 'sam@example.com', phone: '+1234567892', password: 'secret123' });

    const token = register.body.token;

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(me.status).toBe(200);
    expect(me.body).toHaveProperty('user');
    expect(me.body.user.email).toBe('sam@example.com');
  });
});
