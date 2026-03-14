import { createMiddleware } from "@tanstack/react-start";
import {
  getRequestHeader,
  getCookie,
} from "@tanstack/react-start/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/server/lib/errors";
import { getAuthUser } from "@/server/auth/simple-auth";

export const ensureUserMiddleware = createMiddleware({
  type: "function",
}).server(async (c) => {
  const { next } = c;

  // 1. Try to get username from X-Auth-User header (set by server.ts auth gate)
  let username: string | null = getRequestHeader("X-Auth-User" as never) as string | null ?? null;
  console.log("[AUTH-MW] X-Auth-User header:", username);

  // 2. Fallback: re-verify the cookie
  if (!username) {
    const cookieValue = getCookie("openseo_session");
    if (cookieValue) {
      const fakeReq = new Request("https://localhost", {
        headers: { Cookie: `openseo_session=${cookieValue}` },
      });
      username = await getAuthUser(fakeReq);
    }
  }

  if (!username) {
    throw new AppError("UNAUTHENTICATED");
  }

  // Use username as the user ID (lowercased for consistency)
  const userId = username.toLowerCase();
  const userEmail = `${userId}@openseo.local`;

  // Check if user exists in DB
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    await db.insert(users).values({
      id: userId,
      email: userEmail,
    });
  }

  return next({
    context: {
      userId,
      userEmail: user?.email || userEmail,
      session: { sub: userId, email: userEmail },
    },
  });
});
