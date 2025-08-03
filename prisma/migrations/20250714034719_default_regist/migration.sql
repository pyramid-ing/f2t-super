-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'request',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "scheduledAt" DATETIME NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "resultMsg" TEXT,
    "resultUrl" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Job" ("completedAt", "createdAt", "desc", "errorMessage", "id", "priority", "resultMsg", "resultUrl", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt") SELECT "completedAt", "createdAt", "desc", "errorMessage", "id", "priority", "resultMsg", "resultUrl", "scheduledAt", "startedAt", "status", "subject", "type", "updatedAt" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
