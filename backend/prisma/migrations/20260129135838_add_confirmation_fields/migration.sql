/*
  Warnings:

  - You are about to drop the column `addLabel` on the `rules` table. All the data in the column will be lost.
  - You are about to drop the column `autoAccept` on the `rules` table. All the data in the column will be lost.
  - You are about to drop the column `logic` on the `rules` table. All the data in the column will be lost.
  - You are about to drop the column `markAsRead` on the `rules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "rules" DROP COLUMN "addLabel",
DROP COLUMN "autoAccept",
DROP COLUMN "logic",
DROP COLUMN "markAsRead",
ADD COLUMN     "action" TEXT NOT NULL DEFAULT 'ACCEPT',
ADD COLUMN     "confirmationBody" TEXT,
ADD COLUMN     "confirmationSubject" TEXT;
