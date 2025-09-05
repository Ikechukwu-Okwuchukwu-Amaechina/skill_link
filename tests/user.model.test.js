const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');

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

describe('User model', () => {
  it('hashes password when using setPassword', async () => {
    const user = new User({ name: 'Test', email: 't@example.com', passwordHash: 'temp' });
    user.setPassword('secret123');
    await user.save();

    expect(user.passwordHash).toBeDefined();
    expect(user.passwordHash).not.toEqual('secret123');
  });

  it('checkPassword returns true for correct password', async () => {
    const u = new User({ name: 'A', email: 'a@example.com', passwordHash: 'temp' });
    u.setPassword('mypassword');
    await u.save();

    expect(u.checkPassword('mypassword')).toBe(true);
    expect(u.checkPassword('wrong')).toBe(false);
  });
});
