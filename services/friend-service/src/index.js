import express from "express";
import dotenv from "dotenv";

import friendRoutes from "./routes/friend.route.js";
import { initDatabase } from "./config/db.js";

dotenv.config();

const app = express();

app.use(express.json());

app.use("/api/friends", friendRoutes);

const PORT = process.env.PORT || 5002;

await initDatabase();

app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok", service: "friend-service" });
});

app.listen(PORT, () => {
    console.log("Server is running on port: ", PORT);
});