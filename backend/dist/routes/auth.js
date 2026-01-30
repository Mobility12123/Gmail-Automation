"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../index");
const gmail_service_1 = require("../services/gmail.service");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// Register
router.post('/register', async (req, res, next) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            throw new errorHandler_1.BadRequestError('Email and password are required');
        }
        // Check if user exists
        const existingUser = await index_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            throw new errorHandler_1.ConflictError('User already exists');
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create user
        const user = await index_1.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
            },
        });
        // Generate token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        logger_1.logger.info(`User registered: ${email}`);
        res.status(201).json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Login
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new errorHandler_1.BadRequestError('Email and password are required');
        }
        // Find user
        const user = await index_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            throw new errorHandler_1.UnauthorizedError('Invalid credentials');
        }
        // Verify password
        const isValidPassword = await bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword) {
            throw new errorHandler_1.UnauthorizedError('Invalid credentials');
        }
        // Generate token
        const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        logger_1.logger.info(`User logged in: ${email}`);
        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
// Get Gmail OAuth URL
router.get('/gmail/url', (_req, res) => {
    const authUrl = gmail_service_1.gmailService.getAuthUrl();
    res.json({ authUrl });
});
// Gmail OAuth callback
router.get('/gmail/callback', async (req, res, next) => {
    try {
        const { code } = req.query;
        if (!code) {
            throw new errorHandler_1.BadRequestError('Authorization code is required');
        }
        // Exchange code for tokens
        const tokens = await gmail_service_1.gmailService.getTokensFromCode(code);
        // Get user email
        const email = await gmail_service_1.gmailService.getUserEmail(tokens.access_token);
        logger_1.logger.info(`Gmail OAuth callback received for: ${email}`);
        // Calculate expires_in from expiry_date (convert from timestamp to seconds)
        let expiresIn = 3600; // default 1 hour
        if (tokens.expiry_date) {
            const expiryTimestamp = typeof tokens.expiry_date === 'number'
                ? tokens.expiry_date
                : parseInt(tokens.expiry_date);
            const secondsUntilExpiry = Math.floor((expiryTimestamp - Date.now()) / 1000);
            if (secondsUntilExpiry > 0 && secondsUntilExpiry < 86400) {
                expiresIn = secondsUntilExpiry;
            }
        }
        // Redirect to frontend with tokens
        // In production, use secure state parameter to identify user
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/oauth/callback?` +
            `access_token=${tokens.access_token}&` +
            `refresh_token=${tokens.refresh_token || ''}&` +
            `email=${email}&` +
            `expires_in=${expiresIn}`);
    }
    catch (error) {
        next(error);
    }
});
// Verify token
router.get('/verify', async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            throw new errorHandler_1.UnauthorizedError('No token provided');
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await index_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true, email: true, name: true },
        });
        if (!user) {
            throw new errorHandler_1.UnauthorizedError('User not found');
        }
        res.json({ user });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map