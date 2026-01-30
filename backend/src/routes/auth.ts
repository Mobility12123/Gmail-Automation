import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';
import { gmailService } from '../services/gmail.service';
import { BadRequestError, ConflictError, UnauthorizedError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    });

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`User registered: ${email}`);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new BadRequestError('Email and password are required');
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logger.info(`User logged in: ${email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get Gmail OAuth URL
router.get('/gmail/url', (_req: Request, res: Response) => {
  const authUrl = gmailService.getAuthUrl();
  res.json({ authUrl });
});

// Gmail OAuth callback
router.get('/gmail/callback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.query;

    if (!code) {
      throw new BadRequestError('Authorization code is required');
    }

    // Exchange code for tokens
    const tokens = await gmailService.getTokensFromCode(code as string);

    // Get user email
    const email = await gmailService.getUserEmail(tokens.access_token!);

    logger.info(`Gmail OAuth callback received for: ${email}`);

    // Calculate expires_in from expiry_date (convert from timestamp to seconds)
    let expiresIn = 3600; // default 1 hour
    if (tokens.expiry_date) {
      const expiryTimestamp = typeof tokens.expiry_date === 'number' 
        ? tokens.expiry_date 
        : parseInt(tokens.expiry_date as string);
      const secondsUntilExpiry = Math.floor((expiryTimestamp - Date.now()) / 1000);
      if (secondsUntilExpiry > 0 && secondsUntilExpiry < 86400) {
        expiresIn = secondsUntilExpiry;
      }
    }

    // Redirect to frontend with tokens
    // In production, use secure state parameter to identify user
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(
      `${frontendUrl}/oauth/callback?` +
      `access_token=${tokens.access_token}&` +
      `refresh_token=${tokens.refresh_token || ''}&` +
      `email=${email}&` +
      `expires_in=${expiresIn}`
    );
  } catch (error) {
    next(error);
  }
});

// Verify token
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export default router;
