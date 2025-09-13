const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');
const Project = require('..\\models\\Project');
const Review = require('..\\models\\Review');

jest.setTimeout(60000);

let mongo;

async function registerEmployer(email = 'revemp@example.com') {
  const phone = '+1236' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Emp', lastname: 'Lo', email, phone, password: 'secret123', accountType: 'employer' });
  return { token: res.body.token, user: res.body.user };
}

async function registerWorker(email = 'revworker@example.com') {
  const phone = '+1237' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Pro', lastname: ' Doer', email, phone, password: 'secret123', accountType: 'skilled_worker' });
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
  await Promise.all([User.deleteMany({}), Project.deleteMany({}), Review.deleteMany({})]);
});

describe('Reviews API', () => {
  test('employer can review worker on completed project', async () => {
    const { token: empToken, user: emp } = await registerEmployer();
    const { token: workerToken, user: worker } = await registerWorker();

    // Create a completed project between them
    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ title: 'Job', budget: 100, assignedTo: worker._id });
    const projectId = created.body.project._id;

    // Mark as completed (creator only)
    const updated = await request(app)
      .patch(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${empToken}`)
      .send({ status: 'completed' });
    expect(updated.status).toBe(200);

    const review = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ projectId, rating: 5, publicFeedback: 'Great job!' });
    expect(review.status).toBe(201);
    expect(review.body.review.rating).toBe(5);

    // Worker profile reviews
    const workerReviews = await request(app)
      .get(`/api/reviews/worker/${worker._id}`);
    expect(workerReviews.status).toBe(200);
    expect(workerReviews.body.stats.count).toBe(1);

    // History for employer
    const history = await request(app)
      .get('/api/reviews/history/me')
      .set('Authorization', `Bearer ${empToken}`);
    expect(history.status).toBe(200);
    expect(history.body.reviews.length).toBe(1);
  });

  test('cannot review if project not completed', async () => {
  const { token: empToken, user: emp } = await registerEmployer('otheremp@example.com');
    const { user: worker } = await registerWorker('otherworker@example.com');

    const created = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ title: 'Job2', budget: 50, assignedTo: worker._id });
    const projectId = created.body.project._id;

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ projectId, rating: 4 });
    expect(res.status).toBe(400);
  });
});
