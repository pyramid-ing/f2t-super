/*
  Warnings:

  - You are about to drop the column `bloggerBlogId` on the `Settings` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `GoogleBlog` will be added. If there are existing duplicate values, this will fail.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "data" JSONB,
    "bloggerBlogName" TEXT,
    "googleOauthId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("createdAt", "data", "googleOauthId", "id", "updatedAt") SELECT "createdAt", "data", "googleOauthId", "id", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "GoogleBlog_name_key" ON "GoogleBlog"("name");
