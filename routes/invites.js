const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { createInvite, acceptInvite, declineInvite, listInvites, getInvite } = require('../controllers/inviteController');

const router = Router();

// Employer invites a worker to a job
router.post('/', auth, createInvite);

// Worker accepts an invite
router.post('/:id/accept', auth, acceptInvite);

// Worker declines an invite
router.post('/:id/decline', auth, declineInvite);

// (approval and job applications moved to /api/jobs routes)

// List invites/applications relevant to the current user
router.get('/', auth, listInvites);

// Get one invite/application
router.get('/:id', auth, getInvite);


module.exports = router;
