import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mediaRoutes from './routes/media.routes.js';

const app = express();

// Middlewares
app.use(helmet());
// Configure CORS for direct browser upload
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
  credentials: true
};
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());

// Routes
app.use('/', mediaRoutes);

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  // Lỗi từ Multer
  if (err.name === 'MulterError' && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 10MB)' });
  }

  // Lỗi Custom của chúng ta (kế thừa từ AppError ở error.js)
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  if (statusCode === 500) {
    console.error(err); // Log lỗi server
  }

  res.status(statusCode).json({ error: message });
});

export default app;
