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
// File uploads
router.use('/uploads', require('./uploads'));

module.exports = router;
