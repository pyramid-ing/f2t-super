/*
  Warnings:

  - You are about to drop the `BlogJob` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "BlogJob";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "InfoBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "tags" JSONB,
    "category" TEXT,
    "publishVisibility" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "resultUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "bloggerAccountId" INTEGER,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "InfoBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InfoBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InfoBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InfoBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InfoBlogJob_jobId_key" ON "InfoBlogJob"("jobId");
