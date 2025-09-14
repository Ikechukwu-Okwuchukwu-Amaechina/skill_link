const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => {
  res.json({ message: 'API root' });
});

// Mount auth routes
router.use('/auth', require('./auth'));
// Job routes
router.use('/jobs', require('./jobs'));
// Workers browse routes
router.use('/workers', require('./workers'));
// Employers (payments, actions)
router.use('/employers', require('./employers'));
// Invites (employer invites a worker to a job)
router.use('/invites', require('./invites'));
// File uploads
router.use('/uploads', require('./uploads'));
// Projects (simple project management)
router.use('/projects', require('./projects'));
// Reviews and ratings
router.use('/reviews', require('./reviews'));
// Notifications (in-app + email)
router.use('/notifications', require('./notifications'));

module.exports = router;
