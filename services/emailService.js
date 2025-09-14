const nodemailer = require('nodemailer');
const { logger } = require('../config/logger');

// Create transport from env. For development, use ethereal toggle or console
function createTransport() {
	// Basic SMTP values (works with many providers)
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT || 587);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		// Fallback: log emails to console (no external calls)
		return {
			sendMail: async function (opts) {
				logger.info('EMAIL (console fallback)', { to: opts.to, subject: opts.subject, text: opts.text, html: opts.html });
				return { messageId: 'console-mail' };
			}
		};
	}

	return nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
}

const transporter = createTransport();

async function sendEmail(options) {
	// options: { to, subject, text?, html? }
	const from = process.env.EMAIL_FROM || 'no-reply@skill-link.local';
	const mail = { from, to: options.to, subject: options.subject, text: options.text, html: options.html };
	const info = await transporter.sendMail(mail);
	return info;
}

module.exports = { sendEmail };
