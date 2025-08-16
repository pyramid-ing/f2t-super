/*
  Warnings:

  - You are about to drop the column `provider` on the `IndexJob` table. All the data in the column will be lost.
  - You are about to drop the column `siteId` on the `IndexJob` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `IndexJob` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "SitemapConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sitemapType" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastParsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SitemapConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Index" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'request',
    "indexedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "siteId" INTEGER NOT NULL,
    CONSTRAINT "Index_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NaverAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "naverId" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isLoggedIn" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IndexJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "IndexJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_IndexJob" ("createdAt", "id", "jobId", "updatedAt") SELECT "createdAt", "id", "jobId", "updatedAt" FROM "IndexJob";
DROP TABLE "IndexJob";
ALTER TABLE "new_IndexJob" RENAME TO "IndexJob";
CREATE UNIQUE INDEX "IndexJob_jobId_key" ON "IndexJob"("jobId");
CREATE TABLE "new_Site" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "siteUrl" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "googleConfig" TEXT NOT NULL DEFAULT '{}',
    "naverConfig" TEXT NOT NULL DEFAULT '{}',
    "daumConfig" TEXT NOT NULL DEFAULT '{}',
    "bingConfig" TEXT NOT NULL DEFAULT '{}',
    "indexingConfig" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Site" ("bingConfig", "createdAt", "daumConfig", "description", "domain", "googleConfig", "id", "isActive", "name", "naverConfig", "siteUrl", "updatedAt") SELECT "bingConfig", "createdAt", "daumConfig", "description", "domain", "googleConfig", "id", "isActive", "name", "naverConfig", "siteUrl", "updatedAt" FROM "Site";
DROP TABLE "Site";
ALTER TABLE "new_Site" RENAME TO "Site";
CREATE UNIQUE INDEX "Site_domain_key" ON "Site"("domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "SitemapConfig_siteId_idx" ON "SitemapConfig"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Index_url_provider_key" ON "Index"("url", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "NaverAccount_naverId_key" ON "NaverAccount"("naverId");
