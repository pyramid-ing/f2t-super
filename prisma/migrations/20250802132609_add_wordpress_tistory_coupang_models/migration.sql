-- CreateTable
CREATE TABLE "WordPressAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "url" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TistoryAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "tistoryUrl" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "loginPassword" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CoupangBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coupangUrl" TEXT NOT NULL,
    "productTitle" TEXT,
    "productPrice" INTEGER,
    "affiliateUrl" TEXT,
    "blogPlatform" TEXT NOT NULL,
    "blogAccountId" TEXT,
    "blogAccountName" TEXT,
    "title" TEXT,
    "content" TEXT,
    "tags" JSONB,
    "thumbnail" TEXT,
    "images" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'blog-info-posting',
    "subject" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "resultMsg" TEXT,
    "resultUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("completedAt", "createdAt", "desc", "errorMessage", "id", "priority", "resultMsg", "resultUrl", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt") SELECT "completedAt", "createdAt", "desc", "errorMessage", "id", "priority", "resultMsg", "resultUrl", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");
