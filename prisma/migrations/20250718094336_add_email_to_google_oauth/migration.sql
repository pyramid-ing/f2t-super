/*
  Warnings:

  - Added the required column `email` to the `GoogleOAuth` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GoogleOAuth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oauth2ClientId" TEXT NOT NULL,
    "oauth2ClientSecret" TEXT NOT NULL,
    "oauth2AccessToken" TEXT NOT NULL,
    "oauth2RefreshToken" TEXT NOT NULL,
    "oauth2TokenExpiry" DATETIME NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_GoogleOAuth" ("createdAt", "description", "id", "name", "oauth2AccessToken", "oauth2ClientId", "oauth2ClientSecret", "oauth2RefreshToken", "oauth2TokenExpiry", "updatedAt", "email") SELECT "createdAt", "description", "id", "name", "oauth2AccessToken", "oauth2ClientId", "oauth2ClientSecret", "oauth2RefreshToken", "oauth2TokenExpiry", "updatedAt", 'temp_' || "id" || '@example.com' FROM "GoogleOAuth";
DROP TABLE "GoogleOAuth";
ALTER TABLE "new_GoogleOAuth" RENAME TO "GoogleOAuth";
CREATE UNIQUE INDEX "GoogleOAuth_email_key" ON "GoogleOAuth"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
