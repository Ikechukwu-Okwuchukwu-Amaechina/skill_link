// Core server bootstrap
require('dotenv').config();
const { app } = require('./app');
const { connectDB, disconnectDB } = require('./config/db');
const { logger } = require('./config/logger');

const PORT = process.env.PORT || 3000;
let server;

async function start() {
	try {
		await connectDB();
		server = app.listen(PORT, () => {
			logger.info(`Server running on port ${PORT}`);
		});
	} catch (err) {
		logger.error('Failed to start server', { error: err.message });
		process.exit(1);
	}
}

async function shutdown(signal) {
	logger.info(`Received ${signal}. Shutting down gracefully...`);
	if (server) {
		await new Promise((resolve) => server.close(resolve));
	}
	await disconnectDB().catch((e) => logger.error('Error disconnecting DB', { error: e.message }));
	process.exit(0);
}

if (require.main === module) {
	start();
	['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));
}

module.exports = { app, start };
