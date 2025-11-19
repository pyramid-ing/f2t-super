-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SitemapConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "siteId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sitemapType" TEXT NOT NULL,
    "sitemapPath" TEXT NOT NULL DEFAULT 'sitemap.xml',
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastParsed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SitemapConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SitemapConfig" ("createdAt", "id", "isEnabled", "lastParsed", "name", "siteId", "sitemapType", "updatedAt") SELECT "createdAt", "id", "isEnabled", "lastParsed", "name", "siteId", "sitemapType", "updatedAt" FROM "SitemapConfig";
DROP TABLE "SitemapConfig";
ALTER TABLE "new_SitemapConfig" RENAME TO "SitemapConfig";
CREATE INDEX "SitemapConfig_siteId_idx" ON "SitemapConfig"("siteId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
