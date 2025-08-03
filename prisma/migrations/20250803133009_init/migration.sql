-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GoogleOAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oauth2ClientId" TEXT NOT NULL,
    "oauth2ClientSecret" TEXT NOT NULL,
    "oauth2AccessToken" TEXT NOT NULL,
    "oauth2RefreshToken" TEXT NOT NULL,
    "oauth2TokenExpiry" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BloggerAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleOauthId" TEXT NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloggerAccount_googleOauthId_fkey" FOREIGN KEY ("googleOauthId") REFERENCES "GoogleOAuth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
CREATE TABLE "ThumbnailLayout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "desc" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "previewUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetType" TEXT NOT NULL DEFAULT 'blog-info-posting',
    "subject" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "resultMsg" TEXT,
    "errorMsg" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "labels" JSONB,
    "tags" JSONB,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "resultUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "jobId" TEXT NOT NULL,
    "bloggerAccountId" TEXT,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CoupangBlogJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "coupangUrl" TEXT NOT NULL,
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
    "bloggerAccountId" TEXT,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TopicJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "xlsxFileName" TEXT,
    CONSTRAINT "TopicJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleOAuth_email_key" ON "GoogleOAuth"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogId_key" ON "BloggerAccount"("bloggerBlogId");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogName_key" ON "BloggerAccount"("bloggerBlogName");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_name_key" ON "BloggerAccount"("name");

-- CreateIndex
CREATE INDEX "BloggerAccount_googleOauthId_idx" ON "BloggerAccount"("googleOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "BloggerAccount_googleOauthId_bloggerBlogId_key" ON "BloggerAccount"("googleOauthId", "bloggerBlogId");

-- CreateIndex
CREATE INDEX "JobLog_jobId_idx" ON "JobLog"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "TopicJob_jobId_key" ON "TopicJob"("jobId");
