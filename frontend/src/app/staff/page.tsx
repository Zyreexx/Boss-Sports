"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Phone,
  User,
  CheckCircle,
  AlertCircle,
  Search,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  Receipt,
  XCircle,
  DollarSign,
  Layers,
  ChevronRight,
  Lock,
  FileText,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";
import CourtManager from "@/components/CourtManager";
import GalleryManager from "@/components/GalleryManager";

export default function StaffPanelPage() {
  const [activeTab, setActiveTab] = useState<"pickleball" | "courts" | "gallery" | "schedule" | "lookup">("pickleball");

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // --- Pickleball Quick-Book State ---
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("07:00");
  const [durationHours, setDurationHours] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [bookingSource, setBookingSource] = useState<"WALKIN" | "PHONE">("WALKIN");
  const [paymentStatus, setPaymentStatus] = useState<"CASH_COUNTER" | "UPI_COUNTER" | "PAY_AT_VENUE">("CASH_COUNTER");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookMessage, setBookMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Schedule status for selected date
  const [selectedDateIsClosed, setSelectedDateIsClosed] = useState(false);
  const [selectedDateClosureReason, setSelectedDateClosureReason] = useState<string | null>(null);
  const [selectedDateOpenTime, setSelectedDateOpenTime] = useState("06:00");
  const [selectedDateCloseTime, setSelectedDateCloseTime] = useState("23:00");

  // Upcoming Schedule Board State
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  // Schedule Management Tab State for Staff
  const [scheduleTargetDate, setScheduleTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [scheduleIsClosed, setScheduleIsClosed] = useState(false);
  const [scheduleClosureReason, setScheduleClosureReason] = useState("");
  const [scheduleOpenTime, setScheduleOpenTime] = useState("06:00");
  const [scheduleCloseTime, setScheduleCloseTime] = useState("23:00");
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // --- Lookup & Cancellation State ---
  const [searchPhone, setSearchPhone] = useState("");
  const [lookupResults, setLookupResults] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [cancelModalBooking, setCancelModalBooking] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Load Auth & Courts & Schedules on mount
  useEffect(() => {
    checkAuth();
    fetchCourts();
    fetchStaffSchedules();
    fetchStaffUpcomingSchedule();
  }, [selectedDate]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
      } else {
        const stored = localStorage.getItem("boss_current_user");
        if (stored) {
          setCurrentUser(JSON.parse(stored));
        }
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
    } catch (e) { }
    localStorage.removeItem("boss_current_user");
    setCurrentUser(null);
  };

  const fetchCourts = async () => {
    try {
      const res = await fetch(`/api/pickleball/availability?date=${selectedDate}`);
      const data = await res.json();
      if (data.success && data.courts) {
        setCourts(data.courts);
        if (!selectedCourt && data.courts.length > 0) {
          setSelectedCourt(data.courts[0].id);
        }
        setSelectedDateIsClosed(Boolean(data.isClosed));
        setSelectedDateClosureReason(data.closureReason || null);
        setSelectedDateOpenTime(data.openTime || "06:00");
        setSelectedDateCloseTime(data.closeTime || "23:00");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStaffUpcomingSchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await fetch("/api/pickleball/bookings");
      const data = await res.json();
      if (data.success && data.bookings) {
        const nowMs = Date.now() - 3600000;
        const upcoming = data.bookings
          .filter((b: any) => b.status !== "CANCELLED" && new Date(b.endTime).getTime() >= nowMs)
          .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setUpcomingBookings(upcoming.length > 0 ? upcoming : data.bookings.filter((b: any) => b.status !== "CANCELLED").slice(0, 6));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const fetchStaffSchedules = async () => {
    try {
      const res = await fetch("/api/admin/schedule");
      const data = await res.json();
      if (data.success && data.schedules) {
        setAllSchedules(data.schedules);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const todayIst = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  const todaySchedule = allSchedules.find((s) => s.date === todayIst) || allSchedules.find((s) => s.date === "DEFAULT") || {
    date: todayIst,
    isClosed: false,
    openTime: "06:00",
    closeTime: "23:00"
  };

  const handleQuickCloseToday = async () => {
    const reason = prompt("Enter closure reason for today (e.g. Heavy Rain, Emergency Maintenance, Store Closed):", "Temporary Maintenance / Closed for the day");
    if (!reason) return;
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayIst,
          isClosed: true,
          closureReason: reason,
          openTime: "06:00",
          closeTime: "23:00",
          staffId: currentUser?.name ? `staff-${currentUser.name}` : "staff-desk",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStaffSchedules();
        fetchCourts();
        alert(`✓ Arena is now officially CLOSED for today (${reason}). Customers cannot book.`);
      } else {
        alert(data.error || "Failed to update status");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleQuickReopenToday = async () => {
    if (!confirm("Re-open the arena today for regular public bookings (06:00 – 23:00)?")) return;
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: todayIst,
          isClosed: false,
          openTime: "06:00",
          closeTime: "23:00",
          staffId: currentUser?.name ? `staff-${currentUser.name}` : "staff-desk",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchStaffSchedules();
        fetchCourts();
        alert("✓ Arena is now OPEN for public bookings today!");
      } else {
        alert(data.error || "Failed to reopen");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleSaveStaffSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleMsg(null);
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: scheduleTargetDate,
          isClosed: scheduleIsClosed,
          closureReason: scheduleIsClosed ? scheduleClosureReason || "Holiday / Maintenance" : undefined,
          openTime: scheduleOpenTime,
          closeTime: scheduleCloseTime,
          staffId: currentUser?.name ? `staff-${currentUser.name}` : "staff-registrar",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScheduleMsg(`✓ Schedule updated: ${data.message}`);
        fetchStaffSchedules();
        fetchCourts();
      } else {
        setScheduleMsg(data.error || "Failed to update schedule");
      }
    } catch (e) {
      setScheduleMsg("Network error occurred");
    } finally {
      setScheduleLoading(false);
    }
  };

  // Quick Book Submit (<10s flow)
  const handleQuickBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookLoading(true);
    setBookMessage(null);

    const [hour, min] = selectedTimeSlot.split(":").map(Number);
    const startObj = new Date(`${selectedDate}T${selectedTimeSlot}:00`);
    const endObj = new Date(startObj.getTime() + durationHours * 60 * 60 * 1000);

    try {
      const res = await fetch("/api/pickleball/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourt,
          startTime: startObj.toISOString(),
          endTime: endObj.toISOString(),
          customerName,
          customerPhone,
          source: bookingSource,
          paymentStatus,
          staffId: currentUser?.name ? `staff-${currentUser.name}` : "staff-registrar",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setBookMessage({
          type: "success",
          text: `Booked! Booking ID: #${data.booking.id.slice(-6).toUpperCase()} | Total: ₹${data.booking.totalPrice}`,
        });
        // reset form
        setCustomerName("");
        setCustomerPhone("");
        fetchCourts();
        fetchStaffUpcomingSchedule();
      } else {
        setBookMessage({ type: "error", text: data.error || "Slot conflict or booking failed" });
      }
    } catch (err: any) {
      setBookMessage({ type: "error", text: "Network error occurred." });
    } finally {
      setBookLoading(false);
    }
  };

  // Lookup Phone
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchPhone) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/pickleball/bookings?phone=${encodeURIComponent(searchPhone)}`);
      const data = await res.json();
      if (data.success) {
        setLookupResults(data.bookings || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLookupLoading(false);
    }
  };

  // Cancel Booking
  const handleStaffCancel = async () => {
    if (!cancelModalBooking) return;
    setCancelLoading(true);
    try {
      const res = await fetch("/api/pickleball/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: cancelModalBooking.id,
          reason: cancelReason || "Cancelled by desk registrar",
          staffId: "staff-registrar",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelModalBooking(null);
        setCancelReason("");
        fetchStaffUpcomingSchedule();
        fetchCourts();
        // refresh lookup
        if (searchPhone) {
          handleLookup({ preventDefault: () => { } } as any);
        }
      } else {
        alert(data.error || "Failed to cancel");
      }
    } catch (e) {
      alert("Error cancelling booking");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b10] text-[#f0f4f8] antialiased selection:bg-[#c7f711] selection:text-black">
      {/* Top Header / Staff Bar */}
      <header className="border-b border-white/10 bg-[#0d141f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
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
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c7f711] text-black px-2 py-0.5 rounded-full">
                  Staff Desk
                </span>
              </div>
              <p className="text-xs text-white/50">Pickleball Court Registrar &amp; Live Schedule Desk</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentUser.role === "OWNER"
                      ? "bg-purple-500 text-white"
                      : "bg-emerald-400 text-black"
                    }`}
                >
                  {currentUser.role === "OWNER" ? "👑 Owner" : "🛡️ Employee"}
                </span>
                <span className="text-xs text-white/90">{currentUser.name}</span>
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
                className="text-xs bg-[#c7f711] text-black font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Employee Login</span>
              </button>
            )}

            <Link
              href="/"
              className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-all"
            >
              Customer Website ↗
            </Link>
            <Link
              href="/admin"
              className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1.5"
            >
              <span>Owner Admin</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Quick Store Control & Emergency Daily Closure Banner */}
        <div className={`p-4 sm:p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xl ${
          todaySchedule?.isClosed
            ? "bg-gradient-to-r from-amber-950/80 to-amber-900/60 border-amber-500/50 text-amber-100"
            : "bg-gradient-to-r from-[#0d141f] to-[#121c2c] border-white/10 text-white"
        }`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl border ${
              todaySchedule?.isClosed
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
            }`}>
              {todaySchedule?.isClosed ? "🏮" : "🟢"}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  Today's Store Status: {todaySchedule?.isClosed ? "CLOSED TODAY" : "OPEN FOR BOOKINGS"}
                </span>
                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${
                  todaySchedule?.isClosed
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                }`}>
                  {todaySchedule?.isClosed
                    ? todaySchedule.closureReason || "Closed"
                    : `Hours: ${todaySchedule?.openTime || "06:00"} – ${todaySchedule?.closeTime || "23:00"}`}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-1">
                {todaySchedule?.isClosed
                  ? "Public bookings are currently LOCKED on the live website. Customers see the holiday/emergency banner."
                  : "Pickleball courts are active. Customers can only book slots within active operating hours."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:self-center">
            {todaySchedule?.isClosed ? (
              <button
                type="button"
                onClick={handleQuickReopenToday}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs tracking-tight shadow-lg transition-all flex items-center gap-2"
              >
                <span>🟢 Reopen Arena for Today</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickCloseToday}
                className="px-5 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-extrabold text-xs tracking-tight transition-all flex items-center gap-2"
              >
                <span>🏮 Close Arena for Today</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 bg-[#0d141f] p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab("pickleball")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "pickleball"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Pickleball Quick-Book (&lt;10s)</span>
            </button>

            <button
              onClick={() => setActiveTab("courts")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "courts"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
              <Layers className="w-4 h-4" />
              <span>Manage Courts</span>
            </button>

            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "gallery"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
              <FileText className="w-4 h-4" />
              <span>Action Gallery</span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "schedule"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Arena Hours &amp; Holiday Closures</span>
            </button>

            <button
              onClick={() => setActiveTab("lookup")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${activeTab === "lookup"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
            >
              <Search className="w-4 h-4" />
              <span>Phone Lookup &amp; Cancel</span>
            </button>
          </div>

          <div className="text-xs text-white/50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Boss Pickleball Desk</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PICKLEBALL QUICK-BOOK (<10s DESK FLOW) & UPCOMING SCHEDULE */}
        {/* ========================================================================= */}
        {activeTab === "pickleball" && (
          <div className="space-y-6">
            {/* Default Live Upcoming Court Schedule Board for Staff Desk */}
            <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#c7f711]" />
                    <span>Live Upcoming Court Schedule &amp; Player Queue</span>
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Real-time feed of confirmed reservations across Court 1, Court 2, and Court 3.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/30 px-3 py-1 rounded-full font-bold">
                    {upcomingBookings.length} Active Games Scheduled
                  </span>
                  <button
                    type="button"
                    onClick={fetchStaffUpcomingSchedule}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white"
                    title="Refresh Schedule"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingSchedule ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {loadingSchedule ? (
                <div className="py-6 text-center text-xs text-white/50">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#c7f711]" />
                  Syncing live court schedule...
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {upcomingBookings.slice(0, 6).map((b) => {
                    const start = new Date(b.startTime);
                    const end = new Date(b.endTime);
                    const dateStr = start.toLocaleDateString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    const timeStr = `${start.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

                    return (
                      <div
                        key={b.id}
                        className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/30">
                              {b.courtName || "Court 1"}
                            </span>
                            <div className="text-white font-bold text-xs mt-1.5">{b.customerName}</div>
                            <div className="text-[11px] text-white/60 font-mono">{b.customerPhone}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-extrabold text-[#c7f711]">₹{b.totalPrice || 400}</div>
                            <span className="text-[9px] text-white/40 font-mono">#{b.id.slice(-6).toUpperCase()}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
                          <div className="text-white/70 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#c7f711]" />
                            <span>{dateStr} • {timeStr}</span>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${b.paymentStatus === "PAID_ONLINE"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : b.paymentStatus === "UPI_COUNTER"
                                  ? "bg-cyan-500/20 text-cyan-400"
                                  : "bg-amber-500/20 text-amber-400"
                              }`}
                          >
                            {b.paymentStatus?.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-2xl">
                  No upcoming reservations currently in queue. Courts 1, 2, and 3 are ready for action.
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Quick-Book Form */}
              <div className="lg:col-span-8 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <span>Counter / Phone Booking</span>
                      <span className="text-xs bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/40 px-2 py-0.5 rounded-full font-mono">
                        Target &lt;10s
                      </span>
                    </h2>
                    <p className="text-xs text-white/60">
                      Instant slot assignment with atomic collision prevention and zero double-booking guarantee.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-white/50 block">Standard Rate</span>
                    <span className="text-lg font-bold text-[#c7f711]">₹400 / hr</span>
                  </div>
                </div>

                {bookMessage && (
                  <div
                    className={`mb-6 p-4 rounded-2xl flex items-center gap-3 border ${bookMessage.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                      }`}
                  >
                    {bookMessage.type === "success" ? (
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    )}
                    <p className="text-sm font-medium">{bookMessage.text}</p>
                  </div>
                )}

                {/* Holiday Notice or Dynamic Hours Badge */}
                {selectedDateIsClosed ? (
                  <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏮</span>
                      <div>
                        <div className="font-bold text-xs uppercase tracking-wider text-amber-100">
                          Holiday Alert: Arena Closed ({selectedDateClosureReason || "Holiday / Maintenance"})
                        </div>
                        <div className="text-[11px] text-amber-300/80">
                          Court reservations on {selectedDate} are currently restricted on the customer site.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("schedule")}
                      className="text-xs bg-amber-400 hover:bg-amber-300 text-black font-bold px-3 py-1.5 rounded-xl transition-all"
                    >
                      Manage Hours / Re-open
                    </button>
                  </div>
                ) : (
                  <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Operating Hours for {selectedDate}: <strong>{selectedDateOpenTime} – {selectedDateCloseTime}</strong></span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScheduleTargetDate(selectedDate);
                        setActiveTab("schedule");
                      }}
                      className="text-[11px] text-white/50 hover:text-white underline"
                    >
                      Change Hours
                    </button>
                  </div>
                )}

                <form onSubmit={handleQuickBook} className="space-y-6">
                  {/* 1. Court Selection */}
                  <div>
                    <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                      1. Select Court
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {courts.map((court) => (
                        <button
                          key={court.id}
                          type="button"
                          onClick={() => setSelectedCourt(court.id)}
                          className={`p-3 rounded-2xl border text-left transition-all ${selectedCourt === court.id
                              ? "bg-[#c7f711] text-black border-[#c7f711] shadow-lg shadow-[#c7f711]/20"
                              : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                            }`}
                        >
                          <div className="font-bold text-sm">{court.name}</div>
                          <div className={`text-[10px] ${selectedCourt === court.id ? "text-black/70" : "text-white/50"}`}>
                            ₹{court.basePricePerHour}/hr
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 2. Date & Time Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        2. Date
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        3. Start Slot
                      </label>
                      <select
                        value={selectedTimeSlot}
                        onChange={(e) => setSelectedTimeSlot(e.target.value)}
                        className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                      >
                        {[
                          "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
                          "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
                          "18:00", "19:00", "20:00", "21:00", "22:00"
                        ].map((slot) => (
                          <option key={slot} value={slot}>
                            {slot}:00 ({Number(slot) >= 12 ? (Number(slot) === 12 ? "12 PM" : `${Number(slot) - 12} PM`) : `${slot} AM`})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        4. Duration
                      </label>
                      <select
                        value={durationHours}
                        onChange={(e) => setDurationHours(Number(e.target.value))}
                        className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                      >
                        <option value={1}>1 Hour (Standard)</option>
                        <option value={2}>2 Hours</option>
                        <option value={3}>3 Hours</option>
                      </select>
                    </div>
                  </div>

                  {/* 3. Customer Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        Customer Name *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Patel"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c7f711]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          required
                          placeholder="10-digit mobile number"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full bg-white/5 border border-white/15 rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c7f711]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. Booking Source & Payment Option */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        Source
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBookingSource("WALKIN")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${bookingSource === "WALKIN"
                              ? "bg-white text-black border-white"
                              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                            }`}
                        >
                          Counter Walk-in
                        </button>
                        <button
                          type="button"
                          onClick={() => setBookingSource("PHONE")}
                          className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${bookingSource === "PHONE"
                              ? "bg-white text-black border-white"
                              : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                            }`}
                        >
                          Phone Booking
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-white/80 block mb-2 uppercase tracking-wider">
                        Payment Status
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("CASH_COUNTER")}
                          className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${paymentStatus === "CASH_COUNTER"
                              ? "bg-emerald-400 text-black border-emerald-400"
                              : "bg-white/5 border-white/10 text-white/70"
                            }`}
                        >
                          Cash Counter
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("UPI_COUNTER")}
                          className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${paymentStatus === "UPI_COUNTER"
                              ? "bg-emerald-400 text-black border-emerald-400"
                              : "bg-white/5 border-white/10 text-white/70"
                            }`}
                        >
                          UPI QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentStatus("PAY_AT_VENUE")}
                          className={`py-2 px-2 rounded-xl border text-[11px] font-bold transition-all text-center ${paymentStatus === "PAY_AT_VENUE"
                              ? "bg-amber-400 text-black border-amber-400"
                              : "bg-white/5 border-white/10 text-white/70"
                            }`}
                        >
                          Pay at Venue
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 5. Official Equipment Provided */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-white/70">
                      <span className="font-semibold text-white block">Official Tournament Equipment Included</span>
                      Official JOOLA pro carbon fiber paddles &amp; optic tournament balls provided complimentary by club reception.
                    </div>
                    <span className="text-xs font-bold text-[#c7f711] bg-[#c7f711]/10 border border-[#c7f711]/30 px-3 py-1.5 rounded-full">
                      ✓ Included Free
                    </span>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={bookLoading || selectedDateIsClosed}
                    className="w-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-sm py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#c7f711]/20 disabled:opacity-50"
                  >
                    {bookLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying Slot Collision &amp; Booking...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        <span>Confirm &amp; Issue Receipt (₹{durationHours * 400})</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Quick Summary & Recent Court Activity */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6">
                  <h3 className="font-bold text-sm text-white mb-3 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#c7f711]" />
                    <span>Registrar Operating Rules</span>
                  </h3>
                  <ul className="text-xs text-white/70 space-y-2.5">
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c7f711] mt-1.5 flex-shrink-0" />
                      <span>Every booking enforces atomic interval checks (`start &lt; endB &amp;&amp; end &gt; startB`).</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c7f711] mt-1.5 flex-shrink-0" />
                      <span>Online holds expire automatically after 10 minutes unless paid.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c7f711] mt-1.5 flex-shrink-0" />
                      <span>Always verify UPI payments on the counter soundbox before releasing receipt.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#c7f711] mt-1.5 flex-shrink-0" />
                      <span>Customer self-cancellations are blocked within 2 hours of slot start. Desk staff can cancel with recorded reason.</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-gradient-to-br from-[#0d141f] to-[#122030] border border-white/10 rounded-3xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-sm text-white">Court Status Today</h4>
                    <span className="text-[10px] text-white/50">{selectedDate}</span>
                  </div>
                  <div className="space-y-3">
                    {courts.map((court) => (
                      <div
                        key={court.id}
                        className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-semibold text-xs text-white">{court.name}</div>
                          <div className="text-[10px] text-white/50">Pickleball Arena</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Operational
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: COURT MANAGEMENT (STAFF DESK ACCESS) */}
        {/* ========================================================================= */}
        {activeTab === "courts" && (
          <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <CourtManager userRole="STAFF" onCourtChanged={fetchCourts} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: GALLERY PUBLISHER (STAFF DESK ACCESS) */}
        {/* ========================================================================= */}
        {activeTab === "gallery" && (
          <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <GalleryManager userRole="STAFF" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: ARENA OPERATING HOURS & HOLIDAY CLOSURES (STAFF DESK ACCESS) */}
        {/* ========================================================================= */}
        {activeTab === "schedule" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Arena Operating Hours &amp; Holiday Closures</h2>
                  <p className="text-xs text-white/60 mt-1">
                    Mark festival holidays (e.g. Diwali Holiday) or configure custom arena operating hours.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full">
                  Desk Control
                </span>
              </div>

              {scheduleMsg && (
                <div className="mb-6 p-4 rounded-xl text-xs font-semibold bg-[#c7f711]/10 text-[#c7f711] border border-[#c7f711]/30">
                  {scheduleMsg}
                </div>
              )}

              <form onSubmit={handleSaveStaffSchedule} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">
                    Target Date for Special Schedule / Holiday
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleTargetDate}
                    onChange={(e) => setScheduleTargetDate(e.target.value)}
                    className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleIsClosed(false)}
                    className={`p-4 rounded-2xl border text-left transition-all ${!scheduleIsClosed
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-md"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                      }`}
                  >
                    <div className="font-bold text-sm">🟢 Arena Open</div>
                    <div className="text-[11px] opacity-75 mt-1">Set opening &amp; closing hours</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleIsClosed(true)}
                    className={`p-4 rounded-2xl border text-left transition-all ${scheduleIsClosed
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                      }`}
                  >
                    <div className="font-bold text-sm">🏮 Closed (Holiday / Private)</div>
                    <div className="text-[11px] opacity-75 mt-1">Lock slots with holiday notice</div>
                  </button>
                </div>

                {scheduleIsClosed ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <label className="text-xs font-semibold text-amber-200 block">
                      Closure / Holiday Reason (Shown to Customers) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diwali Festive Holiday, Monsoon Court Resurfacing"
                      value={scheduleClosureReason}
                      onChange={(e) => setScheduleClosureReason(e.target.value)}
                      className="w-full bg-[#161f2e] border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {["Diwali Festive Holiday", "Monsoon Maintenance", "National Championship", "New Year Eve"].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setScheduleClosureReason(preset)}
                          className="text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded-full border border-white/10"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-white/80 block mb-2">
                          Arena Opening Time
                        </label>
                        <input
                          type="time"
                          value={scheduleOpenTime}
                          onChange={(e) => setScheduleOpenTime(e.target.value)}
                          className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-white/80 block mb-2">
                          Arena Closing Time
                        </label>
                        <input
                          type="time"
                          value={scheduleCloseTime}
                          onChange={(e) => setScheduleCloseTime(e.target.value)}
                          className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-white/50 block mb-2">Presets:</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOpenTime("06:00");
                            setScheduleCloseTime("23:00");
                          }}
                          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-center text-xs text-white"
                        >
                          <span className="font-semibold block">Regular</span>
                          <span className="text-[10px] text-white/50">6:00 AM – 11:00 PM</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOpenTime("17:00");
                            setScheduleCloseTime("05:00");
                          }}
                          className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-center text-xs text-purple-300"
                        >
                          <span className="font-semibold block">5 PM – 5 AM</span>
                          <span className="text-[10px] opacity-75">Overnight next morning</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOpenTime("18:00");
                            setScheduleCloseTime("10:00");
                          }}
                          className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-center text-xs text-cyan-300"
                        >
                          <span className="font-semibold block">6 PM – 10 AM</span>
                          <span className="text-[10px] opacity-75">Night Owl to morning</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={scheduleLoading}
                  className="w-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-[#c7f711]/20 disabled:opacity-50"
                >
                  {scheduleLoading ? "Saving Schedule..." : "Save Arena Schedule for Selected Date"}
                </button>
              </form>
            </div>

            <div className="lg:col-span-5 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center justify-between">
                <span>Configured Schedules &amp; Closures</span>
                <span className="text-xs text-white/50 font-normal">{allSchedules.length} active</span>
              </h3>
              <p className="text-xs text-white/60">
                Any closure or custom window configured here immediately updates customer booking slots in real time.
              </p>

              <div className="space-y-3 pt-2 max-h-[460px] overflow-y-auto pr-1">
                {allSchedules.map((item, idx) => (
                  <div
                    key={item.date || idx}
                    className={`p-3.5 rounded-2xl border ${item.isClosed
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-white/5 border-white/10"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs font-mono text-white">
                        {item.date === "DEFAULT" ? "DEFAULT (Daily)" : item.date}
                      </span>
                      {item.isClosed ? (
                        <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                          Closed / Holiday
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                          Open ({item.openTime} – {item.closeTime})
                        </span>
                      )}
                    </div>
                    {item.isClosed && item.closureReason && (
                      <p className="text-xs text-amber-200/80 mt-1.5 font-medium">
                        Reason: {item.closureReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PHONE LOOKUP & CANCELLATION ENGINE */}
        {/* ========================================================================= */}
        {activeTab === "lookup" && (
          <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <div className="max-w-2xl mb-8">
              <h2 className="text-xl font-bold text-white mb-2">Customer Booking Lookup &amp; Management</h2>
              <p className="text-xs text-white/60">
                Search all past and upcoming Pickleball reservations by customer mobile number. Manage cancellations with audit notes.
              </p>

              <form onSubmit={handleLookup} className="mt-4 flex gap-3">
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-white/40 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="Enter customer 10-digit phone number..."
                    value={searchPhone}
                    onChange={(e) => setSearchPhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#c7f711]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={lookupLoading}
                  className="px-6 bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-bold text-xs rounded-2xl transition-all flex items-center gap-2"
                >
                  {lookupLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>Search Bookings</span>
                </button>
              </form>
            </div>

            {/* Results Table */}
            {lookupResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider">
                      <th className="py-3 px-4">Booking Ref</th>
                      <th className="py-3 px-4">Court</th>
                      <th className="py-3 px-4">Slot Time</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {lookupResults.map((b) => (
                      <tr key={b.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-white">
                          #{b.id.slice(-6).toUpperCase()}
                        </td>
                        <td className="py-3.5 px-4 text-white/90 font-medium">{b.courtName}</td>
                        <td className="py-3.5 px-4 text-white/70">
                          {new Date(b.startTime).toLocaleString("en-IN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#c7f711]">₹{b.totalPrice}</td>
                        <td className="py-3.5 px-4">
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                            {b.paymentStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${b.status === "CONFIRMED"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : b.status === "CANCELLED"
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {b.status === "CONFIRMED" ? (
                            <button
                              onClick={() => setCancelModalBooking(b)}
                              className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1.5 rounded-xl font-medium transition-all"
                            >
                              Cancel Slot
                            </button>
                          ) : (
                            <span className="text-[10px] text-white/40 italic">
                              {b.cancellationReason || "No actions"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center border border-dashed border-white/10 rounded-2xl text-white/40 text-xs">
                {searchPhone
                  ? "No bookings found for this phone number."
                  : "Enter a 10-digit mobile number above to inspect customer history."}
              </div>
            )}

            {/* Cancel Modal */}
            {cancelModalBooking && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-[#0d141f] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-md w-full">
                  <div className="flex items-center gap-3 text-red-400 mb-4">
                    <ShieldAlert className="w-6 h-6" />
                    <h3 className="font-bold text-lg text-white">Confirm Desk Cancellation</h3>
                  </div>
                  <p className="text-xs text-white/70 mb-4">
                    Cancelling booking <strong className="text-white">#{cancelModalBooking.id.slice(-6).toUpperCase()}</strong> for {cancelModalBooking.customerName}.
                  </p>

                  <div className="mb-4">
                    <label className="text-xs font-semibold text-white/80 block mb-1">
                      Reason for Cancellation (Audit Log) *
                    </label>
                    <textarea
                      required
                      placeholder="e.g. Customer called to reschedule, rain cancellation, etc."
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-white/30 focus:outline-none focus:border-red-400 h-24"
                    />
                  </div>

                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => setCancelModalBooking(null)}
                      className="px-4 py-2 rounded-xl text-xs text-white/70 hover:text-white border border-white/10"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={handleStaffCancel}
                      disabled={cancelLoading || !cancelReason}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all disabled:opacity-50"
                    >
                      {cancelLoading ? "Processing..." : "Confirm Cancellation"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
        }}
      />
    </div>
  );
}

