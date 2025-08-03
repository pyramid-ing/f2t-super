/*
  Warnings:

  - You are about to drop the column `bloggerBlogId` on the `BlogJob` table. All the data in the column will be lost.
  - You are about to drop the column `bloggerBlogName` on the `BlogJob` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "googleBlogId" TEXT,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_googleBlogId_fkey" FOREIGN KEY ("googleBlogId") REFERENCES "GoogleBlog" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BlogJob" ("content", "createdAt", "googleBlogId", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt") SELECT "content", "createdAt", "googleBlogId", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt" FROM "BlogJob";
DROP TABLE "BlogJob";
ALTER TABLE "new_BlogJob" RENAME TO "BlogJob";
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");
CREATE UNIQUE INDEX "BlogJob_googleBlogId_key" ON "BlogJob"("googleBlogId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
