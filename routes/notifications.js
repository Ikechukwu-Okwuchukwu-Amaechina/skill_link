const { Router } = require('express');
const { auth } = require('../middleware/auth');
const { listMyNotifications, createNotification, markOneRead, markMineAllRead } = require('../controllers/notificationController');

const router = Router();

router.get('/', auth, listMyNotifications);
router.post('/', auth, createNotification); // admin only
router.patch('/:id/read', auth, markOneRead);
router.patch('/read-all', auth, markMineAllRead);

module.exports = router;
