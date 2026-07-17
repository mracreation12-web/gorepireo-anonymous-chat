import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

console.log("===== MONGODB_URI =====");
console.log(process.env.MONGODB_URI);
console.log("=======================");

try {
    console.log("Trying to connect...");

    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log("✅ Connected");
    console.log(conn.connection.host);

} catch (err) {

    console.error("========== ERROR ==========");
    console.error(err);
    console.error("---------------------------");
    console.error("name:", err.name);
    console.error("message:", err.message);
    console.error("cause:", err.cause);
    console.error("reason:", err.reason);
    console.error("code:", err.code);
    console.error("===========================");

}