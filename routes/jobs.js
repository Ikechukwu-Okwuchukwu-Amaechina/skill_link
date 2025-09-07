const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { createJob, listMyJobs, getJob, updateJob, deleteJob, applyToJob, approveInviteOrApplication } = require('../controllers/jobController');

const router = Router();

router.post('/', auth, createJob);
router.get('/', auth, listMyJobs);
router.get('/:id', auth, getJob);
router.patch('/:id', auth, updateJob);
router.delete('/:id', auth, deleteJob);

// Worker applies to a job
router.post('/:jobId/apply', auth, applyToJob);

// Employer approves accepted invite or application by invite/application id
router.post('/applications/:id/approve', auth, approveInviteOrApplication);

module.exports = router;
