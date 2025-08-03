/*
  Warnings:

  - You are about to alter the column `bloggerAccountId` on the `BlogJob` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `BloggerAccount` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `googleOauthId` on the `BloggerAccount` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `id` on the `BloggerAccount` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `bloggerAccountId` on the `CoupangBlogJob` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `GoogleOAuth` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `GoogleOAuth` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BlogJob" (
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
    "bloggerAccountId" INTEGER,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "BlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BlogJob" ("bloggerAccountId", "category", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId") SELECT "bloggerAccountId", "category", "content", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId" FROM "BlogJob";
DROP TABLE "BlogJob";
ALTER TABLE "new_BlogJob" RENAME TO "BlogJob";
CREATE UNIQUE INDEX "BlogJob_jobId_key" ON "BlogJob"("jobId");
CREATE TABLE "new_BloggerAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "googleOauthId" INTEGER NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BloggerAccount_googleOauthId_fkey" FOREIGN KEY ("googleOauthId") REFERENCES "GoogleOAuth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BloggerAccount" ("bloggerBlogId", "bloggerBlogName", "createdAt", "desc", "googleOauthId", "id", "isDefault", "name", "updatedAt") SELECT "bloggerBlogId", "bloggerBlogName", "createdAt", "desc", "googleOauthId", "id", "isDefault", "name", "updatedAt" FROM "BloggerAccount";
DROP TABLE "BloggerAccount";
ALTER TABLE "new_BloggerAccount" RENAME TO "BloggerAccount";
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogId_key" ON "BloggerAccount"("bloggerBlogId");
CREATE UNIQUE INDEX "BloggerAccount_bloggerBlogName_key" ON "BloggerAccount"("bloggerBlogName");
CREATE UNIQUE INDEX "BloggerAccount_name_key" ON "BloggerAccount"("name");
CREATE INDEX "BloggerAccount_googleOauthId_idx" ON "BloggerAccount"("googleOauthId");
CREATE UNIQUE INDEX "BloggerAccount_googleOauthId_bloggerBlogId_key" ON "BloggerAccount"("googleOauthId", "bloggerBlogId");
CREATE TABLE "new_CoupangBlogJob" (
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
    "bloggerAccountId" INTEGER,
    "wordpressAccountId" INTEGER,
    "tistoryAccountId" INTEGER,
    CONSTRAINT "CoupangBlogJob_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_bloggerAccountId_fkey" FOREIGN KEY ("bloggerAccountId") REFERENCES "BloggerAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_wordpressAccountId_fkey" FOREIGN KEY ("wordpressAccountId") REFERENCES "WordPressAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CoupangBlogJob_tistoryAccountId_fkey" FOREIGN KEY ("tistoryAccountId") REFERENCES "TistoryAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CoupangBlogJob" ("bloggerAccountId", "category", "content", "coupangAffiliateLink", "coupangUrl", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId") SELECT "bloggerAccountId", "category", "content", "coupangAffiliateLink", "coupangUrl", "createdAt", "id", "jobId", "labels", "publishedAt", "resultUrl", "status", "tags", "tistoryAccountId", "title", "updatedAt", "wordpressAccountId" FROM "CoupangBlogJob";
DROP TABLE "CoupangBlogJob";
ALTER TABLE "new_CoupangBlogJob" RENAME TO "CoupangBlogJob";
CREATE UNIQUE INDEX "CoupangBlogJob_jobId_key" ON "CoupangBlogJob"("jobId");
CREATE TABLE "new_GoogleOAuth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
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
INSERT INTO "new_GoogleOAuth" ("createdAt", "desc", "email", "id", "name", "oauth2AccessToken", "oauth2ClientId", "oauth2ClientSecret", "oauth2RefreshToken", "oauth2TokenExpiry", "updatedAt") SELECT "createdAt", "desc", "email", "id", "name", "oauth2AccessToken", "oauth2ClientId", "oauth2ClientSecret", "oauth2RefreshToken", "oauth2TokenExpiry", "updatedAt" FROM "GoogleOAuth";
DROP TABLE "GoogleOAuth";
ALTER TABLE "new_GoogleOAuth" RENAME TO "GoogleOAuth";
CREATE UNIQUE INDEX "GoogleOAuth_email_key" ON "GoogleOAuth"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
