const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');
const Job = require('..\\models\\Job');

// Downloading MongoDB binaries can take >5s on first run
jest.setTimeout(60000);

let mongo;

async function registerEmployer(email = 'emp@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Emp', lastname: 'Loyer', email, password: 'secret123', accountType: 'employer' });
  return res.body.token;
}

async function registerWorker(email = 'worker@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Skill', lastname: 'Worker', email, password: 'secret123', accountType: 'skilled_worker' });
  return res.body.token;
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
  await Promise.all([User.deleteMany({}), Job.deleteMany({})]);
});

describe('Job endpoints', () => {
  test('employer can create and list jobs', async () => {
    const token = await registerEmployer();

    const create = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Photographer needed',
        description: 'Event coverage for 5 hours',
        budgetRange: { min: 300, max: 800 },
        timeline: '2025-10-10',
        requiredSkills: ['photography']
      });
    expect(create.status).toBe(201);
    expect(create.body.job).toHaveProperty('_id');

    const list = await request(app)
      .get('/api/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.jobs.length).toBe(1);
    expect(list.body.jobs[0].title).toBe('Photographer needed');
  });

  test('non-employer cannot create jobs', async () => {
    const token = await registerWorker();

    const res = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Should fail',
        description: 'Workers cannot post',
        budgetRange: { min: 100, max: 200 }
      });
    expect(res.status).toBe(403);
  });

  test('employer can update and delete own job', async () => {
    const token = await registerEmployer('emp2@example.com');

    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Initial title',
        description: 'Desc',
        budgetRange: { min: 100, max: 500 }
      });
    const jobId = created.body.job._id;

    const updated = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated title' });
    expect(updated.status).toBe(200);
    expect(updated.body.job.title).toBe('Updated title');

    const del = await request(app)
      .delete(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  test('cannot update others jobs', async () => {
    const emp1 = await registerEmployer('a@example.com');
    const emp2 = await registerEmployer('b@example.com');

    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${emp1}`)
      .send({ title: 'Job A', description: 'Desc', budgetRange: { min: 10, max: 20 } });

    const jobId = created.body.job._id;
    const res = await request(app)
      .patch(`/api/jobs/${jobId}`)
      .set('Authorization', `Bearer ${emp2}`)
      .send({ title: 'Hack' });
    expect(res.status).toBe(403);
  });
});
