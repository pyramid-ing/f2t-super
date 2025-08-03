/*
  Warnings:

  - Added the required column `bloggerBlogName` to the `GoogleBlog` table without a default value. This is not possible if the table is not empty.

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
    "bloggerBlogId" TEXT,
    "bloggerBlogName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerBlogId_fkey" FOREIGN KEY ("bloggerBlogId") REFERENCES "GoogleBlog" ("bloggerBlogId") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerBlogName_fkey" FOREIGN KEY ("bloggerBlogName") REFERENCES "GoogleBlog" ("bloggerBlogName") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BlogJob" ("bloggerBlogId", "bloggerBlogName", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt") SELECT "bloggerBlogId", "bloggerBlogName", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "status", "title", "updatedAt" FROM "BlogJob";
DROP TABLE "BlogJob";
ALTER TABLE "new_BlogJob" RENAME TO "BlogJob";
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");
CREATE TABLE "new_GoogleBlog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleOauthId" TEXT NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleBlog_googleOauthId_fkey" FOREIGN KEY ("googleOauthId") REFERENCES "GoogleOAuth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_GoogleBlog" ("bloggerBlogId", "createdAt", "description", "googleOauthId", "id", "isDefault", "name", "updatedAt") SELECT "bloggerBlogId", "createdAt", "description", "googleOauthId", "id", "isDefault", "name", "updatedAt" FROM "GoogleBlog";
DROP TABLE "GoogleBlog";
ALTER TABLE "new_GoogleBlog" RENAME TO "GoogleBlog";
CREATE UNIQUE INDEX "GoogleBlog_bloggerBlogId_key" ON "GoogleBlog"("bloggerBlogId");
CREATE UNIQUE INDEX "GoogleBlog_bloggerBlogName_key" ON "GoogleBlog"("bloggerBlogName");
CREATE UNIQUE INDEX "GoogleBlog_name_key" ON "GoogleBlog"("name");
CREATE INDEX "GoogleBlog_googleOauthId_idx" ON "GoogleBlog"("googleOauthId");
CREATE UNIQUE INDEX "GoogleBlog_googleOauthId_bloggerBlogId_key" ON "GoogleBlog"("googleOauthId", "bloggerBlogId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
