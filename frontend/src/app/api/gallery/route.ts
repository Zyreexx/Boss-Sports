import { NextRequest, NextResponse } from "next/server";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { enforceRole, getAuthenticatedActor } from "@/lib/auth/serverAuth";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

// GET /api/gallery (Public - returns gallery items)
export async function GET(req: NextRequest) {
  try {
    if (isDjangoBackendConfigured()) {
      const actor = getAuthenticatedActor(req);
      const upstream = await callDjangoApi({
        path: "/api/gallery-items/",
        method: "GET",
        actor,
        timeoutMs: 25_000,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const items = pickleballDb.getGalleryItems();
    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch gallery items" },
      { status: 500 }
    );
  }
}

// POST /api/gallery (Owner & Staff ONLY)
export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { type, title, category, tag, src, videoSrc, aspect, caption, duration } = body;

    if (!title || !src) {
      return NextResponse.json(
        { success: false, error: "Title and media source (photo URL/poster) are required" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/gallery-items/",
        method: "POST",
        body: {
          type: type || "image",
          title,
          category: category || "matchplay",
          tag: tag || "",
          src,
          videoSrc: videoSrc || undefined,
          aspect: aspect || "tall",
          caption: caption || "",
          duration: duration || undefined,
        },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const newItem = pickleballDb.addGalleryItem(
      {
        type: type || "image",
        title,
        category: category || "matchplay",
        tag: tag || "",
        src,
        videoSrc: videoSrc || undefined,
        aspect: aspect || "tall",
        caption: caption || "",
        duration: duration || undefined,
      },
      auth.actor
    );

    return NextResponse.json({
      success: true,
      message: `Gallery item "${newItem.title}" added successfully!`,
      item: newItem,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to add gallery item" },
      { status: 400 }
    );
  }
}

// PATCH /api/gallery (Owner & Staff ONLY)
export async function PATCH(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/gallery-items/",
        method: "PATCH",
        body: { id, ...updates },
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    const updated = pickleballDb.updateGalleryItem(id, updates, auth.actor);

    return NextResponse.json({
      success: true,
      message: `Gallery item "${updated.title}" updated successfully!`,
      item: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update gallery item" },
      { status: 400 }
    );
  }
}

// DELETE /api/gallery (Owner & Staff ONLY)
export async function DELETE(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is required" },
        { status: 400 }
      );
    }

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: `/api/gallery-items/?id=${encodeURIComponent(id)}`,
        method: "DELETE",
        actor: auth.actor,
      });
      return toProxyJsonResponse(upstream);
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    pickleballDb.deleteGalleryItem(id, auth.actor);

    return NextResponse.json({
      success: true,
      message: "Gallery item removed successfully.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete gallery item" },
      { status: 400 }
    );
  }
}
