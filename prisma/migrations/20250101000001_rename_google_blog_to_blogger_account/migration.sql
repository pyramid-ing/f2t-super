-- Rename GoogleBlog to BloggerAccount and preserve data
-- Step 1: Create new BloggerAccount table with existing data
CREATE TABLE IF NOT EXISTS "BloggerAccount" (
    "id" TEXT NOT NULL,
    "googleOauthId" TEXT NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloggerAccount_pkey" PRIMARY KEY ("id")
);

-- Copy data from GoogleBlog to BloggerAccount if table exists
INSERT INTO "BloggerAccount" ("id", "googleOauthId", "bloggerBlogId", "bloggerBlogName", "name", "description", "isDefault", "createdAt", "updatedAt")
SELECT "id", "googleOauthId", "bloggerBlogId", "bloggerBlogName", "name", "description", "isDefault", "createdAt", "updatedAt"
FROM "GoogleBlog"
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='GoogleBlog');

-- Step 2: Update BlogJob table to add new reference fields
ALTER TABLE "BlogJob" ADD COLUMN "bloggerAccountId" TEXT;
ALTER TABLE "BlogJob" ADD COLUMN "wordpressAccountId" INTEGER;
ALTER TABLE "BlogJob" ADD COLUMN "tistoryAccountId" INTEGER;
ALTER TABLE "BlogJob" ADD COLUMN "tags" TEXT;
ALTER TABLE "BlogJob" ADD COLUMN "category" TEXT;
ALTER TABLE "BlogJob" ADD COLUMN "resultUrl" TEXT;

-- Step 3: Update BlogJob.blogName references to bloggerAccountId if blogName exists
UPDATE "BlogJob" 
SET "bloggerAccountId" = (
    SELECT "id" FROM "BloggerAccount" 
    WHERE "BloggerAccount"."name" = "BlogJob"."blogName"
)
WHERE "blogName" IS NOT NULL AND EXISTS (SELECT 1 FROM pragma_table_info('BlogJob') WHERE name='blogName');

-- Step 4: Update Job table fields
ALTER TABLE "Job" ADD COLUMN "targetType" TEXT DEFAULT 'blog-info-posting';
ALTER TABLE "Job" ADD COLUMN "errorMsg" TEXT;

-- Copy data from old fields to new fields if they exist
UPDATE "Job" SET "targetType" = "type" WHERE EXISTS (SELECT 1 FROM pragma_table_info('Job') WHERE name='type');
UPDATE "Job" SET "errorMsg" = "errorMessage" WHERE EXISTS (SELECT 1 FROM pragma_table_info('Job') WHERE name='errorMessage');

-- Step 5: Update CoupangBlogJob table structure
ALTER TABLE "CoupangBlogJob" ADD COLUMN "coupangAffiliateLink" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "title" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "content" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "labels" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "tags" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "category" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "resultUrl" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "bloggerAccountId" TEXT;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "wordpressAccountId" INTEGER;
ALTER TABLE "CoupangBlogJob" ADD COLUMN "tistoryAccountId" INTEGER;

-- Step 6: Drop old columns and tables if they exist
ALTER TABLE "BlogJob" DROP COLUMN "blogName";
ALTER TABLE "Job" DROP COLUMN "type";
ALTER TABLE "Job" DROP COLUMN "errorMessage";
ALTER TABLE "Job" DROP COLUMN "resultUrl";
DROP TABLE IF EXISTS "GoogleBlog";

-- Step 7: Add foreign key constraints
CREATE UNIQUE INDEX IF NOT EXISTS "BloggerAccount_bloggerBlogId_key" ON "BloggerAccount"("bloggerBlogId");
CREATE UNIQUE INDEX IF NOT EXISTS "BloggerAccount_bloggerBlogName_key" ON "BloggerAccount"("bloggerBlogName");
CREATE UNIQUE INDEX IF NOT EXISTS "BloggerAccount_name_key" ON "BloggerAccount"("name");
CREATE INDEX IF NOT EXISTS "BloggerAccount_googleOauthId_idx" ON "BloggerAccount"("googleOauthId");
CREATE UNIQUE INDEX IF NOT EXISTS "BloggerAccount_googleOauthId_bloggerBlogId_key" ON "BloggerAccount"("googleOauthId", "bloggerBlogId");

-- Add foreign key constraints for BlogJob
CREATE INDEX IF NOT EXISTS "BlogJob_bloggerAccountId_idx" ON "BlogJob"("bloggerAccountId");
CREATE INDEX IF NOT EXISTS "BlogJob_wordpressAccountId_idx" ON "BlogJob"("wordpressAccountId");
CREATE INDEX IF NOT EXISTS "BlogJob_tistoryAccountId_idx" ON "BlogJob"("tistoryAccountId");

-- Add foreign key constraints for CoupangBlogJob
CREATE INDEX IF NOT EXISTS "CoupangBlogJob_bloggerAccountId_idx" ON "CoupangBlogJob"("bloggerAccountId");
CREATE INDEX IF NOT EXISTS "CoupangBlogJob_wordpressAccountId_idx" ON "CoupangBlogJob"("wordpressAccountId");
CREATE INDEX IF NOT EXISTS "CoupangBlogJob_tistoryAccountId_idx" ON "CoupangBlogJob"("tistoryAccountId"); 