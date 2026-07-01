import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/client";

// Resolve dev.db next to this package, independent of the caller's cwd — the
// server and CLI run from different directories but must hit the same file.
// `.href` yields a proper `file://` URL, which the libSQL client accepts.
const dbUrl = process.env.DATABASE_URL ?? new URL("../dev.db", import.meta.url).href;

const adapter = new PrismaLibSql({ url: dbUrl });

// A single instance per process; each PrismaClient owns a connection pool.
export const prisma = new PrismaClient({ adapter });

// Re-export the generated model types (Session, Entry, Prisma, ...) so consumers
// can `import type { ... } from "@babalcode/db"` without touching the runtime.
export * from "../generated/client";
