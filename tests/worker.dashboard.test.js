const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');
const Project = require('..\\models\\Project');
const Review = require('..\\models\\Review');

let mongo;

async function registerWorker(email = 'worker_dash@example.com') {
  const phone = '+1299' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Dash', lastname: 'Worker', email, phone, password: 'secret123', accountType: 'skilled_worker' });
  return { token: res.body.token, user: res.body.user };
}

async function registerEmployer(email = 'employer_dash@example.com') {
  const phone = '+1298' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Boss', lastname: 'Man', email, phone, password: 'secret123', accountType: 'employer' });
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

describe('Worker dashboard', () => {
  test('returns dashboard summary and sections', async () => {
    const { token: empToken, user: employer } = await registerEmployer();
    const { token: workerToken, user: worker } = await registerWorker();

    // Create two projects assigned to worker
    const p1 = await Project.create({
      title: 'Plumbing Installation',
      category: 'Plumbing',
      budget: 500,
      createdBy: employer._id,
      assignedTo: worker._id,
      status: 'active',
      progress: 60,
      messages: [
        { sender: employer._id, text: 'Can we reschedule?', createdAt: new Date() }
      ],
      milestones: [ { title: 'Install pipes', status: 'submitted' } ]
    });

    const p2 = await Project.create({
      title: 'Electrical Repair',
      category: 'Electrical',
      budget: 300,
      createdBy: employer._id,
      assignedTo: worker._id,
      status: 'completed',
      progress: 100
    });

    // Add a couple reviews for rating
    await Review.create({ project: p2._id, reviewer: employer._id, reviewee: worker._id, rating: 5 });
    await Review.create({ project: p1._id, reviewer: employer._id, reviewee: worker._id, rating: 4 });

    const res = await request(app)
      .get('/api/workers/dashboard')
      .set('Authorization', `Bearer ${workerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('activeProjects', 1);
    expect(res.body.summary).toHaveProperty('currentRating');
    expect(res.body.summary.currentRating).toBeGreaterThanOrEqual(4);
    expect(res.body).toHaveProperty('recentJobs');
    expect(Array.isArray(res.body.recentJobs)).toBe(true);
    expect(res.body.recentJobs.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('latestMessages');
    expect(Array.isArray(res.body.latestMessages)).toBe(true);
    expect(res.body).toHaveProperty('ongoingJobs');
    expect(res.body).toHaveProperty('earningsReview');
  });
});
