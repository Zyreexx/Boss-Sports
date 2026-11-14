import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { enforceRole } from "@/lib/auth/serverAuth";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import {
  callDjangoApi,
  getBackendMisconfiguredResponse,
  isDjangoBackendConfigured,
  isLocalJsonFallbackDisabled,
  toProxyJsonResponse,
} from "@/lib/backend/djangoClient";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = enforceRole(req, ["OWNER", "EMPLOYEE"]);
    if (!auth.authorized || !auth.actor) {
      return auth.response!;
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (isDjangoBackendConfigured()) {
      const upstream = await callDjangoApi({
        path: "/api/upload/",
        method: "POST",
        body: {
          filename: file.name || "upload.jpg",
          contentType: file.type || "application/octet-stream",
          dataBase64: buffer.toString("base64"),
        },
        actor: auth.actor,
        timeoutMs: 25_000,
      });
      return toProxyJsonResponse(upstream);
    }

    const ext = path.extname(file.name) || (file.type.startsWith("video") ? ".mp4" : ".jpg");
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFileName = `${baseName}_${Date.now()}${ext}`;
    const mediaType = file.type.startsWith("video") ? "video" : "image";

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseAdmin();
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(`uploads/${uniqueFileName}`, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        });

      if (!uploadError) {
        const { data: publicData } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(`uploads/${uniqueFileName}`);

        return NextResponse.json({
          success: true,
          url: publicData.publicUrl,
          fileName: uniqueFileName,
          type: mediaType,
        });
      }
    }

    if (isLocalJsonFallbackDisabled()) {
      return getBackendMisconfiguredResponse();
    }

    // Local development fallback only (when DJANGO_API_URL is unset and not in production)
    const ext = path.extname(file.name) || (file.type.startsWith("video") ? ".mp4" : ".jpg");
    const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_-]/g, "_");
    const uniqueFileName = `${baseName}_${Date.now()}${ext}`;

    const publicBase = fs.existsSync(path.join(process.cwd(), "frontend", "public"))
      ? path.join(process.cwd(), "frontend", "public")
      : path.join(process.cwd(), "public");
    const uploadDir = path.join(publicBase, "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFileName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/${uniqueFileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: uniqueFileName,
      type: file.type.startsWith("video") ? "video" : "image",
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to upload file" },
      { status: 500 }
    );
  }
}
