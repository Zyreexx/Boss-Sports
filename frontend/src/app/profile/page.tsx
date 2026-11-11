"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Clock,
  User,
  Phone,
  Mail,
  ShieldCheck,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Lock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";

export default function CustomerProfilePage() {
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [bookings, setBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        fetchCustomerBookings();
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAuthChecked(true);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("boss_current_user");
    setCurrentUser(null);
    setBookings([]);
  };

  const fetchCustomerBookings = async () => {
    setLoadingBookings(true);
    setBookingsError(null);
    try {
      const res = await fetch(`/api/pickleball/bookings`, { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        setBookings([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.bookings) {
        setBookings(data.bookings);
      } else {
        setBookingsError(data.error || "Unable to load your bookings right now. Please try again.");
      }
    } catch {
      setBookingsError("Unable to reach booking server to verify your reservations.");
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleCancelBooking = async (booking: any) => {
    const startMs = new Date(booking.startTime).getTime();
    const nowMs = Date.now();
    const diffHours = (startMs - nowMs) / (1000 * 60 * 60);

    if (diffHours < 2) {
      alert("Self-service cancellation is locked within 2 hours of game time. Please contact desk staff at reception (Boss Pickleball, Gondal) for assistance.");
      return;
    }

    const istDateStr = new Date(booking.startTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
    if (!confirm(`Are you sure you want to cancel your reservation for ${booking.courtName} on ${istDateStr}?`)) {
      return;
    }

    setCancellingId(booking.id);
    setCancelStatus(null);

    try {
      const res = await fetch("/api/pickleball/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          reason: "Customer cancelled via profile portal",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCancelStatus("✓ Booking successfully cancelled.");
        fetchCustomerBookings();
      } else {
        setCancelStatus(`Error: ${data.error || "Failed to cancel"}`);
      }
    } catch (e) {
      setCancelStatus("Network error occurred while cancelling booking.");
    } finally {
      setCancellingId(null);
    }
  };

  // Split bookings into upcoming vs past/cancelled
  const now = new Date();
  const upcomingBookings = bookings.filter((b) => {
    const end = new Date(b.endTime);
    return end >= now && b.status !== "CANCELLED";
  });

  const pastBookings = bookings.filter((b) => {
    const end = new Date(b.endTime);
    return end < now || b.status === "CANCELLED";
  });

  return (
    <div className="min-h-screen bg-[#070b10] text-[#f0f4f8] antialiased selection:bg-[#c7f711] selection:text-black">
      {/* Top Navigation */}
      <header className="border-b border-white/10 bg-[#0d141f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#c7f711] shadow-[0_0_15px_rgba(199,247,17,0.3)] bg-white">
              <Image
                src="/images/official-boss-logo.jpg"
                alt="Boss Pickleball"
                width={40}
                height={40}
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-white text-base">BOSS PICKLEBALL</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/40 px-2 py-0.5 rounded-full">
                  Customer Portal
                </span>
              </div>
              <p className="text-[11px] text-white/50">Pickleball Arena &amp; Member Schedule</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs text-white/70 hover:text-white px-3.5 py-1.5 rounded-xl border border-white/10 hover:border-white/30 transition-all flex items-center gap-1.5"
            >
              <span>← Back to Website</span>
            </Link>

            {currentUser ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-[#c7f711] animate-pulse" />
                <span className="text-xs text-white/90 font-medium">{currentUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-white/40 hover:text-white underline ml-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="text-xs bg-[#c7f711] text-black font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {!currentUser ? (
          /* Not Logged In State */
          <div className="max-w-md mx-auto my-12 bg-[#0d141f] border border-white/10 rounded-3xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-[#c7f711]/10 border border-[#c7f711]/30 text-[#c7f711] flex items-center justify-center mx-auto">
              <User className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white">Sign In to View Your Schedule</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              Log in with your customer account or phone number to view all your upcoming court reservations, past matches, and manage self-cancellations.
            </p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-[#c7f711]/20 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In with Customer Credentials</span>
            </button>
          </div>
        ) : (
          /* Logged In Customer Profile */
          <div className="space-y-8">
            {/* Customer Details & Quick Stats */}
            <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-[#c7f711]/20 to-[#00A852]/20 border border-[#c7f711]/40 flex items-center justify-center text-2xl font-extrabold text-[#c7f711]">
                    {currentUser.avatar ? (
                      <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                    ) : (
                      currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "C"
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-white">{currentUser.name}</h1>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verified Customer</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-white/60 mt-1">
                      {currentUser.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-white/40" />
                          <span>+91 {currentUser.phone}</span>
                        </span>
                      )}
                      {currentUser.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-white/40" />
                          <span>{currentUser.email}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/#booking"
                    className="bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-[#c7f711]/20 flex items-center gap-1.5"
                  >
                    <span>Book Another Court</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => fetchCustomerBookings()}
                    disabled={loadingBookings}
                    aria-label="Refresh Bookings"
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all"
                    title="Refresh Bookings"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingBookings ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
                    Upcoming Bookings
                  </div>
                  <div className="text-2xl font-extrabold text-[#c7f711] mt-1">
                    {upcomingBookings.length}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
                    Total Matches Booked
                  </div>
                  <div className="text-2xl font-extrabold text-white mt-1">
                    {bookings.length}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
                    Total Spent
                  </div>
                  <div className="text-2xl font-extrabold text-emerald-400 mt-1">
                    ₹{bookings.reduce((sum, b) => b.status !== "CANCELLED" ? sum + (b.totalPrice || 0) : sum, 0)}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="text-[11px] text-white/50 uppercase tracking-wider font-semibold">
                    Cancellation Window
                  </div>
                  <div className="text-xs font-bold text-[#c7f711] mt-2">
                    Self-service ≥ 2 hrs prior
                  </div>
                </div>
              </div>
            </div>

            {/* Cancel Status Alert */}
            {cancelStatus && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
                  cancelStatus.startsWith("✓")
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                {cancelStatus.startsWith("✓") ? (
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{cancelStatus}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* UPCOMING BOOKINGS SECTION */}
            {/* ========================================================================= */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#c7f711]" />
                    <span>Your Upcoming Court Bookings</span>
                  </h2>
                  <p className="text-xs text-white/60">
                    Confirmed games waiting for you on Boss Pickleball courts.
                  </p>
                </div>
                <span className="text-xs bg-[#c7f711]/10 text-[#c7f711] border border-[#c7f711]/30 px-3 py-1 rounded-full font-bold">
                  {upcomingBookings.length} Scheduled
                </span>
              </div>

              {bookingsError && (
                <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/40 text-xs text-red-200 flex items-center justify-between gap-3">
                  <span>{bookingsError}</span>
                  <button
                    type="button"
                    onClick={fetchCustomerBookings}
                    className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 font-semibold text-white shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {loadingBookings ? (
                <div className="p-12 text-center text-xs text-white/40 bg-[#0d141f] rounded-3xl border border-white/10">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#c7f711]" />
                  Loading your upcoming schedule...
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingBookings.map((b) => {
                    const start = new Date(b.startTime);
                    const end = new Date(b.endTime);
                    const dateFormatted = start.toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const timeFormatted = `${start.toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })} - ${end.toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })} IST`;

                    return (
                      <div
                        key={b.id}
                        className="p-5 rounded-3xl bg-[#0d141f] border border-white/10 hover:border-[#c7f711]/40 transition-all flex flex-col justify-between space-y-4 shadow-lg relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#c7f711] bg-[#c7f711]/10 px-2.5 py-0.5 rounded-full border border-[#c7f711]/30">
                              {b.courtName || "Court 1"}
                            </span>
                            <h3 className="text-base font-bold text-white mt-2">
                              {dateFormatted}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-white/70 mt-1">
                              <Clock className="w-3.5 h-3.5 text-white/40" />
                              <span className="font-mono">{timeFormatted}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-lg font-extrabold text-[#c7f711]">
                              ₹{b.totalPrice || 400}
                            </span>
                            <span className="text-[10px] text-white/50 block font-mono">
                              #{b.id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {b.status}
                            </span>
                            <span className="text-[10px] font-medium text-white/50">
                              Payment: {b.paymentStatus?.replace("_", " ")}
                            </span>
                          </div>

                          <button
                            type="button"
                            disabled={cancellingId === b.id}
                            onClick={() => handleCancelBooking(b)}
                            className="text-[11px] font-semibold text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
                          >
                            {cancellingId === b.id ? "Cancelling..." : "Cancel Slot"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-10 rounded-3xl bg-[#0d141f] border border-white/10 text-center space-y-3">
                  <div className="text-3xl">🎾</div>
                  <h3 className="text-base font-bold text-white">No Upcoming Bookings Found</h3>
                  <p className="text-xs text-white/50 max-w-sm mx-auto">
                    You do not have any active reservations right now. Reserve a court slot for your next pickleball session today.
                  </p>
                  <Link
                    href="/#booking"
                    className="inline-flex items-center gap-2 bg-[#c7f711] text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-md mt-2"
                  >
                    <span>Reserve a Court Now</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>

            {/* ========================================================================= */}
            {/* PAST MATCH HISTORY */}
            {/* ========================================================================= */}
            {pastBookings.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white/50" />
                  <span>Past Matches &amp; Activity History</span>
                </h3>

                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0d141f]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">Booking ID</th>
                        <th className="p-3.5">Court</th>
                        <th className="p-3.5">Date &amp; Time</th>
                        <th className="p-3.5">Amount</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-white/80">
                      {pastBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-white/5">
                          <td className="p-3.5 font-mono text-[11px] text-white/50">
                            #{b.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="p-3.5 font-semibold text-white">
                            {b.courtName || "Court 1"}
                          </td>
                          <td className="p-3.5 text-white/70">
                            {new Date(b.startTime).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })} • {new Date(b.startTime).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })} IST
                          </td>
                          <td className="p-3.5 font-bold text-[#c7f711]">
                            ₹{b.totalPrice || 400}
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                b.status === "CONFIRMED"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          fetchCustomerBookings();
        }}
      />
    </div>
  );
}

