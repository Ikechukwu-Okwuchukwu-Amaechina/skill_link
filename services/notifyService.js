const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendEmail } = require('./emailService');
const { logger } = require('../config/logger');

// Create and optionally email a notification
// args: { userId, title?, message, type?, link?, meta?, email?: boolean }
async function notify(args) {
	const { userId, title, message, type = 'system', link, meta, email } = args || {};
	if (!userId || !message) throw new Error('userId and message are required');

	const user = await User.findById(userId);
	if (!user) throw new Error('User not found for notification');

	const doc = await Notification.create({
		user: user._id,
		accountType: user.accountType || 'skilled_worker',
		title,
		message,
		type,
		link,
		meta,
	});

	if (email && user.email) {
		try {
			await sendEmail({
				to: user.email,
				subject: title || 'New notification',
				text: message + (link ? `\nOpen: ${link}` : ''),
				html: `<p>${message}</p>${link ? `<p><a href="${link}">Open</a></p>` : ''}`
			});
			doc.emailSent = true;
			await doc.save();
		} catch (e) {
			logger.warn('Failed to send email notification', { error: e.message });
		}
	}

	return doc;
}

async function markRead(userId, id) {
	const doc = await Notification.findOne({ _id: id, user: userId });
	if (!doc) return null;
	if (!doc.isRead) {
		doc.isRead = true;
		doc.readAt = new Date();
		await doc.save();
	}
	return doc;
}

async function markAllRead(userId) {
	await Notification.updateMany({ user: userId, isRead: false }, { $set: { isRead: true, readAt: new Date() } });
}

module.exports = { notify, markRead, markAllRead };
