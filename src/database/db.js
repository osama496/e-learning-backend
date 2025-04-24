import mongoose from "mongoose";
const MONGODB_URL =
  "mongodb+srv://Osama-Mehmood:Osama2521127@osama-mehmood.5r6tmeo.mongodb.net/?retryWrites=true&w=majority&appName=Osama-mehmood";
const db = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/eLearning`
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
