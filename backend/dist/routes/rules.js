"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Get all rules
router.get('/', async (req, res, next) => {
    try {
        const { emailAccountId } = req.query;
        const where = { userId: req.userId };
        if (emailAccountId) {
            where.emailAccountId = emailAccountId;
        }
        const rules = await index_1.prisma.rule.findMany({
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
    }
    catch (error) {
        next(error);
    }
});
// Get single rule
router.get('/:id', async (req, res, next) => {
    try {
        const rule = await index_1.prisma.rule.findFirst({
            where: {
                id: req.params.id,
                userId: req.userId,
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
            throw new errorHandler_1.NotFoundError('Rule not found');
        }
        res.json({ rule });
    }
    catch (error) {
        next(error);
    }
});
// Create rule
router.post('/', async (req, res, next) => {
    try {
        const { emailAccountId, name, description, matchSubject, matchFrom, matchBody, action, priority, isActive, confirmationSubject, confirmationBody, } = req.body;
        if (!emailAccountId || !name) {
            throw new errorHandler_1.BadRequestError('Email account and name are required');
        }
        // At least one match condition required
        if (!matchSubject && !matchFrom && !matchBody) {
            throw new errorHandler_1.BadRequestError('At least one match condition is required');
        }
        // Verify email account belongs to user
        const emailAccount = await index_1.prisma.emailAccount.findFirst({
            where: {
                id: emailAccountId,
                userId: req.userId,
            },
        });
        if (!emailAccount) {
            throw new errorHandler_1.ForbiddenError('Email account not found or unauthorized');
        }
        // Validate confirmation fields if action is SEND_CONFIRMATION
        if (action === 'SEND_CONFIRMATION' && (!confirmationSubject || !confirmationBody)) {
            throw new errorHandler_1.BadRequestError('Confirmation subject and body are required for SEND_CONFIRMATION action');
        }
        // Create rule
        const rule = await index_1.prisma.rule.create({
            data: {
                userId: req.userId,
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
        logger_1.logger.info(`Rule created: ${name} for ${emailAccount.email}`);
        res.status(201).json({ rule });
    }
    catch (error) {
        next(error);
    }
});
// Update rule
router.patch('/:id', async (req, res, next) => {
    try {
        const { name, description, matchSubject, matchFrom, matchBody, action, priority, isActive, confirmationSubject, confirmationBody, } = req.body;
        const existingRule = await index_1.prisma.rule.findFirst({
            where: {
                id: req.params.id,
                userId: req.userId,
            },
        });
        if (!existingRule) {
            throw new errorHandler_1.NotFoundError('Rule not found');
        }
        // Validate confirmation fields if action is SEND_CONFIRMATION
        if (action === 'SEND_CONFIRMATION' && (!confirmationSubject || !confirmationBody)) {
            throw new errorHandler_1.BadRequestError('Confirmation subject and body are required for SEND_CONFIRMATION action');
        }
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (description !== undefined)
            updateData.description = description;
        if (matchSubject !== undefined || matchFrom !== undefined || matchBody !== undefined) {
            const existingConditions = existingRule.conditions || {};
            updateData.conditions = {
                matchSubject: matchSubject !== undefined ? matchSubject : existingConditions.matchSubject,
                matchFrom: matchFrom !== undefined ? matchFrom : existingConditions.matchFrom,
                matchBody: matchBody !== undefined ? matchBody : existingConditions.matchBody,
            };
        }
        if (action !== undefined)
            updateData.action = action;
        if (priority !== undefined)
            updateData.priority = priority;
        if (isActive !== undefined)
            updateData.isActive = isActive;
        if (confirmationSubject !== undefined)
            updateData.confirmationSubject = confirmationSubject;
        if (confirmationBody !== undefined)
            updateData.confirmationBody = confirmationBody;
        const rule = await index_1.prisma.rule.update({
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
        logger_1.logger.info(`Rule updated: ${rule.name}`);
        res.json({ rule });
    }
    catch (error) {
        next(error);
    }
});
// Delete rule
router.delete('/:id', async (req, res, next) => {
    try {
        const rule = await index_1.prisma.rule.findFirst({
            where: {
                id: req.params.id,
                userId: req.userId,
            },
        });
        if (!rule) {
            throw new errorHandler_1.NotFoundError('Rule not found');
        }
        await index_1.prisma.rule.delete({
            where: { id: req.params.id },
        });
        logger_1.logger.info(`Rule deleted: ${rule.name}`);
        res.json({ message: 'Rule deleted successfully' });
    }
    catch (error) {
        next(error);
    }
});
// Test rule against sample email
router.post('/:id/test', async (req, res, next) => {
    try {
        const { sampleEmail } = req.body;
        if (!sampleEmail) {
            throw new errorHandler_1.BadRequestError('Sample email is required');
        }
        const rule = await index_1.prisma.rule.findFirst({
            where: {
                id: req.params.id,
                userId: req.userId,
            },
        });
        if (!rule) {
            throw new errorHandler_1.NotFoundError('Rule not found');
        }
        // Simple rule matching logic
        const conditions = rule.conditions;
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
    }
    catch (error) {
        next(error);
    }
});
// Get rule statistics
router.get('/:id/stats', async (req, res, next) => {
    try {
        const rule = await index_1.prisma.rule.findFirst({
            where: {
                id: req.params.id,
                userId: req.userId,
            },
        });
        if (!rule) {
            throw new errorHandler_1.NotFoundError('Rule not found');
        }
        const totalProcessed = await index_1.prisma.processedEmail.count({
            where: { ruleId: rule.id },
        });
        const accepted = await index_1.prisma.processedEmail.count({
            where: {
                ruleId: rule.id,
                status: 'ACCEPTED',
            },
        });
        const failed = await index_1.prisma.processedEmail.count({
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
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=rules.js.map