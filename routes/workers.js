const { Router } = require('express');
const { 
  listWorkers, 
  getWorker, 
  workersMeta,
  getJobInvitations,
  getActiveJobs,
  getCompletedJobs,
  acceptJobInvitation,
  declineJobInvitation,
  getWorkerDashboard,
  paymentsOverview,
  paymentsHistory,
  requestWithdrawal
} = require('../controllers/workerController');
const { auth } = require('../middleware/auth');

const router = Router();

router.get('/public', listWorkers);
router.get('/meta', workersMeta);

// Protected worker job endpoints (must come before /:id route)
router.get('/dashboard', auth, getWorkerDashboard);
router.get('/jobs/invitations', auth, getJobInvitations);
router.get('/jobs/active', auth, getActiveJobs);
router.get('/jobs/completed', auth, getCompletedJobs);
router.post('/jobs/invitations/:id/accept', auth, acceptJobInvitation);
router.post('/jobs/invitations/:id/decline', auth, declineJobInvitation);

// Payments and finance
router.get('/payments/overview', auth, paymentsOverview);
router.get('/payments/history', auth, paymentsHistory);
router.post('/payments/withdrawals', auth, requestWithdrawal);

router.get('/:id', getWorker);

module.exports = router;
