import { Router } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { ActivityType } from '@prisma/client';

const router = Router();

// Get activity logs
router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const { emailAccountId, type, limit = '50', offset = '0' } = req.query;

    const where: any = { userId: req.userId! };
    if (emailAccountId) {
      where.emailAccountId = emailAccountId as string;
    }
    if (type) {
      where.type = type as ActivityType;
    }

    const [activities, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          emailAccount: {
            select: {
              email: true,
            },
          },
          processedEmail: {
            select: {
              subject: true,
              from: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({
      activities,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

// Get recent activity (last 24 hours)
router.get('/recent', async (req: AuthRequest, res, next) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const activities = await prisma.activityLog.findMany({
      where: {
        userId: req.userId!,
        createdAt: {
          gte: oneDayAgo,
        },
      },
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Group by type
    const groupedByType = activities.reduce((acc, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      activities,
      summary: groupedByType,
      timeRange: '24h',
    });
  } catch (error) {
    next(error);
  }
});

// Get processed emails
router.get('/emails', async (req: AuthRequest, res, next) => {
  try {
    const { emailAccountId, status, limit = '50', offset = '0' } = req.query;

    // Build where clause
    const where: any = {
      emailAccount: {
        userId: req.userId!,
      },
    };

    if (emailAccountId) {
      where.emailAccountId = emailAccountId as string;
    }
    if (status) {
      where.status = status;
    }

    const [emails, total] = await Promise.all([
      prisma.processedEmail.findMany({
        where,
        include: {
          emailAccount: {
            select: {
              email: true,
            },
          },
          rule: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      }),
      prisma.processedEmail.count({ where }),
    ]);

    res.json({
      emails,
      total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

// Get single processed email
router.get('/emails/:id', async (req: AuthRequest, res, next) => {
  try {
    const email = await prisma.processedEmail.findFirst({
      where: {
        id: req.params.id,
        emailAccount: {
          userId: req.userId!,
        },
      },
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
        rule: {
          select: {
            name: true,
            conditions: true,
          },
        },
      },
    });

    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({ email });
  } catch (error) {
    next(error);
  }
});

export default router;
