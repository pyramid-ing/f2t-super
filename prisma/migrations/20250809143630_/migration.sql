/*
  Warnings:

  - You are about to drop the column `coupangUrl` on the `CoupangBlogJob` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CoupangBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coupangUrls" JSONB,
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
    "bloggerAccountId" INTEGER,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CoupangBlogJob" ("bloggerAccountId", "category", "content", "coupangAffiliateLink", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId") SELECT "bloggerAccountId", "category", "content", "coupangAffiliateLink", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId" FROM "CoupangBlogJob";
DROP TABLE "CoupangBlogJob";
ALTER TABLE "new_CoupangBlogJob" RENAME TO "CoupangBlogJob";
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
