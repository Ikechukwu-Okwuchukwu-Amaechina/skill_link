const request = require('supertest');
const app = require('../app');
const User = require('../models/User');
const Job = require('../models/Job');
const Invite = require('../models/Invite');

describe('Worker Jobs API', () => {
  let workerToken;
  let employerToken;
  let workerId;
  let employerId;
  let jobId;
  let inviteId;

  beforeEach(async () => {
    // Clean up the database
    await User.deleteMany({});
    await Job.deleteMany({});
    await Invite.deleteMany({});

    // Create test employer
    const employer = await User.create({
      name: 'Test Employer',
      email: 'employer@test.com',
      accountType: 'employer',
      employer: {
        companyName: 'Test Company',
        location: 'Test City'
      }
    });
    employerId = employer._id;
    
    // Get employer token
    const employerLoginRes = await request(app)
      .post('/api/auth/send-otp')
      .send({ email: 'employer@test.com' });
    
    employerToken = 'Bearer test_token_employer'; // Simplified for testing

    // Create test worker
    const worker = await User.create({
      name: 'Test Worker',
      email: 'worker@test.com',
      accountType: 'skilled_worker',
      skilledWorker: {
        professionalTitle: 'Plumber',
        primarySkills: ['Plumbing', 'Installation'],
        hourlyRate: 50
      }
    });
    workerId = worker._id;
    
    workerToken = 'Bearer test_token_worker'; // Simplified for testing

    // Create test job
    const job = await Job.create({
      employer: employerId,
      title: 'Plumbing Installation',
      description: 'Looking for help with installing new plumbing fixtures',
      budgetRange: { min: 400, max: 600 },
      timeline: 'May 5, 2025',
      requiredSkills: ['Plumbing', 'Installation']
    });
    jobId = job._id;

    // Create test invitation
    const invite = await Invite.create({
      employer: employerId,
      worker: workerId,
      job: jobId,
      message: 'We would like to invite you for this job',
      type: 'invite',
      status: 'pending'
    });
    inviteId = invite._id;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Job.deleteMany({});
    await Invite.deleteMany({});
  });

  describe('GET /api/workers/jobs/invitations', () => {
    it('should get job invitations for worker', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/invitations')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(1);
      expect(res.body.invitations[0].job.title).toBe('Plumbing Installation');
      expect(res.body.invitations[0].status).toBe('pending');
    });

    it('should filter invitations by search query', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/invitations?q=plumbing')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(1);
    });

    it('should filter invitations by category', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/invitations?category=plumbing')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(1);
    });

    it('should filter invitations by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app)
        .get(`/api/workers/jobs/invitations?dateFrom=${today}`)
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/workers/jobs/invitations')
        .expect(401);
    });
  });

  describe('GET /api/workers/jobs/active', () => {
    beforeEach(async () => {
      // Accept the invitation to make it active
      await Invite.findByIdAndUpdate(inviteId, { status: 'accepted' });
    });

    it('should get active jobs for worker', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/active')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.activeJobs).toHaveLength(1);
      expect(res.body.activeJobs[0].job.title).toBe('Plumbing Installation');
      expect(res.body.activeJobs[0].status).toBe('accepted');
    });

    it('should filter active jobs by search query', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/active?q=plumbing')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.activeJobs).toHaveLength(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/workers/jobs/active')
        .expect(401);
    });
  });

  describe('GET /api/workers/jobs/completed', () => {
    beforeEach(async () => {
      // Mark the job as completed
      await Invite.findByIdAndUpdate(inviteId, { status: 'completed' });
    });

    it('should get completed jobs for worker', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/completed')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.completedJobs).toHaveLength(1);
      expect(res.body.completedJobs[0].job.title).toBe('Plumbing Installation');
      expect(res.body.completedJobs[0].status).toBe('completed');
    });

    it('should filter completed jobs by search query', async () => {
      const res = await request(app)
        .get('/api/workers/jobs/completed?q=plumbing')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.completedJobs).toHaveLength(1);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/workers/jobs/completed')
        .expect(401);
    });
  });

  describe('POST /api/workers/jobs/invitations/:id/accept', () => {
    it('should accept job invitation', async () => {
      const res = await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/accept`)
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.message).toBe('Invitation accepted successfully');
      expect(res.body.invitation.status).toBe('accepted');

      // Verify the status was updated in database
      const updatedInvite = await Invite.findById(inviteId);
      expect(updatedInvite.status).toBe('accepted');
    });

    it('should return 404 for non-existent invitation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .post(`/api/workers/jobs/invitations/${fakeId}/accept`)
        .set('Authorization', workerToken)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/accept`)
        .expect(401);
    });
  });

  describe('POST /api/workers/jobs/invitations/:id/decline', () => {
    it('should decline job invitation', async () => {
      const res = await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/decline`)
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.message).toBe('Invitation declined successfully');
      expect(res.body.invitation.status).toBe('declined');

      // Verify the status was updated in database
      const updatedInvite = await Invite.findById(inviteId);
      expect(updatedInvite.status).toBe('declined');
    });

    it('should return 404 for non-existent invitation', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .post(`/api/workers/jobs/invitations/${fakeId}/decline`)
        .set('Authorization', workerToken)
        .expect(404);
    });

    it('should require authentication', async () => {
      await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/decline`)
        .expect(401);
    });
  });

  describe('Edge cases and validation', () => {
    it('should handle pagination for invitations', async () => {
      // Create additional invitations
      for (let i = 0; i < 15; i++) {
        const extraJob = await Job.create({
          employer: employerId,
          title: `Job ${i}`,
          description: `Description ${i}`,
          budgetRange: { min: 100, max: 200 },
          requiredSkills: ['Skill']
        });

        await Invite.create({
          employer: employerId,
          worker: workerId,
          job: extraJob._id,
          type: 'invite',
          status: 'pending'
        });
      }

      const res = await request(app)
        .get('/api/workers/jobs/invitations?page=1&limit=5')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(5);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(5);
      expect(res.body.pagination.total).toBeGreaterThan(15);
    });

    it('should handle empty results gracefully', async () => {
      // Remove all invitations
      await Invite.deleteMany({ worker: workerId });

      const res = await request(app)
        .get('/api/workers/jobs/invitations')
        .set('Authorization', workerToken)
        .expect(200);

      expect(res.body.invitations).toHaveLength(0);
    });

    it('should not allow worker to accept invitation twice', async () => {
      // Accept invitation first time
      await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/accept`)
        .set('Authorization', workerToken)
        .expect(200);

      // Try to accept again
      await request(app)
        .post(`/api/workers/jobs/invitations/${inviteId}/accept`)
        .set('Authorization', workerToken)
        .expect(404); // Should not find pending invitation
    });
  });
});
