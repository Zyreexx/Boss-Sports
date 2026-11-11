import { NextRequest, NextResponse } from "next/server";
import { authDb } from "./authDb";

export interface AuthenticatedActor {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "OWNER" | "EMPLOYEE" | "CUSTOMER";
}

/**
 * Retrieve verified user from session cookie
 */
export function getAuthenticatedActor(req: NextRequest): AuthenticatedActor | null {
  try {
    const cookie = req.cookies.get("boss_session");
    if (!cookie?.value) return null;

    const session = JSON.parse(cookie.value);
    if (!session || !session.id) return null;

    const user = authDb.getUserById(session.id);
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Enforce role requirement on API routes
 */
export function enforceRole(
  req: NextRequest,
  allowedRoles: ("OWNER" | "EMPLOYEE" | "CUSTOMER")[]
): {
  authorized: boolean;
  actor: AuthenticatedActor | null;
  response?: NextResponse;
} {
  const actor = getAuthenticatedActor(req);

  if (!actor) {
    return {
      authorized: false,
      actor: null,
      response: NextResponse.json(
        { success: false, error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }

  if (!allowedRoles.includes(actor.role)) {
    return {
      authorized: false,
      actor,
      response: NextResponse.json(
        { success: false, error: "Access denied: insufficient permissions." },
        { status: 403 }
      ),
    };
  }

  return { authorized: true, actor };
}

