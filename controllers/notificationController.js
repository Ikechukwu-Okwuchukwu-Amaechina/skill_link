const Notification = require('../models/Notification');
const User = require('../models/User');
const { notify, markRead, markAllRead } = require('../services/notifyService');

// GET /api/notifications
async function listMyNotifications(req, res, next) {
	try {
		const filter = { user: req.userId };
		if (req.query.type) filter.type = req.query.type;
		if (req.query.isRead !== undefined) filter.isRead = req.query.isRead === 'true';

		const page = Math.max(parseInt(req.query.page || '1', 10), 1);
		const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
		const skip = (page - 1) * limit;

		const [items, total] = await Promise.all([
			Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
			Notification.countDocuments(filter)
		]);
		res.json({ notifications: items, page, total });
	} catch (err) { next(err); }
}

// POST /api/notifications (optional: system/admin create)
async function createNotification(req, res, next) {
	try {
		// Only allow admin to create arbitrary notifications for now
		const me = await User.findById(req.userId);
		if (!me || me.role !== 'admin') { const e = new Error('Admin only'); e.status = 403; throw e; }

		const { userId, title, message, type, link, email } = req.body || {};
		if (!userId || !message) { const e = new Error('userId and message required'); e.status = 400; throw e; }
		const doc = await notify({ userId, title, message, type, link, email });
		res.status(201).json({ notification: doc });
	} catch (err) { next(err); }
}

// PATCH /api/notifications/:id/read
async function markOneRead(req, res, next) {
	try {
		const n = await markRead(req.userId, req.params.id);
		if (!n) { const e = new Error('Notification not found'); e.status = 404; throw e; }
		res.json({ notification: n });
	} catch (err) { next(err); }
}

// PATCH /api/notifications/read-all
async function markMineAllRead(req, res, next) {
	try {
		await markAllRead(req.userId);
		res.json({ ok: true });
	} catch (err) { next(err); }
}

module.exports = { listMyNotifications, createNotification, markOneRead, markMineAllRead };
