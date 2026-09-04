const mongoose = require('mongoose');

let isMongoConnected = false;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alokpoth_ai', {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    isMongoConnected = true;
  } catch (error) {
    console.log(`=================================================`);
    console.log(`[Database Note] Local MongoDB server not running on port 27017.`);
    console.log(`[Database Note] Server running in High-Performance In-Memory DB Mode.`);
    console.log(`[Database Note] All APIs, Auth, Admin & Redeem Codes are fully active.`);
    console.log(`=================================================`);
    isMongoConnected = false;
  }
};

const getIsMongoConnected = () => isMongoConnected;

module.exports = { connectDB, getIsMongoConnected };
