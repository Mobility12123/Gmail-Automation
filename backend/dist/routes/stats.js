"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// Get dashboard statistics
router.get('/dashboard', async (req, res, next) => {
    try {
        const userId = req.userId;
        // Get counts
        const [emailAccountsCount, activeRulesCount, totalProcessedCount, acceptedCount, failedCount, last24hCount,] = await Promise.all([
            index_1.prisma.emailAccount.count({
                where: { userId, isActive: true },
            }),
            index_1.prisma.rule.count({
                where: { userId, isActive: true },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccount: { userId },
                },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccount: { userId },
                    status: client_1.ProcessingStatus.ACCEPTED,
                },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccount: { userId },
                    status: client_1.ProcessingStatus.FAILED,
                },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccount: { userId },
                    receivedAt: {
                        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                    },
                },
            }),
        ]);
        // Get recent activity
        const recentEmails = await index_1.prisma.processedEmail.findMany({
            where: {
                emailAccount: { userId },
            },
            include: {
                emailAccount: {
                    select: { email: true },
                },
                rule: {
                    select: { name: true },
                },
            },
            orderBy: { receivedAt: 'desc' },
            take: 10,
        });
        // Get processing stats by status
        const statusCounts = await index_1.prisma.processedEmail.groupBy({
            by: ['status'],
            where: {
                emailAccount: { userId },
            },
            _count: true,
        });
        // Get daily stats for last 7 days
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dailyStats = await index_1.prisma.$queryRaw `
      SELECT 
        DATE("receivedAt") as date,
        COUNT(*) as count
      FROM processed_emails pe
      JOIN email_accounts ea ON pe."emailAccountId" = ea.id
      WHERE ea."userId" = ${userId}
        AND pe."receivedAt" >= ${sevenDaysAgo}
      GROUP BY DATE("receivedAt")
      ORDER BY date ASC
    `;
        // Get top performing rules
        const topRules = await index_1.prisma.rule.findMany({
            where: { userId },
            orderBy: { successCount: 'desc' },
            take: 5,
            select: {
                id: true,
                name: true,
                matchCount: true,
                successCount: true,
                failureCount: true,
            },
        });
        // System health
        const systemStatus = await index_1.prisma.systemStatus.findMany({
            orderBy: { lastCheck: 'desc' },
        });
        res.json({
            overview: {
                emailAccounts: emailAccountsCount,
                activeRules: activeRulesCount,
                totalProcessed: totalProcessedCount,
                accepted: acceptedCount,
                failed: failedCount,
                successRate: totalProcessedCount > 0
                    ? ((acceptedCount / totalProcessedCount) * 100).toFixed(2)
                    : '0',
                last24h: last24hCount,
            },
            statusBreakdown: statusCounts.reduce((acc, item) => {
                acc[item.status] = Number(item._count);
                return acc;
            }, {}),
            dailyStats: dailyStats.map(stat => ({
                date: stat.date,
                count: Number(stat.count),
            })),
            recentEmails,
            topRules,
            systemHealth: systemStatus,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get email account statistics
router.get('/email-accounts/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const account = await index_1.prisma.emailAccount.findFirst({
            where: {
                id,
                userId: req.userId,
            },
        });
        if (!account) {
            res.status(404).json({ error: 'Email account not found' });
            return;
        }
        const [totalProcessed, accepted, failed, pending] = await Promise.all([
            index_1.prisma.processedEmail.count({
                where: { emailAccountId: id },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccountId: id,
                    status: client_1.ProcessingStatus.ACCEPTED,
                },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccountId: id,
                    status: client_1.ProcessingStatus.FAILED,
                },
            }),
            index_1.prisma.processedEmail.count({
                where: {
                    emailAccountId: id,
                    status: client_1.ProcessingStatus.PENDING,
                },
            }),
        ]);
        // Get hourly stats for last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const hourlyStats = await index_1.prisma.$queryRaw `
      SELECT 
        EXTRACT(HOUR FROM "receivedAt") as hour,
        COUNT(*) as count
      FROM processed_emails
      WHERE "emailAccountId" = ${id}
        AND "receivedAt" >= ${oneDayAgo}
      GROUP BY EXTRACT(HOUR FROM "receivedAt")
      ORDER BY hour ASC
    `;
        res.json({
            accountId: id,
            email: account.email,
            stats: {
                totalProcessed,
                accepted,
                failed,
                pending,
                successRate: totalProcessed > 0
                    ? ((accepted / totalProcessed) * 100).toFixed(2)
                    : '0',
            },
            hourlyStats: hourlyStats.map(stat => ({
                hour: stat.hour,
                count: Number(stat.count),
            })),
            lastChecked: account.lastChecked,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=stats.js.map