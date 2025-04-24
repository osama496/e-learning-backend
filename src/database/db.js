import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const db = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}`
    );
    console.log(
      `\n MongoDB connected !! DB HOST :: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("Mongodb connection error", error);
    process.exit(1);
  }
};

export default db;
