const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { app } = require('..\\app');
const User = require('..\\models\\User');
const Job = require('..\\models\\Job');
const Invite = require('..\\models\\Invite');

jest.setTimeout(60000);

let mongo;

async function registerEmployer(email = 'boss@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Big', lastname: 'Boss', email, password: 'secret123', accountType: 'employer' });
  return { token: res.body.token, user: res.body.user };
}

async function registerWorker(email = 'pro@example.com') {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ firstname: 'Pro', lastname: ' Worker', email, password: 'secret123', accountType: 'skilled_worker' });
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
  await Promise.all([User.deleteMany({}), Job.deleteMany({}), Invite.deleteMany({})]);
});

describe('Invite/Application approval flow', () => {
  test('worker accepts invite, employer approves', async () => {
    const { token: empToken, user: emp } = await registerEmployer();
    const { token: workerToken, user: worker } = await registerWorker();

    // Employer creates a job
    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ title: 'Gig', description: 'Desc', budgetRange: { min: 100, max: 200 } });
    const jobId = created.body.job._id;

    // Employer invites worker
    const inviteRes = await request(app)
      .post('/api/invites')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ jobId, workerId: worker._id, message: 'Join?'});
    expect(inviteRes.status).toBe(201);
    const inviteId = inviteRes.body.invite._id;

    // Worker accepts
    const accept = await request(app)
      .post(`/api/invites/${inviteId}/accept`)
      .set('Authorization', `Bearer ${workerToken}`);
    expect(accept.status).toBe(200);
    expect(accept.body.invite.status).toBe('accepted');

    // Employer approves
    const approve = await request(app)
      .post(`/api/jobs/applications/${inviteId}/approve`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.invite.status).toBe('approved');
  });

  test('worker applies to job, employer approves', async () => {
    const { token: empToken } = await registerEmployer('boss2@example.com');
    const { token: workerToken } = await registerWorker('pro2@example.com');

    const created = await request(app)
      .post('/api/jobs')
      .set('Authorization', `Bearer ${empToken}`)
      .send({ title: 'Another Gig', description: 'Desc', budgetRange: { min: 50, max: 150 } });
    const jobId = created.body.job._id;

    const apply = await request(app)
      .post(`/api/jobs/${jobId}/apply`)
      .set('Authorization', `Bearer ${workerToken}`)
      .send({ message: 'I am interested' });
    expect(apply.status).toBe(201);
    expect(apply.body.invite.type).toBe('application');
    expect(apply.body.invite.status).toBe('applied');

    const id = apply.body.invite._id;
    const approve = await request(app)
      .post(`/api/jobs/applications/${id}/approve`)
      .set('Authorization', `Bearer ${empToken}`);
    expect(approve.status).toBe(200);
    expect(approve.body.invite.status).toBe('approved');
  });
});
