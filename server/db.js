import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("MongoDB Full Error:");
    console.error(error);
    // Exit process with failure code if connection fails in development
    if (process.env.NODE_ENV === 'development') {
      process.exit(1);
    }
    throw error;
  }
};

export default connectDB;
