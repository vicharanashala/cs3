
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import faqRoutes from './routes/faq.routes.js';
import aiRoutes from './routes/ai.routes.js';
import queryRoutes from './routes/query.routes.js';
import adminRoutes from './routes/admin.routes.js';
import communityRoutes from './routes/community.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Request body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS
const allowedOrigin = process.env.NODE_ENV === 'development'
  ? 'http://localhost:5173'
  : (process.env.FRONTEND_URL || 'http://localhost:5173');

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

// Server health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date() 
  });
});

// Mount routers
app.use('/api/faq', faqRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/community', communityRoutes);

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to React Router for all non-API routes
app.get('*', (req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    next();
  }
});

// Global Error Handler (must be mounted last)
app.use(errorHandler);

// Start server listening
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[Server] Samagama FAQ Backend listening on port ${PORT} (${process.env.NODE_ENV || 'development'} mode)`);
});
export default app;
