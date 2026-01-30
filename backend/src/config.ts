import dotenv from 'dotenv';
import { logger } from './utils/logger';

dotenv.config();

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  GMAIL_REDIRECT_URI: string;
  FRONTEND_URL: string;
}

function validateEnv(): EnvConfig {
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REDIRECT_URI',
  ];

  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    logger.error('Missing required environment variables:', missing);
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n\n` +
      'Please check your .env file and ensure all required variables are set.\n' +
      'See .env.example for reference.'
    );
  }

  // Warnings for default values
  if (process.env.JWT_SECRET === 'your-secret-key' || 
      process.env.JWT_SECRET === 'change-me-in-production') {
    warnings.push('JWT_SECRET is using default value - change this in production!');
  }

  if (process.env.GMAIL_CLIENT_ID?.includes('your-client-id')) {
    warnings.push('GMAIL_CLIENT_ID appears to be a placeholder - configure real credentials');
  }

  if (process.env.NODE_ENV === 'production') {
    if (process.env.DATABASE_URL?.includes('localhost')) {
      warnings.push('DATABASE_URL points to localhost in production');
    }
    if (process.env.REDIS_URL?.includes('localhost')) {
      warnings.push('REDIS_URL points to localhost in production');
    }
  }

  if (warnings.length > 0) {
    logger.warn('Environment configuration warnings:');
    warnings.forEach(warning => logger.warn(`  - ${warning}`));
  }

  return {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT || '3001', 10),
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID!,
    GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET!,
    GMAIL_REDIRECT_URI: process.env.GMAIL_REDIRECT_URI!,
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  };
}

export const config = validateEnv();

// Log configuration on startup (without sensitive data)
logger.info('Environment configuration loaded', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  FRONTEND_URL: config.FRONTEND_URL,
  hasGmailCredentials: Boolean(config.GMAIL_CLIENT_ID && config.GMAIL_CLIENT_SECRET),
  hasJWTSecret: Boolean(config.JWT_SECRET),
});
