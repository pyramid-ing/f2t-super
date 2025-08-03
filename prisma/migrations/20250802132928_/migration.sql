/*
  Warnings:

  - You are about to drop the column `affiliateUrl` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `blogPlatform` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `productPrice` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `productTitle` on the `CoupangBlogJob` table. All the data in the column will be lost.
  - Added the required column `blogProvider` to the `CoupangBlogJob` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoupangBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blogProvider" TEXT NOT NULL,
    "blogAccountId" TEXT,
    "blogAccountName" TEXT,
    "coupangUrl" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "thumbnail" TEXT,
    "tags" JSONB,
    "images" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CoupangBlogJob" ("blogAccountId", "blogAccountName", "content", "coupangUrl", "createdAt", "id", "images", "jobId", "publishedAt", "status", "tags", "thumbnail", "title", "updatedAt") SELECT "blogAccountId", "blogAccountName", "content", "coupangUrl", "createdAt", "id", "images", "jobId", "publishedAt", "status", "tags", "thumbnail", "title", "updatedAt" FROM "CoupangBlogJob";
DROP TABLE "CoupangBlogJob";
ALTER TABLE "new_CoupangBlogJob" RENAME TO "CoupangBlogJob";
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
