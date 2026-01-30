import { Router } from 'express';
import { prisma } from '../index';
import { gmailService } from '../services/gmail.service';
import { AuthRequest } from '../middleware/auth';
import { BadRequestError, NotFoundError, ConflictError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ActivityType } from '@prisma/client';

const router = Router();

// Get all email accounts
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose tokens
    const sanitizedAccounts = accounts.map(account => ({
      id: account.id,
      email: account.email,
      provider: account.provider,
      isActive: account.isActive,
      lastChecked: account.lastChecked,
      createdAt: account.createdAt,
    }));

    res.json({ accounts: sanitizedAccounts });
  } catch (error) {
    next(error);
  }
});

// Get single email account
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.emailAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!account) {
      throw new NotFoundError('Email account not found');
    }

    res.json({
      account: {
        id: account.id,
        email: account.email,
        provider: account.provider,
        isActive: account.isActive,
        lastChecked: account.lastChecked,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Connect email account
router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { email, accessToken, refreshToken, expiresIn } = req.body;

    if (!email || !accessToken) {
      throw new BadRequestError('Email and access token are required');
    }

    // Check if account already exists
    const existingAccount = await prisma.emailAccount.findFirst({
      where: {
        userId: req.userId!,
        email,
      },
    });

    if (existingAccount) {
      // Update existing account instead of throwing error
      logger.info(`Updating existing email account: ${email}`);
      
      // Calculate token expiry safely
      let tokenExpiry: Date;
      if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0 && expiresIn < 86400) {
        tokenExpiry = new Date(Date.now() + expiresIn * 1000);
      } else {
        tokenExpiry = new Date(Date.now() + 3600 * 1000);
      }

      // Set up Gmail watch
      let watchData = null;
      try {
        watchData = await gmailService.watchMailbox(accessToken);
      } catch (error) {
        logger.warn('Failed to set up Gmail watch, will use polling');
      }

      // Parse watch expiry safely
      let watchExpiry = null;
      if (watchData?.expiration) {
        const expiryTimestamp = parseInt(watchData.expiration);
        const maxExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
        if (expiryTimestamp > 0 && expiryTimestamp <= maxExpiry) {
          watchExpiry = new Date(expiryTimestamp);
        }
      }

      // Update the account
      const updatedAccount = await prisma.emailAccount.update({
        where: { id: existingAccount.id },
        data: {
          accessToken,
          refreshToken: refreshToken || existingAccount.refreshToken,
          tokenExpiry,
          historyId: watchData?.historyId || existingAccount.historyId,
          watchExpiry,
          isActive: true,
        },
      });

      return res.json({
        account: {
          id: updatedAccount.id,
          email: updatedAccount.email,
          provider: updatedAccount.provider,
          isActive: updatedAccount.isActive,
          lastChecked: updatedAccount.lastChecked,
          createdAt: updatedAccount.createdAt,
        },
      });
    }

    // Calculate token expiry safely
    let tokenExpiry: Date;
    if (expiresIn && typeof expiresIn === 'number' && expiresIn > 0 && expiresIn < 86400) {
      // expiresIn is in seconds and should be reasonable (less than 1 day = 86400 seconds)
      tokenExpiry = new Date(Date.now() + expiresIn * 1000);
    } else {
      // Default to 1 hour from now
      tokenExpiry = new Date(Date.now() + 3600 * 1000);
      logger.warn('Invalid or missing expiresIn, using default 1 hour', { expiresIn });
    }

    // Set up Gmail watch (optional, will fallback to polling)
    let watchData = null;
    try {
      watchData = await gmailService.watchMailbox(accessToken);
    } catch (error) {
      logger.warn('Failed to set up Gmail watch, will use polling');
    }

    // Parse watch expiry safely
    let watchExpiry = null;
    if (watchData?.expiration) {
      const expiryTimestamp = parseInt(watchData.expiration);
      // Gmail returns timestamp in milliseconds, validate it's reasonable (within 7 days)
      const maxExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000);
      if (expiryTimestamp > 0 && expiryTimestamp <= maxExpiry) {
        watchExpiry = new Date(expiryTimestamp);
      } else {
        logger.warn('Invalid watch expiry from Gmail, using null', { expiration: watchData.expiration });
      }
    }

    // Create account
    const account = await prisma.emailAccount.create({
      data: {
        userId: req.userId!,
        email,
        provider: 'gmail',
        accessToken,
        refreshToken,
        tokenExpiry,
        historyId: watchData?.historyId || null,
        watchExpiry,
      },
    });

    // Create default auto-accept rule with confirmation for orders
    try {
      await prisma.rule.create({
        data: {
          userId: req.userId!,
          emailAccountId: account.id,
          name: `Auto-accept & confirm orders from ${email}`,
          description: 'Automatically accepts all order-related emails and sends confirmation',
          conditions: {
            matchSubject: 'order',
          } as any,
          action: 'SEND_CONFIRMATION',
          confirmationSubject: 'Order Confirmed! #{{orderNumber}}',
          confirmationBody: `Hi {{customerName}},

🎉 Great news! Your order has been confirmed!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 ORDER DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Order Number: #{{orderNumber}}
Order Date: {{orderDate}}
Product: {{product}}
Quantity: {{quantity}}
Total Amount: {{price}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ What's Next?
• Your order is being processed
• You'll receive shipping updates via email
• Expected delivery: 3-5 business days

📞 Need Help?
Simply reply to this email and we'll get back to you within 24 hours.

Thank you for shopping with us!

Best regards,
The Store Team`,
          priority: 1,
          isActive: true,
        },
      });
      logger.info(`Default rule created for email account: ${email}`);
    } catch (ruleError) {
      logger.warn(`Failed to create default rule for ${email}`, ruleError);
      // Don't fail account creation if rule creation fails
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.userId!,
        emailAccountId: account.id,
        type: ActivityType.ACCOUNT_CONNECTED,
        title: 'Email account connected',
        description: `Connected ${email}`,
      },
    });

    logger.info(`Email account connected: ${email} for user ${req.userId}`);

    res.status(201).json({
      account: {
        id: account.id,
        email: account.email,
        provider: account.provider,
        isActive: account.isActive,
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update email account
router.patch('/:id', async (req: AuthRequest, res, next) => {
  try {
    const { isActive } = req.body;

    const account = await prisma.emailAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!account) {
      throw new NotFoundError('Email account not found');
    }

    const updatedAccount = await prisma.emailAccount.update({
      where: { id: req.params.id },
      data: { isActive },
    });

    logger.info(`Email account updated: ${account.email}`);

    res.json({
      account: {
        id: updatedAccount.id,
        email: updatedAccount.email,
        provider: updatedAccount.provider,
        isActive: updatedAccount.isActive,
        createdAt: updatedAccount.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Delete email account
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.emailAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!account) {
      throw new NotFoundError('Email account not found');
    }

    await prisma.emailAccount.delete({
      where: { id: req.params.id },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: req.userId!,
        type: ActivityType.ACCOUNT_DISCONNECTED,
        title: 'Email account disconnected',
        description: `Disconnected ${account.email}`,
      },
    });

    logger.info(`Email account deleted: ${account.email}`);

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Test email account connection
router.post('/:id/test', async (req: AuthRequest, res, next) => {
  try {
    const account = await prisma.emailAccount.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!account) {
      throw new NotFoundError('Email account not found');
    }

    // Try to fetch recent messages
    const messages = await gmailService.getMessages(account.accessToken, 5);

    res.json({
      success: true,
      messageCount: messages.length,
      lastChecked: new Date(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
