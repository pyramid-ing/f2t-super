-- CreateTable
CREATE TABLE "AgodaBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agodaUrls" JSONB,
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
    CONSTRAINT "AgodaBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AgodaBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgodaBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AgodaBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AgodaBlogJob_jobId_key" ON "AgodaBlogJob"("jobId");
