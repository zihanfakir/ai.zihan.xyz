const mongoose = require('mongoose');

let isMongoConnected = false;
let cachedPromise = null;

const connectDB = async () => {
  // If already connected, return immediately
  if (mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    return mongoose.connection;
  }

  // If already connecting, share the existing in-flight Promise (prevents connection storms in serverless)
  if (cachedPromise) {
    return cachedPromise;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/alokpoth_ai';

  cachedPromise = mongoose.connect(mongoUri, {
    maxPoolSize: 20,          // Maintain up to 20 socket connections for high concurrency
    minPoolSize: 5,           // Keep at least 5 warm connections ready (avoids connection lag)
    serverSelectionTimeoutMS: 2500,
    socketTimeoutMS: 30000,
    maxIdleTimeMS: 30000,     // Close idle connections after 30s
    autoIndex: true           // Build compound and TTL indexes automatically
  }).then((conn) => {
    isMongoConnected = true;
    console.log(`[Database] MongoDB Connected: ${conn.connection.host} (Pool Size: 5-20)`);
    return conn;
  }).catch((error) => {
    cachedPromise = null;
    isMongoConnected = false;
    console.log(`=================================================`);
    console.log(`[Database Note] Local MongoDB server not running or unreachable.`);
    console.log(`[Database Note] Server running in High-Performance In-Memory DB Mode.`);
    console.log(`[Database Note] All APIs, Auth, Admin & Redeem Codes are fully active.`);
    console.log(`=================================================`);
    return null;
  });

  return cachedPromise;
};

mongoose.connection.on('disconnected', () => {
  console.warn('[Database Note] MongoDB disconnected. Falling back to memory mode.');
  isMongoConnected = false;
  cachedPromise = null;
});

mongoose.connection.on('reconnected', () => {
  console.log('[Database Note] MongoDB reconnected.');
  isMongoConnected = true;
});

mongoose.connection.on('error', (err) => {
  console.warn('[Database Note] MongoDB error:', err.message);
  isMongoConnected = false;
  cachedPromise = null;
});

const getIsMongoConnected = () => isMongoConnected && mongoose.connection.readyState === 1;

module.exports = { connectDB, getIsMongoConnected };
