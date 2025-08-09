-- AlterTable
ALTER TABLE "BlogJob" ADD COLUMN "publishVisibility" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BloggerAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "googleOauthId" INTEGER NOT NULL,
    "bloggerBlogId" TEXT NOT NULL,
    "bloggerBlogName" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'public',
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
CREATE TABLE "new_TistoryAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "tistoryUrl" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "loginPassword" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TistoryAccount" ("createdAt", "desc", "id", "isDefault", "loginId", "loginPassword", "name", "tistoryUrl", "updatedAt") SELECT "createdAt", "desc", "id", "isDefault", "loginId", "loginPassword", "name", "tistoryUrl", "updatedAt" FROM "TistoryAccount";
DROP TABLE "TistoryAccount";
ALTER TABLE "new_TistoryAccount" RENAME TO "TistoryAccount";
CREATE TABLE "new_WordPressAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "url" TEXT NOT NULL,
    "wpUsername" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "defaultVisibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WordPressAccount" ("apiKey", "createdAt", "desc", "id", "isDefault", "name", "updatedAt", "url", "wpUsername") SELECT "apiKey", "createdAt", "desc", "id", "isDefault", "name", "updatedAt", "url", "wpUsername" FROM "WordPressAccount";
DROP TABLE "WordPressAccount";
ALTER TABLE "new_WordPressAccount" RENAME TO "WordPressAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
