const { Router } = require('express');
const router = Router();
const { auth } = require('../middleware/auth');
const { adminLogin, listUsers, getUser, listJobs, getJob, listPayments, getPayment } = require('../controllers/adminController');

// Public admin login route (no auth)
router.post('/login', adminLogin);

// Simple admin role check middleware
function requireAdmin(req, res, next) {
  if (!req.userRole || req.userRole !== 'admin') {
    const err = new Error('Admin privileges required');
    err.status = 403;
    return next(err);
  }
  next();
}

// All admin API routes below are protected
router.use(auth, requireAdmin);

// Users
router.get('/users', listUsers);
router.get('/users/:id', getUser);

// Jobs
router.get('/jobs', listJobs);
router.get('/jobs/:id', getJob);

// Payments
router.get('/payments', listPayments);
router.get('/payments/:id', getPayment);

module.exports = router;
