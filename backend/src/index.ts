import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { sequelize } from './database/connection';
import { logger } from './utils/logger';
import approvalRoutes from './routes/approval.routes';
import webhookRoutes from './routes/webhook.routes';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { cleanupExpiredApprovals } from './services/cleanup.service';

// Explizit .env Pfad setzen
const envPath = path.join(__dirname, '../.env');
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('Failed to load .env file:', envResult.error);
  process.exit(1);
}

console.log('Environment loaded from:', envPath);
console.log('SMTP_HOST from .env:', process.env.SMTP_HOST);

const app = express();
const PORT = process.env.PORT || 3101;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  frameguard: false,  // Deaktiviert X-Frame-Options komplett
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "frame-ancestors": ["*"]  // Erlaubt einbetten von allen Domains
    }
  }
}));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3100',
    'http://172.16.0.66:3100',
    'http://localhost:3100'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Serve static frontend files (production build)
app.use(express.static(path.join(__dirname, '../../frontend/build')));

app.use('/api/approvals', approvalRoutes);
app.use('/api/webhook', webhookRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch all handler: send back React's index.html file for any non-API routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/') && req.path !== '/health') {
    res.sendFile(path.join(__dirname, '../../frontend/build', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

app.use(errorHandler);

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');

    setInterval(cleanupExpiredApprovals,
      (parseInt(process.env.CLEANUP_INTERVAL_HOURS || '24') * 60 * 60 * 1000));

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on port ${PORT} (all interfaces)`);
      logger.info(`Local access: http://localhost:${PORT}`);
      logger.info(`Network access: http://172.16.0.66:${PORT}`);
      logger.info(`Frontend URL: ${process.env.FRONTEND_URL}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();