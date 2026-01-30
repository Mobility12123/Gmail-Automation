import { Router, Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../middleware/auth';
import { BadRequestError, NotFoundError, ForbiddenError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

// Get all rules
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { emailAccountId } = req.query;

    const where: any = { userId: req.userId! };
    if (emailAccountId) {
      where.emailAccountId = emailAccountId as string;
    }

    const rules = await prisma.rule.findMany({
      where,
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

// Get single rule
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rule = await prisma.rule.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    res.json({ rule });
  } catch (error) {
    next(error);
  }
});

// Create rule
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      emailAccountId,
      name,
      description,
      matchSubject,
      matchFrom,
      matchBody,
      action,
      priority,
      isActive,
      confirmationSubject,
      confirmationBody,
    } = req.body;

    if (!emailAccountId || !name) {
      throw new BadRequestError('Email account and name are required');
    }

    // At least one match condition required
    if (!matchSubject && !matchFrom && !matchBody) {
      throw new BadRequestError('At least one match condition is required');
    }

    // Verify email account belongs to user
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        id: emailAccountId,
        userId: req.userId!,
      },
    });

    if (!emailAccount) {
      throw new ForbiddenError('Email account not found or unauthorized');
    }

    // Validate confirmation fields if action is SEND_CONFIRMATION
    if (action === 'SEND_CONFIRMATION' && (!confirmationSubject || !confirmationBody)) {
      throw new BadRequestError('Confirmation subject and body are required for SEND_CONFIRMATION action');
    }

    // Create rule
    const rule = await prisma.rule.create({
      data: {
        userId: req.userId!,
        emailAccountId,
        name,
        description: description || '',
        conditions: {
          matchSubject: matchSubject || undefined,
          matchFrom: matchFrom || undefined,
          matchBody: matchBody || undefined,
        },
        action: action || 'ACCEPT',
        priority: priority || 1,
        isActive: isActive !== undefined ? isActive : true,
        confirmationSubject: confirmationSubject || undefined,
        confirmationBody: confirmationBody || undefined,
      },
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
      },
    });

    logger.info(`Rule created: ${name} for ${emailAccount.email}`);

    res.status(201).json({ rule });
  } catch (error) {
    next(error);
  }
});

// Update rule
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      description,
      matchSubject,
      matchFrom,
      matchBody,
      action,
      priority,
      isActive,
      confirmationSubject,
      confirmationBody,
    } = req.body;

    const existingRule = await prisma.rule.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!existingRule) {
      throw new NotFoundError('Rule not found');
    }

    // Validate confirmation fields if action is SEND_CONFIRMATION
    if (action === 'SEND_CONFIRMATION' && (!confirmationSubject || !confirmationBody)) {
      throw new BadRequestError('Confirmation subject and body are required for SEND_CONFIRMATION action');
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (matchSubject !== undefined || matchFrom !== undefined || matchBody !== undefined) {
      const existingConditions = existingRule.conditions as any || {};
      updateData.conditions = {
        matchSubject: matchSubject !== undefined ? matchSubject : existingConditions.matchSubject,
        matchFrom: matchFrom !== undefined ? matchFrom : existingConditions.matchFrom,
        matchBody: matchBody !== undefined ? matchBody : existingConditions.matchBody,
      };
    }
    if (action !== undefined) updateData.action = action;
    if (priority !== undefined) updateData.priority = priority;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (confirmationSubject !== undefined) updateData.confirmationSubject = confirmationSubject;
    if (confirmationBody !== undefined) updateData.confirmationBody = confirmationBody;

    const rule = await prisma.rule.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        emailAccount: {
          select: {
            email: true,
          },
        },
      },
    });

    logger.info(`Rule updated: ${rule.name}`);

    res.json({ rule });
  } catch (error) {
    next(error);
  }
});

// Delete rule
router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const rule = await prisma.rule.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    await prisma.rule.delete({
      where: { id: req.params.id },
    });

    logger.info(`Rule deleted: ${rule.name}`);

    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// Test rule against sample email
router.post('/:id/test', async (req: AuthRequest, res: any, next: any) => {
  try {
    const { sampleEmail } = req.body;

    if (!sampleEmail) {
      throw new BadRequestError('Sample email is required');
    }

    const rule = await prisma.rule.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    // Simple rule matching logic
    const conditions = rule.conditions as any;
    let matches = true;

    if (conditions?.matchSubject && sampleEmail.subject) {
      matches = matches && sampleEmail.subject.toLowerCase().includes(conditions.matchSubject.toLowerCase());
    }
    if (conditions?.matchFrom && sampleEmail.from) {
      matches = matches && sampleEmail.from.toLowerCase().includes(conditions.matchFrom.toLowerCase());
    }
    if (conditions?.matchBody && sampleEmail.body) {
      matches = matches && sampleEmail.body.toLowerCase().includes(conditions.matchBody.toLowerCase());
    }

    res.json({
      matches,
      rule: {
        id: rule.id,
        name: rule.name,
        conditions: rule.conditions,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get rule statistics
router.get('/:id/stats', async (req: AuthRequest, res: any, next: any) => {
  try {
    const rule = await prisma.rule.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId!,
      },
    });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    const totalProcessed = await prisma.processedEmail.count({
      where: { ruleId: rule.id },
    });

    const accepted = await prisma.processedEmail.count({
      where: {
        ruleId: rule.id,
        status: 'ACCEPTED',
      },
    });

    const failed = await prisma.processedEmail.count({
      where: {
        ruleId: rule.id,
        status: 'FAILED',
      },
    });

    res.json({
      stats: {
        matchCount: rule.matchCount,
        successCount: rule.successCount,
        failureCount: rule.failureCount,
        totalProcessed,
        accepted,
        failed,
        successRate: totalProcessed > 0 ? (accepted / totalProcessed) * 100 : 0,
        lastMatched: rule.lastMatched,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
