import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function validateImageHeader(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }

  // WebP: RIFF .... WEBP
  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return true;
  }

  return false;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No payment screenshot file provided." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Screenshot file exceeds the 5MB size limit." },
        { status: 400 }
      );
    }

    const fileType = file.type?.toLowerCase() || "";
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Please upload a JPG, PNG, or WebP screenshot.",
        },
        { status: 400 }
      );
    }

    const rawExt = path.extname(file.name || "").toLowerCase();
    const ext = ALLOWED_EXTENSIONS.has(rawExt)
      ? rawExt
      : fileType === "image/png"
      ? ".png"
      : fileType === "image/webp"
      ? ".webp"
      : ".jpg";

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!validateImageHeader(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error: "Uploaded file does not match a valid image signature.",
        },
        { status: 400 }
      );
    }

    const safeToken = crypto.randomBytes(8).toString("hex");
    const uniqueFileName = `proof_${Date.now()}_${safeToken}${ext}`;

    // 1. Cloudflare & Serverless: Upload directly to Supabase Storage if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(uniqueFileName, buffer, {
            contentType: fileType,
            upsert: false,
          });

        if (!uploadError) {
          const { data: publicData } = supabase.storage
            .from("payment-proofs")
            .getPublicUrl(uniqueFileName);

          const secureUrl = publicData?.publicUrl || `/api/bookings/payment-proof?file=${encodeURIComponent(uniqueFileName)}`;

          return NextResponse.json({
            success: true,
            url: secureUrl,
            fileName: uniqueFileName,
            sizeBytes: file.size,
            storage: "supabase",
            message: "Payment proof uploaded to Supabase Storage for staff review.",
          });
        } else {
          console.warn("Supabase storage upload failed, falling back to local storage if available:", uploadError);
        }
      } catch (sbErr) {
        console.warn("Supabase storage exception:", sbErr);
      }
    }

    // 2. Local fallback storage directory
    const storageDir = path.join(process.cwd(), "storage", "payment_proofs");
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const targetPath = path.join(storageDir, uniqueFileName);
    fs.writeFileSync(targetPath, buffer);

    const secureUrl = `/api/bookings/payment-proof?file=${encodeURIComponent(uniqueFileName)}`;

    return NextResponse.json({
      success: true,
      url: secureUrl,
      fileName: uniqueFileName,
      sizeBytes: file.size,
      storage: "local",
      message: "Payment proof uploaded securely for staff review.",
    });
  } catch (error: any) {
    console.error("Payment proof upload error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process screenshot upload." },
      { status: 500 }
    );
  }
}
