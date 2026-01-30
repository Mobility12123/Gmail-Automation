"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processEmailCheck = processEmailCheck;
const index_1 = require("../../index");
const index_2 = require("../../index");
const gmail_service_1 = require("../../services/gmail.service");
const queues_1 = require("../../queues");
const logger_1 = require("../../utils/logger");
const client_1 = require("@prisma/client");
// Inline helper to match rules against email
function matchesRule(emailData, rule) {
    const conditions = rule.conditions;
    if (!conditions || (typeof conditions === 'object' && Object.keys(conditions).length === 0)) {
        return false;
    }
    // Handle case where conditions might be a string
    let parsedConditions = conditions;
    if (typeof conditions === 'string') {
        try {
            parsedConditions = JSON.parse(conditions);
        }
        catch (e) {
            return false;
        }
    }
    const checks = [];
    // Check subject
    if (parsedConditions.matchSubject) {
        checks.push(emailData.subject.toLowerCase().includes(parsedConditions.matchSubject.toLowerCase()));
    }
    // Check from
    if (parsedConditions.matchFrom) {
        checks.push(emailData.from.toLowerCase().includes(parsedConditions.matchFrom.toLowerCase()));
    }
    // Check body
    if (parsedConditions.matchBody && emailData.body) {
        checks.push(emailData.body.toLowerCase().includes(parsedConditions.matchBody.toLowerCase()));
    }
    // If no conditions checked, don't match
    if (checks.length === 0) {
        return false;
    }
    // All checks must pass (AND logic)
    return checks.every(check => check === true);
}
// Find matching rules for an email
function findMatchingRules(emailData, rules) {
    return rules.filter(rule => matchesRule(emailData, rule));
}
// Extract accept link from email body
function extractAcceptLink(emailData) {
    const body = emailData.body || '';
    // Look for common accept/confirm link patterns
    const patterns = [
        /https?:\/\/[^\s<>"]*(?:accept|confirm|verify|approve)[^\s<>"]*/gi,
        /https?:\/\/[^\s<>"]*click[^\s<>"]*(?:here|confirm)[^\s<>"]*/gi,
        /href=["'](https?:\/\/[^"']*(?:accept|confirm)[^"']*)["']/gi,
    ];
    for (const pattern of patterns) {
        const matches = body.match(pattern);
        if (matches && matches.length > 0) {
            // Clean up the match
            let link = matches[0];
            link = link.replace(/href=["']/gi, '').replace(/["']$/g, '');
            return link;
        }
    }
    return null;
}
async function processEmailCheck(job) {
    const { emailAccountId } = job.data;
    try {
        // Get email account
        const account = await index_1.prisma.emailAccount.findUnique({
            where: { id: emailAccountId },
            include: {
                rules: {
                    where: { isActive: true },
                    orderBy: { priority: 'desc' },
                },
            },
        });
        if (!account || !account.isActive) {
            logger_1.logger.debug(`Account ${emailAccountId} not found or inactive`);
            return { processed: 0, skipped: 0 };
        }
        // Refresh token if needed
        let accessToken = account.accessToken;
        if (account.tokenExpiry && account.tokenExpiry < new Date()) {
            if (account.refreshToken) {
                try {
                    const tokens = await gmail_service_1.gmailService.refreshAccessToken(account.refreshToken);
                    accessToken = tokens.access_token;
                    // Update tokens in database
                    await index_1.prisma.emailAccount.update({
                        where: { id: emailAccountId },
                        data: {
                            accessToken,
                            tokenExpiry: tokens.expiry_date
                                ? new Date(tokens.expiry_date)
                                : new Date(Date.now() + 3600 * 1000),
                        },
                    });
                }
                catch (error) {
                    logger_1.logger.error(`Error refreshing token for ${account.email}:`, error);
                    return { error: 'Token refresh failed' };
                }
            }
            else {
                logger_1.logger.error(`No refresh token for ${account.email}`);
                return { error: 'No refresh token' };
            }
        }
        // Get recent emails (last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const query = `in:inbox after:${Math.floor(fiveMinutesAgo.getTime() / 1000)}`;
        const messages = await gmail_service_1.gmailService.getMessages(accessToken, 20, query);
        // Update last checked
        await index_1.prisma.emailAccount.update({
            where: { id: emailAccountId },
            data: { lastChecked: new Date() },
        });
        let processed = 0;
        let skipped = 0;
        for (const message of messages) {
            // Check if already processed
            const existing = await index_1.prisma.processedEmail.findFirst({
                where: {
                    emailAccountId,
                    messageId: message.id,
                },
            });
            if (existing) {
                skipped++;
                continue;
            }
            // Convert message to email data format
            const emailData = {
                from: message.from,
                to: message.to,
                subject: message.subject,
                body: message.body,
                labels: message.labels,
                date: message.date,
            };
            // Find matching rules
            const matchingRules = findMatchingRules(emailData, account.rules);
            if (matchingRules.length > 0) {
                const rule = matchingRules[0]; // Use highest priority rule
                // Extract accept link
                const acceptLink = extractAcceptLink(emailData);
                // Create processed email record
                const processedEmail = await index_1.prisma.processedEmail.create({
                    data: {
                        emailAccountId,
                        ruleId: rule.id,
                        messageId: message.id,
                        threadId: message.threadId,
                        subject: message.subject,
                        from: message.from,
                        to: message.to,
                        receivedAt: message.date,
                        bodyPreview: message.bodyPreview,
                        acceptLink,
                        status: acceptLink ? 'PENDING' : 'SKIPPED',
                        metadata: {
                            links: message.links,
                            snippet: message.snippet,
                        },
                    },
                });
                // Update rule stats
                await index_1.prisma.rule.update({
                    where: { id: rule.id },
                    data: {
                        matchCount: { increment: 1 },
                        lastMatched: new Date(),
                    },
                });
                // Log activity
                await index_1.prisma.activityLog.create({
                    data: {
                        userId: account.userId,
                        emailAccountId,
                        processedEmailId: processedEmail.id,
                        type: client_1.ActivityType.RULE_MATCHED,
                        title: 'Rule matched',
                        description: `Email from ${message.from} matched rule: ${rule.name}`,
                        metadata: {
                            ruleId: rule.id,
                            ruleName: rule.name,
                            subject: message.subject,
                        },
                    },
                });
                // If action is ACCEPT and we have an accept link, schedule order processing
                if (rule.action === 'ACCEPT' && acceptLink) {
                    await (0, queues_1.scheduleOrderProcessing)(emailAccountId, message.id);
                }
                // Emit real-time event
                index_2.io.emit('email:matched', {
                    emailAccountId,
                    processedEmailId: processedEmail.id,
                    rule: { id: rule.id, name: rule.name },
                    subject: message.subject,
                    from: message.from,
                });
                processed++;
            }
            else {
                // No matching rules - still log it
                await index_1.prisma.processedEmail.create({
                    data: {
                        emailAccountId,
                        messageId: message.id,
                        threadId: message.threadId,
                        subject: message.subject,
                        from: message.from,
                        to: message.to,
                        receivedAt: message.date,
                        bodyPreview: message.bodyPreview,
                        status: 'SKIPPED',
                    },
                });
                skipped++;
            }
        }
        logger_1.logger.info(`Email check completed for ${account.email}: ${processed} processed, ${skipped} skipped`);
        return { processed, skipped, total: messages.length };
    }
    catch (error) {
        logger_1.logger.error(`Error processing email check for ${emailAccountId}:`, error);
        throw error;
    }
}
//# sourceMappingURL=emailCheck.processor.js.map