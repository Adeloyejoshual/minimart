import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  adapter: process.env.COCKROACH_URI
});