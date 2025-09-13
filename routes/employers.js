const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { paymentsOverview, paymentsHistory, payWorker, getEmployerDashboard, deposit } = require('../controllers/employerController');

const router = Router();

// Payments & Finance (Employer)
router.get('/dashboard', auth, getEmployerDashboard);
router.get('/payments/overview', auth, paymentsOverview);
router.get('/payments/history', auth, paymentsHistory);
router.post('/wallet/deposit', auth, deposit);

// Pay a worker for a project (after a payment request)
router.post('/projects/:id/payments', auth, payWorker);

module.exports = router;
