-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "messageId" TEXT,
    "role" TEXT,
    "parts" JSONB,
    "errorText" TEXT,
    "stack" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Entry_sessionId_seq_idx" ON "Entry"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_sessionId_seq_key" ON "Entry"("sessionId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_sessionId_messageId_key" ON "Entry"("sessionId", "messageId");
