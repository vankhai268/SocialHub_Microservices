import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js"
import { initDatabase } from "./config/db.js";

const app = express();

app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5001;

// Gọi tự động khởi tạo database
await initDatabase();

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.listen(PORT, () => {
    console.log("Server is running on port ", PORT);
})