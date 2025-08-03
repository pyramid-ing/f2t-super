/*
  Warnings:

  - You are about to drop the column `bloggerBlogName` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `googleOauthId` on the `Settings` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "bloggerBlogName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerBlogName_fkey" FOREIGN KEY ("bloggerBlogName") REFERENCES "GoogleBlog" ("name") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BlogJob" ("bloggerBlogName", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt") SELECT "bloggerBlogName", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt" FROM "BlogJob";
DROP TABLE "BlogJob";
ALTER TABLE "new_BlogJob" RENAME TO "BlogJob";
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("createdAt", "data", "id", "updatedAt") SELECT "createdAt", "data", "id", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
