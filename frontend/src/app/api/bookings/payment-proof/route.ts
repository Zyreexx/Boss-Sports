import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthenticatedActor } from "@/lib/auth/serverAuth";
import { pickleballDb } from "@/lib/db/pickleballDb";
import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";
import { supabaseDb } from "@/lib/supabase/supabaseDb";

export const dynamic = "force-dynamic";

const SAFE_FILE_NAME_REGEX = /^proof_\d+_[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/i;

function getContentType(ext: string): string {
  switch (ext.toLowerCase()) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".jpg":
    case ".jpeg":
    default:
      return "image/jpeg";
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileNameParam = searchParams.get("file") || "";
    const sanitizedFileName = path.basename(fileNameParam);

    if (!sanitizedFileName || !SAFE_FILE_NAME_REGEX.test(sanitizedFileName)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment proof file identifier." },
        { status: 400 }
      );
    }

    // Access Control: staff/owner or the customer associated with this booking
    const actor = getAuthenticatedActor(req);
    const isStaffOrOwner = actor && (actor.role === "OWNER" || actor.role === "EMPLOYEE");

    if (!isStaffOrOwner) {
      // Find matching booking referencing this screenshot
      const allBookings = isSupabaseConfigured()
        ? await supabaseDb.getAllBookings()
        : pickleballDb.getAllBookings();

      const matchedBooking = allBookings.find(
        (b) => b.paymentScreenshotUrl && b.paymentScreenshotUrl.includes(sanitizedFileName)
      );

      let isAuthorizedCustomer = false;
      if (matchedBooking) {
        if (actor) {
          const actorEmail = (actor.email || "").toLowerCase();
          const bookingEmail = (matchedBooking.customerEmail || "").toLowerCase();
          const actorPhone = (actor.phone || "").replace(/\D/g, "");
          const bookingPhone = (matchedBooking.customerPhone || "").replace(/\D/g, "");

          if (
            (actorEmail && bookingEmail && actorEmail === bookingEmail) ||
            (actorPhone && bookingPhone && actorPhone === bookingPhone) ||
            actor.id === matchedBooking.createdByStaffId
          ) {
            isAuthorizedCustomer = true;
          }
        }

        const phoneParam = searchParams.get("phone")?.replace(/\D/g, "");
        const bookingIdParam = searchParams.get("bookingId");
        if (
          (bookingIdParam && matchedBooking.id === bookingIdParam) ||
          (phoneParam && phoneParam.length >= 10 && matchedBooking.customerPhone.replace(/\D/g, "").endsWith(phoneParam.slice(-10)))
        ) {
          isAuthorizedCustomer = true;
        }
      }

      if (!isAuthorizedCustomer) {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden: You are not authorized to view this payment proof.",
          },
          { status: 403 }
        );
      }
    }

    // 1. Try Supabase Storage first if configured
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await supabase.storage.from("payment-proofs").download(sanitizedFileName);
        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          const ext = path.extname(sanitizedFileName);
          const contentType = getContentType(ext);
          return new NextResponse(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "private, max-age=3600",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      } catch (sbErr) {
        console.warn("Supabase Storage proof retrieval exception:", sbErr);
      }
    }

    // 2. Local filesystem storage fallback
    const storageDir = path.join(process.cwd(), "storage", "payment_proofs");
    const filePath = path.join(storageDir, sanitizedFileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: "Payment proof file not found." },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(sanitizedFileName);
    const contentType = getContentType(ext);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error("Error serving payment proof:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
