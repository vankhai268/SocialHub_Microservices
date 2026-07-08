import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './config/db.js';
import postRoutes from './routes/post.routes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/', postRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global error in Post Service:', err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred in Post Service'
  });
});

const PORT = process.env.PORT || 5000;

// Initialize Database then start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Post Service is running on port ${PORT}`);
  });
});
