/*
  Warnings:

  - Added the required column `wpUsername` to the `WordPressAccount` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WordPressAccount" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "desc" TEXT,
    "url" TEXT NOT NULL,
    "wpUsername" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_WordPressAccount" ("apiKey", "createdAt", "desc", "id", "isDefault", "name", "updatedAt", "url", "wpUsername") SELECT "apiKey", "createdAt", "desc", "id", "isDefault", "name", "updatedAt", "url", 'admin' FROM "WordPressAccount";
DROP TABLE "WordPressAccount";
ALTER TABLE "new_WordPressAccount" RENAME TO "WordPressAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
