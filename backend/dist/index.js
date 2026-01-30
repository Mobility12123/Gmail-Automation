"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = exports.prisma = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const client_1 = require("@prisma/client");
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_1 = __importDefault(require("./routes/auth"));
const emailAccounts_1 = __importDefault(require("./routes/emailAccounts"));
const rules_1 = __importDefault(require("./routes/rules"));
const activity_1 = __importDefault(require("./routes/activity"));
const stats_1 = __importDefault(require("./routes/stats"));
const auth_2 = require("./middleware/auth");
const jobs_1 = require("./jobs");
const emailPoller_1 = require("./services/emailPoller");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: config_1.config.FRONTEND_URL,
        credentials: true,
    },
});
exports.io = io;
exports.prisma = new client_1.PrismaClient();
// Middleware
app.use((0, helmet_1.default)());
// CORS - Allow multiple origins for production
const allowedOrigins = [
    config_1.config.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.some(allowed => origin.startsWith(allowed.replace(/\/$/, '')))) {
            return callback(null, true);
        }
        callback(null, false);
    },
    credentials: true,
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, morgan_1.default)('combined', { stream: { write: (message) => logger_1.logger.info(message.trim()) } }));
// Health check endpoints
app.get('/health', async (_req, res) => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
    }
});
app.get('/api/health', async (_req, res) => {
    try {
        await exports.prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'healthy', timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(503).json({ status: 'unhealthy', error: 'Database connection failed' });
    }
});
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/email-accounts', auth_2.authenticateToken, emailAccounts_1.default);
app.use('/api/rules', auth_2.authenticateToken, rules_1.default);
app.use('/api/activity', auth_2.authenticateToken, activity_1.default);
app.use('/api/stats', auth_2.authenticateToken, stats_1.default);
// Error handler
app.use(errorHandler_1.errorHandler);
// Socket.IO authentication
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    // Add token verification here
    next();
});
io.on('connection', (socket) => {
    logger_1.logger.info(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => {
        logger_1.logger.info(`Client disconnected: ${socket.id}`);
    });
});
async function startServer() {
    try {
        await exports.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
        // Initialize background jobs
        await (0, jobs_1.initializeJobs)();
        logger_1.logger.info('Background jobs initialized');
        // Start email polling
        await emailPoller_1.emailPoller.startPollingAll();
        logger_1.logger.info('Email poller started');
        httpServer.listen(config_1.config.PORT, () => {
            logger_1.logger.info(`Server running on port ${config_1.config.PORT}`);
            logger_1.logger.info(`Environment: ${config_1.config.NODE_ENV}`);
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Graceful shutdown
process.on('SIGTERM', async () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    emailPoller_1.emailPoller.stopPollingAll();
    await exports.prisma.$disconnect();
    httpServer.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
process.on('SIGINT', async () => {
    logger_1.logger.info('SIGINT received, shutting down gracefully');
    emailPoller_1.emailPoller.stopPollingAll();
    await exports.prisma.$disconnect();
    httpServer.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
startServer();
//# sourceMappingURL=index.js.map