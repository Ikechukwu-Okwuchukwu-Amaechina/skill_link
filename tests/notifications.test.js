const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');
const { notify } = require('..\\services\\notifyService');

let mongo;

async function register(email, accountType) {
  const phone = '+1300' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'U', lastname: 'T', email, phone, password: 'secret123', accountType });
  return { token: res.body.token, user: res.body.user };
}

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
  await Promise.all([
    mongoose.connection.collection('notifications').deleteMany({}),
    User.deleteMany({})
  ]);
});

describe('Notifications', () => {
  test('worker and employer get separate notifications', async () => {
    const { token: empToken, user: emp } = await register('emp@example.com', 'employer');
    const { token: workerToken, user: worker } = await register('worker@example.com', 'skilled_worker');

    // Create notifications for both
    await notify({ userId: emp._id, message: 'Employer note', type: 'system' });
    await notify({ userId: worker._id, message: 'Worker note', type: 'system' });

    const eList = await request(app).get('/api/notifications').set('Authorization', `Bearer ${empToken}`);
    const wList = await request(app).get('/api/notifications').set('Authorization', `Bearer ${workerToken}`);

    expect(eList.status).toBe(200);
    expect(wList.status).toBe(200);
    expect(eList.body.notifications.length).toBe(1);
    expect(wList.body.notifications.length).toBe(1);
    expect(eList.body.notifications[0].message).toBe('Employer note');
    expect(wList.body.notifications[0].message).toBe('Worker note');
  });

  test('mark read and mark all read', async () => {
    const { token, user } = await register('x@example.com', 'skilled_worker');
    const a = await notify({ userId: user._id, message: 'A' });
    await notify({ userId: user._id, message: 'B' });

    const readOne = await request(app).patch(`/api/notifications/${a._id}/read`).set('Authorization', `Bearer ${token}`);
    expect(readOne.status).toBe(200);
    expect(readOne.body.notification.isRead).toBe(true);

    const readAll = await request(app).patch('/api/notifications/read-all').set('Authorization', `Bearer ${token}`);
    expect(readAll.status).toBe(200);
  });
});
