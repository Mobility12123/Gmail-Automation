-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'REGEX', 'NOT_EQUALS', 'NOT_CONTAINS');

-- CreateEnum
CREATE TYPE "RuleLogic" AS ENUM ('AND', 'OR');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'ACCEPTED', 'FAILED', 'SKIPPED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL_RECEIVED', 'EMAIL_PROCESSED', 'ORDER_ACCEPTED', 'ORDER_FAILED', 'RULE_MATCHED', 'RULE_SKIPPED', 'ACCOUNT_CONNECTED', 'ACCOUNT_DISCONNECTED', 'ERROR');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'gmail',
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" TIMESTAMP(3),
    "watchExpiry" TIMESTAMP(3),
    "historyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "logic" "RuleLogic" NOT NULL DEFAULT 'AND',
    "autoAccept" BOOLEAN NOT NULL DEFAULT true,
    "markAsRead" BOOLEAN NOT NULL DEFAULT false,
    "addLabel" TEXT,
    "matchCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "lastMatched" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_emails" (
    "id" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "ruleId" TEXT,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "subject" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT[],
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "bodyPreview" TEXT,
    "acceptLink" TEXT,
    "status" "ProcessingStatus" NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAccountId" TEXT,
    "processedEmailId" TEXT,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_status" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "isHealthy" BOOLEAN NOT NULL DEFAULT true,
    "lastCheck" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "metadata" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "email_accounts_userId_idx" ON "email_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "email_accounts_userId_email_key" ON "email_accounts"("userId", "email");

-- CreateIndex
CREATE INDEX "rules_userId_idx" ON "rules"("userId");

-- CreateIndex
CREATE INDEX "rules_emailAccountId_idx" ON "rules"("emailAccountId");

-- CreateIndex
CREATE INDEX "rules_isActive_idx" ON "rules"("isActive");

-- CreateIndex
CREATE INDEX "processed_emails_emailAccountId_idx" ON "processed_emails"("emailAccountId");

-- CreateIndex
CREATE INDEX "processed_emails_status_idx" ON "processed_emails"("status");

-- CreateIndex
CREATE INDEX "processed_emails_receivedAt_idx" ON "processed_emails"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "processed_emails_emailAccountId_messageId_key" ON "processed_emails"("emailAccountId", "messageId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_emailAccountId_idx" ON "activity_logs"("emailAccountId");

-- CreateIndex
CREATE INDEX "activity_logs_type_idx" ON "activity_logs"("type");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_status_serviceName_key" ON "system_status"("serviceName");

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_emails" ADD CONSTRAINT "processed_emails_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "email_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_processedEmailId_fkey" FOREIGN KEY ("processedEmailId") REFERENCES "processed_emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
