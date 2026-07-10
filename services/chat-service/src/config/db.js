import mongoose from 'mongoose';
import config from './index.js';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(config.MONGO_URI);
    console.log(`🔌 Connected to MongoDB for chat-service: ${conn.connection.host}/${conn.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

export default connectDB;
