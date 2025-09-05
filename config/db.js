const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  if (isConnected) return mongoose.connection;

  const uri = process.env.DATABASE_URL
  if (!uri) {
    throw new Error('DATABASE_URL (or MONGODB_URI) is not set');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    // options can be extended here
  });

  isConnected = true;
  return mongoose.connection;
}

function disconnectDB() {
  isConnected = false;
  return mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
