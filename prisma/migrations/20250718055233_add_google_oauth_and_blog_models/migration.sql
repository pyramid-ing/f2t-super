-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "bloggerBlogId" TEXT;
ALTER TABLE "Settings" ADD COLUMN "googleOauthId" TEXT;

-- CreateTable
CREATE TABLE "GoogleOAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oauth2ClientId" TEXT NOT NULL,
    "oauth2ClientSecret" TEXT NOT NULL,
    "oauth2AccessToken" TEXT NOT NULL,
    "oauth2RefreshToken" TEXT NOT NULL,
    "oauth2TokenExpiry" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "GoogleBlog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "googleOauthId" TEXT NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GoogleBlog_googleOauthId_fkey" FOREIGN KEY ("googleOauthId") REFERENCES "GoogleOAuth" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GoogleBlog_googleOauthId_idx" ON "GoogleBlog"("googleOauthId");

-- CreateIndex
CREATE UNIQUE INDEX "GoogleBlog_googleOauthId_bloggerBlogId_key" ON "GoogleBlog"("googleOauthId", "bloggerBlogId");
