/*
  Warnings:

  - You are about to drop the `GoogleBlog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `blogName` on the `BlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `blogAccountId` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `blogAccountName` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `blogProvider` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `errorMessage` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `resultUrl` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Job` table. All the data in the column will be lost.
  - Made the column `content` on table `CoupangBlogJob` required. This step will fail if there are existing NULL values in that column.
  - Made the column `title` on table `CoupangBlogJob` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "GoogleBlog_googleOauthId_bloggerBlogId_key";

-- DropIndex
DROP INDEX "GoogleBlog_googleOauthId_idx";

-- DropIndex
DROP INDEX "GoogleBlog_name_key";

-- DropIndex
DROP INDEX "GoogleBlog_bloggerBlogName_key";

-- DropIndex
DROP INDEX "GoogleBlog_bloggerBlogId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "GoogleBlog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "BloggerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleOauthId" TEXT NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloggerAccount_googleOauthId_fkey" FOREIGN KEY ("googleOauthId") REFERENCES "GoogleOAuth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "tags" JSONB,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "resultUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "bloggerAccountId" TEXT,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BlogJob" ("content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt") SELECT "content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt" FROM "BlogJob";
DROP TABLE "BlogJob";
ALTER TABLE "new_BlogJob" RENAME TO "BlogJob";
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");
CREATE TABLE "new_CoupangBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coupangUrl" TEXT NOT NULL,
    "coupangAffiliateLink" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "tags" JSONB,
    "category" TEXT,
    "resultUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "bloggerAccountId" TEXT,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CoupangBlogJob" ("content", "coupangUrl", "createdAt", "id", "jobId", "publishedAt", "status", "tags", "title", "updatedAt") SELECT "content", "coupangUrl", "createdAt", "id", "jobId", "publishedAt", "status", "tags", "title", "updatedAt" FROM "CoupangBlogJob";
DROP TABLE "CoupangBlogJob";
ALTER TABLE "new_CoupangBlogJob" RENAME TO "CoupangBlogJob";
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL DEFAULT 'blog-info-posting',
    "subject" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "resultMsg" TEXT,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("completedAt", "createdAt", "desc", "id", "priority", "resultMsg", "scheduledAt", "startedAt", "status", "subject", "updatedAt") SELECT "completedAt", "createdAt", "desc", "id", "priority", "resultMsg", "scheduledAt", "startedAt", "status", "subject", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogId_key" ON "BloggerAccount"("bloggerBlogId");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogName_key" ON "BloggerAccount"("bloggerBlogName");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_name_key" ON "BloggerAccount"("name");

-- CreateIndex
CREATE INDEX "BloggerAccount_googleOauthId_idx" ON "BloggerAccount"("googleOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_googleOauthId_bloggerBlogId_key" ON "BloggerAccount"("googleOauthId", "bloggerBlogId");
