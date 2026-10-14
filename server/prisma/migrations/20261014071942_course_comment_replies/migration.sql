-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CourseComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "replyBody" TEXT,
    "replyAuthorId" TEXT,
    "repliedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CourseComment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CourseComment_replyAuthorId_fkey" FOREIGN KEY ("replyAuthorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CourseComment" ("body", "courseId", "createdAt", "id", "updatedAt", "userId") SELECT "body", "courseId", "createdAt", "id", "updatedAt", "userId" FROM "CourseComment";
DROP TABLE "CourseComment";
ALTER TABLE "new_CourseComment" RENAME TO "CourseComment";
CREATE INDEX "CourseComment_courseId_createdAt_idx" ON "CourseComment"("courseId", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
