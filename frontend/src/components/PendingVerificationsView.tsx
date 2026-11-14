"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileText,
  User,
  Phone,
  Calendar,
  X,
  CreditCard,
} from "lucide-react";
import { formatBookingDuration } from "@/lib/utils/duration";

interface PendingVerificationsViewProps {
  onStatusChange?: () => void;
}

export default function PendingVerificationsView({ onStatusChange }: PendingVerificationsViewProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Screenshot modal preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Rejection modal
  const [rejectingBooking, setRejectingBooking] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  const fetchPendingBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pickleball/bookings", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.bookings)) {
        const pending = data.bookings.filter(
          (b: any) => b.status === "PENDING_VERIFICATION"
        );
        setBookings(pending);
      } else {
        setError(data.error || "Failed to load pending verifications.");
      }
    } catch {
      setError("Network error fetching pending verifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBookings();
  }, []);

  const handleApprove = async (bookingId: string) => {
    if (!confirm("Confirm and approve this UPI payment? Slot will be marked CONFIRMED and count toward revenue.")) {
      return;
    }
    setProcessingId(bookingId);
    try {
      const res = await fetch("/api/pickleball/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          action: "APPROVE",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("✓ Payment verified & booking confirmed!");
        fetchPendingBookings();
        if (onStatusChange) onStatusChange();
      } else {
        alert(data.error || "Failed to approve payment.");
      }
    } catch {
      alert("Network error approving payment.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingBooking) return;

    const reason = rejectionReason.trim() || "Payment not verified / mismatched";
    setProcessingId(rejectingBooking.id);
    try {
      const res = await fetch("/api/pickleball/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: rejectingBooking.id,
          action: "REJECT",
          rejectionReason: reason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert("✓ Payment rejected. Slot has been released.");
        setRejectingBooking(null);
        setRejectionReason("");
        fetchPendingBookings();
        if (onStatusChange) onStatusChange();
      } else {
        alert(data.error || "Failed to reject payment.");
      }
    } catch {
      alert("Network error rejecting payment.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#0d141f] border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <span>Manual UPI Verifications</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                {bookings.length} Pending
              </span>
            </h3>
            <p className="text-xs text-white/60 mt-0.5">
              Review customer payment screenshots against bank account statement before approving.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchPendingBookings}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && bookings.length === 0 ? (
        <div className="p-12 text-center text-white/50 text-xs">
          Loading pending payment submissions...
        </div>
      ) : bookings.length === 0 ? (
        <div className="p-12 rounded-2xl bg-[#0d141f] border border-white/10 text-center">
          <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3 opacity-80" />
          <h4 className="text-sm font-semibold text-white">All Clear! No Pending Verifications</h4>
          <p className="text-xs text-white/60 mt-1 max-w-md mx-auto">
            All customer UPI payment submissions have been reviewed. When players submit new screenshots, they will appear here for staff review.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((b) => {
            const isProcessing = processingId === b.id;
            return (
              <div
                key={b.id}
                className="bg-[#0d141f] border border-amber-500/30 rounded-2xl p-5 flex flex-col justify-between text-white shadow-lg relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 bg-amber-500/20 text-amber-300 border-l border-b border-amber-500/30 text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Pending Verification
                </div>

                <div>
                  <div className="pb-3 border-b border-white/10 mb-3">
                    <span className="text-xs text-white/50 font-mono block">
                      Ref #{b.id.slice(-6).toUpperCase()}
                    </span>
                    <h4 className="font-bold text-sm text-white mt-0.5">
                      {b.courtName}
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs text-white/80 mb-4">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span className="font-semibold text-white">{b.customerName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span>{b.customerPhone}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span>
                        {new Date(b.startTime).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        •{" "}
                        {new Date(b.startTime).toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}{" "}
                        –{" "}
                        {new Date(b.endTime).toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-white/60">Duration:</span>
                      <span className="font-semibold text-white">
                        {formatBookingDuration(b)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-white/60">Amount:</span>
                      <span className="text-sm font-bold text-[#c7f711]">
                        ₹{b.totalPrice}
                      </span>
                    </div>

                    {b.paymentUtr && (
                      <div className="flex items-center justify-between">
                        <span className="text-white/60">UTR / Ref:</span>
                        <span className="font-mono text-[11px] font-semibold text-white bg-white/10 px-2 py-0.5 rounded">
                          {b.paymentUtr}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Screenshot Thumbnail Preview */}
                  {b.paymentScreenshotUrl ? (
                    <div className="mb-4 bg-black/40 p-2 rounded-xl border border-white/10">
                      <span className="text-[10px] text-white/60 block mb-1.5 font-medium">
                        Payment Screenshot:
                      </span>
                      <div className="flex items-center gap-3">
                        <img
                          src={b.paymentScreenshotUrl}
                          alt="Screenshot Proof"
                          className="w-16 h-16 object-cover rounded-lg border border-white/20 bg-neutral-900 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setPreviewImage(b.paymentScreenshotUrl)}
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewImage(b.paymentScreenshotUrl)}
                          className="text-xs text-[#c7f711] hover:underline flex items-center gap-1 font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Proof
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-[11px] text-yellow-300">
                      No screenshot uploaded.
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleApprove(b.id)}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => {
                      setRejectingBooking(b);
                      setRejectionReason("");
                    }}
                    className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Screenshot Full Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-[#0d141f] border border-white/20 rounded-2xl p-4 max-w-2xl max-h-[90vh] flex flex-col items-center relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#c7f711]" /> Payment Proof Screenshot
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>
            <div className="overflow-auto max-h-[70vh] rounded-lg">
              <img
                src={previewImage}
                alt="Enlarged Payment Proof"
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
            <p className="text-[11px] text-white/50 mt-3 text-center">
              Verify transaction amount, reference number, and payee name against your bank ledger.
            </p>
          </div>
        </div>
      )}

      {/* Rejection Prompt Modal */}
      {rejectingBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-[#0d141f] border border-red-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <h4 className="text-sm font-bold text-red-300 flex items-center gap-2">
                <XCircle className="w-4 h-4" /> Reject UPI Payment
              </h4>
              <button
                type="button"
                onClick={() => setRejectingBooking(null)}
                className="text-white/60 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/80 mb-3 leading-relaxed">
              Rejecting will cancel booking{" "}
              <strong className="text-white">#{rejectingBooking.id.slice(-6).toUpperCase()}</strong> and immediately release the held court slot for other players.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] text-white/80 block mb-1 font-semibold">
                  Reason for Rejection *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Transaction amount does not match booking total, or payment not received in bank account."
                  className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-xs text-white placeholder-white/40 focus:border-red-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingBooking(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingId === rejectingBooking.id}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {processingId === rejectingBooking.id ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
