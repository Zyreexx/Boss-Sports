"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Shield,
  Layers,
  Calendar,
  Clock,
  Settings,
  AlertTriangle,
  CheckCircle,
  Database,
  ArrowLeft,
  RefreshCw,
  Plus,
  Lock,
  Tag,
  FileText,
  UserCheck,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";
import CourtManager from "@/components/CourtManager";
import GalleryManager from "@/components/GalleryManager";

export default function OwnerAdminPage() {
  const [activeTab, setActiveTab] = useState<"reports" | "courts" | "gallery" | "pricing" | "schedule" | "blocks">("reports");

  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  // Report Data
  const [reportData, setReportData] = useState<any | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const todayIst = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  // Upcoming Schedule Data
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Pricing Rule form
  const [courts, setCourts] = useState<any[]>([]);
  const [basePrice, setBasePrice] = useState(400);
  const [peakSurgePrice, setPeakSurgePrice] = useState(550);
  const [isPeakSurgeActive, setIsPeakSurgeActive] = useState(true);
  const [peakHours, setPeakHours] = useState<string[]>(["18:00", "19:00", "20:00", "21:00", "22:00"]);
  const [pricingMsg, setPricingMsg] = useState<string | null>(null);

  // Schedule & Holiday form
  const [scheduleDate, setScheduleDate] = useState(todayIst);
  const [scheduleIsClosed, setScheduleIsClosed] = useState(false);
  const [scheduleClosureReason, setScheduleClosureReason] = useState("");
  const [scheduleOpenTime, setScheduleOpenTime] = useState("06:00");
  const [scheduleCloseTime, setScheduleCloseTime] = useState("23:00");
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Court Block form
  const [blockCourtId, setBlockCourtId] = useState("");
  const [blockDate, setBlockDate] = useState(todayIst);
  const [blockStartTime, setBlockStartTime] = useState("10:00");
  const [blockEndTime, setBlockEndTime] = useState("12:00");
  const [blockReason, setBlockReason] = useState<"MAINTENANCE" | "TOURNAMENT" | "COACHING" | "PRIVATE_EVENT">("MAINTENANCE");
  const [blockNotes, setBlockNotes] = useState("");
  const [blockMsg, setBlockMsg] = useState<string | null>(null);

  const isOwnerAuthorized = Boolean(currentUser && currentUser.role === "OWNER");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isOwnerAuthorized) return;

    fetchReports();
    fetchCourts();
    fetchPricingConfig();
    fetchSchedules();
    fetchAdminBookings();

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchReports();
        fetchAdminBookings();
        fetchSchedules();
      }
    }, 8000);

    const handleFocusRefresh = () => {
      if (document.visibilityState === "visible") {
        fetchReports();
        fetchAdminBookings();
        fetchSchedules();
      }
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
    };
  }, [isOwnerAuthorized]);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
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
    setReportData(null);
    setUpcomingBookings([]);
  };

  const fetchReports = async () => {
    setReportLoading(true);
    setReportError(null);
    try {
      const res = await fetch("/api/admin/reports", { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        setReportError("Your session has expired. Please sign in again.");
        return;
      }
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data);
      } else {
        setReportError(data.error || "Unable to fetch financial report.");
      }
    } catch {
      setReportError("Network error fetching audit reports.");
    } finally {
      setReportLoading(false);
    }
  };

  const fetchAdminBookings = async () => {
    setBookingsLoading(true);
    try {
      const res = await fetch("/api/pickleball/bookings", { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        setUpcomingBookings([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.bookings) {
        const nowMs = Date.now() - 3600000;
        const upcoming = data.bookings
          .filter((b: any) => b.status !== "CANCELLED" && new Date(b.endTime).getTime() >= nowMs)
          .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        setUpcomingBookings(upcoming.length > 0 ? upcoming : data.bookings.filter((b: any) => b.status !== "CANCELLED").slice(0, 6));
      } else if (!res.ok) {
        setReportError((prev) => prev || data.error || "Unable to fetch bookings from backend.");
      }
    } catch {
      setReportError((prev) => prev || "Network error fetching bookings from backend.");
    } finally {
      setBookingsLoading(false);
    }
  };

  const fetchCourts = async () => {
    try {
      const res = await fetch("/api/pickleball/availability", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.courts) {
        setCourts(data.courts);
        if (data.courts.length > 0 && !blockCourtId) {
          setBlockCourtId(data.courts[0].id);
        }
      } else if (!res.ok) {
        setReportError((prev) => prev || data.error || "Unable to fetch court availability.");
      }
    } catch {
      setReportError((prev) => prev || "Network error fetching court availability.");
    }
  };

  const fetchPricingConfig = async () => {
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.pricingConfig) {
        setBasePrice(data.pricingConfig.basePricePerHour || 400);
        setPeakSurgePrice(data.pricingConfig.peakSurgePricePerHour || 550);
        setIsPeakSurgeActive(data.pricingConfig.isPeakSurgeActive ?? true);
        if (data.pricingConfig.peakHours) {
          setPeakHours(data.pricingConfig.peakHours);
        }
      } else if (!res.ok) {
        setPricingMsg(data.error || "Unable to load pricing configuration.");
      }
    } catch {
      setPricingMsg("Network error loading pricing configuration.");
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/api/admin/schedule", { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && data.schedules) {
        setAllSchedules(data.schedules);
      } else if (!res.ok) {
        setScheduleMsg(data.error || "Unable to load schedules from backend.");
      }
    } catch {
      setScheduleMsg("Network error loading arena schedules.");
    }
  };

  const handleUpdatePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPricingMsg(null);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basePrice: Number(basePrice),
          peakSurgePrice: Number(peakSurgePrice),
          isPeakSurgeActive,
          peakHours,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPricingMsg("✓ Pricing rules & Peak Surge Rate updated successfully!");
        fetchPricingConfig();
      } else {
        setPricingMsg(data.error || "Update failed");
      }
    } catch (e) {
      setPricingMsg("Network error occurred");
    }
  };

  const todaySchedule = allSchedules.find((s) => s.date === todayIst) || allSchedules.find((s) => s.date === "DEFAULT") || {
    date: todayIst,
    isClosed: false,
    openTime: "06:00",
    closeTime: "23:00"
  };

  const handleQuickCloseToday = async () => {
    const reason = prompt("Enter closure reason for today (e.g. Heavy Rain, Emergency Maintenance, Store Closed for the Day):", "Store Closed / Maintenance");
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
        fetchReports();
        alert(`✓ Arena is now officially CLOSED for today (${reason}). Public bookings are locked.`);
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
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
        fetchReports();
        alert("✓ Arena is now OPEN for public bookings today!");
      } else {
        alert(data.error || "Failed to reopen");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleMsg(null);
    setScheduleLoading(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: scheduleDate,
          isClosed: scheduleIsClosed,
          closureReason: scheduleIsClosed ? scheduleClosureReason || "Holiday / Maintenance" : undefined,
          openTime: scheduleOpenTime,
          closeTime: scheduleCloseTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setScheduleMsg(`✓ Schedule updated: ${data.message}`);
        fetchSchedules();
      } else {
        setScheduleMsg(data.error || "Failed to update schedule");
      }
    } catch (e) {
      setScheduleMsg("Network error occurred");
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleResetSchedule = async (date: string) => {
    if (!confirm(`Reset schedule for ${date} back to regular 06:00 – 23:00 hours?`)) return;
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          isClosed: false,
          openTime: "06:00",
          closeTime: "23:00",
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchSchedules();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlockMsg(null);
    const startIso = new Date(`${blockDate}T${blockStartTime}:00+05:30`).toISOString();
    const endIso = new Date(`${blockDate}T${blockEndTime}:00+05:30`).toISOString();

    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: blockCourtId,
          startTime: startIso,
          endTime: endIso,
          reason: blockReason,
          notes: blockNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBlockMsg("Schedule block created successfully!");
        setBlockNotes("");
        fetchAdminBookings();
        fetchReports();
        fetchCourts();
      } else {
        setBlockMsg(data.error || "Failed to block slot");
      }
    } catch (e) {
      setBlockMsg("Network error occurred");
    }
  };

  return (
    <div className="min-h-screen bg-[#070b10] text-[#f0f4f8] antialiased selection:bg-[#c7f711] selection:text-black">
      {/* Top Bar */}
      <header className="border-b border-white/10 bg-[#0d141f]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3">
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
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/40 px-2 py-0.5 rounded-full">
                  Owner Executive Suite
                </span>
              </div>
              <p className="text-xs text-white/50">Pickleball Court Bookings, Cash/UPI Audit &amp; Arena Schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && currentUser.role === "OWNER" ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500 text-white">
                  👑 Owner
                </span>
                <span className="text-xs text-white/90">{currentUser.name}</span>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-white/40 hover:text-white underline ml-1"
                >
                  Sign Out
                </button>
              </div>
            ) : currentUser ? (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                <span className="text-xs text-white/90">{currentUser.name} ({currentUser.role})</span>
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
                className="text-xs bg-purple-500 hover:bg-purple-600 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Owner Login</span>
              </button>
            )}

            {(currentUser?.role === "OWNER" || currentUser?.role === "EMPLOYEE") && (
              <Link
                href="/staff"
                className="text-xs bg-white/10 hover:bg-white/20 text-white font-medium px-3.5 py-1.5 rounded-lg border border-white/20 transition-all flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Staff Desk</span>
              </Link>
            )}
            <Link
              href="/"
              className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-all"
            >
              Customer Website ↗
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!authChecked ? (
          <div className="p-16 text-center text-white/50 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#c7f711]" />
            Verifying Owner access...
          </div>
        ) : !isOwnerAuthorized ? (
          <div className="max-w-lg mx-auto my-12 p-8 rounded-3xl bg-[#0d141f] border border-white/10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Owner Authorization Required</h2>
            <p className="text-xs text-white/60 leading-relaxed">
              {currentUser
                ? `Signed in as ${currentUser.name} (${currentUser.role}). Financial reports, pricing rules, and court management require an OWNER account.`
                : "Please sign in with an authorized OWNER account to view executive financial reports and manage the arena."}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              {!currentUser && (
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="px-5 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white font-extrabold text-xs transition-all"
                >
                  Owner Sign In
                </button>
              )}
              {currentUser?.role === "EMPLOYEE" && (
                <Link
                  href="/staff"
                  className="px-5 py-2.5 rounded-xl bg-[#c7f711] text-black font-extrabold text-xs transition-all"
                >
                  Go to Staff Desk
                </Link>
              )}
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                Return to Booking Site
              </Link>
            </div>
          </div>
        ) : (
          <>
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

        {/* Nav Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
          <div className="flex flex-wrap items-center gap-2 bg-[#0d141f] p-1.5 rounded-2xl border border-white/10">
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "reports"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Financial &amp; Cash/UPI Audit</span>
            </button>

            <button
              onClick={() => setActiveTab("courts")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "courts"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Courts &amp; Capacity</span>
            </button>

            <button
              onClick={() => setActiveTab("gallery")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "gallery"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Action Gallery</span>
            </button>

            <button
              onClick={() => setActiveTab("pricing")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "pricing"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Pickleball Pricing &amp; Peak Surge</span>
            </button>

            <button
              onClick={() => setActiveTab("schedule")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "schedule"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Arena Hours &amp; Holiday Closures</span>
            </button>

            <button
              onClick={() => setActiveTab("blocks")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs tracking-wide transition-all ${
                activeTab === "blocks"
                  ? "bg-[#c7f711] text-black shadow-lg shadow-[#c7f711]/20"
                  : "text-white/70 hover:text-white hover:bg-white/5"
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Court Maintenance Blocks</span>
            </button>
          </div>

          <button
            onClick={() => {
              fetchReports();
              fetchPricingConfig();
              fetchSchedules();
            }}
            className="flex items-center gap-1.5 text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${reportLoading ? "animate-spin" : ""}`} />
            <span>Refresh State</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: REPORTS & RECONCILIATION */}
        {/* ========================================================================= */}
        {activeTab === "reports" && reportLoading && !reportData && (
          <div className="p-16 text-center rounded-3xl bg-[#0d141f] border border-white/10 text-white/60 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-3 text-[#c7f711]" />
            Loading live financial reconciliation &amp; revenue audit...
          </div>
        )}

        {activeTab === "reports" && reportError && (
          <div className="p-6 sm:p-8 rounded-3xl bg-amber-950/30 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              <div>
                <div className="font-bold text-sm text-white">Unable to Load Latest Financial Report</div>
                <p className="text-amber-200/80 mt-0.5">
                  {reportError}
                  {reportData ? " Showing previously loaded data below." : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchReports}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold"
            >
              Retry Audit Load
            </button>
          </div>
        )}

        {activeTab === "reports" && reportData && (
          <div className="space-y-6">
            {/* Top Reconciliation Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-3xl bg-[#0d141f] border border-white/10 relative overflow-hidden">
                <div className="text-xs text-white/50 uppercase tracking-wider font-semibold">Realized Collected Revenue</div>
                <div className="text-3xl font-extrabold text-white mt-2">
                  ₹{(reportData.summary.realizedRevenue ?? reportData.summary.grandTotalRevenue ?? 0).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-[#c7f711] mt-2 flex items-center gap-1">
                  <span>Cash + UPI + Paid Online Only</span>
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d141f] border border-amber-500/20 relative overflow-hidden">
                <div className="text-xs text-amber-400 uppercase tracking-wider font-semibold">Pending Venue Payments</div>
                <div className="text-3xl font-extrabold text-amber-400 mt-2">
                  ₹{(reportData.summary.pendingVenuePayment ?? 0).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-white/50 mt-2">
                  Gross Booked Value: ₹{(reportData.summary.grossBookedValue ?? 0).toLocaleString("en-IN")}
                </div>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d141f] border border-emerald-500/20 relative overflow-hidden">
                <div className="text-xs text-emerald-400 uppercase tracking-wider font-semibold">Cash Counter Intake</div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-2">
                  ₹{(reportData.summary.totalCashReconciliation ?? 0).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-white/50 mt-2">Physical Cash in Counter Drawer</div>
              </div>

              <div className="p-5 rounded-3xl bg-[#0d141f] border border-cyan-500/20 relative overflow-hidden">
                <div className="text-xs text-cyan-400 uppercase tracking-wider font-semibold">UPI &amp; Online Intake</div>
                <div className="text-3xl font-extrabold text-cyan-400 mt-2">
                  ₹{((reportData.summary.totalUpiReconciliation ?? 0) + (reportData.summary.totalOnlineReconciliation ?? 0)).toLocaleString("en-IN")}
                </div>
                <div className="text-[11px] text-white/50 mt-2">
                  Counter UPI: ₹{(reportData.summary.totalUpiReconciliation ?? 0).toLocaleString("en-IN")} • Online: ₹{(reportData.summary.totalOnlineReconciliation ?? 0).toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Default Live Upcoming Court Schedule Board for Owner */}
            <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#c7f711]" />
                    <span>Live Upcoming Court Schedule &amp; Reservations</span>
                  </h2>
                  <p className="text-xs text-white/60 mt-0.5">
                    Real-time queue of confirmed matches across Court 1, Court 2, and Court 3 (All times in IST Asia/Kolkata).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/30 px-3 py-1 rounded-full font-bold">
                    {upcomingBookings.length} Active Games Scheduled
                  </span>
                  <button
                    onClick={fetchAdminBookings}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white"
                    title="Refresh Schedule"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${bookingsLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {bookingsLoading && upcomingBookings.length === 0 ? (
                <div className="py-8 text-center text-xs text-white/50">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#c7f711]" />
                  Syncing live court schedule...
                </div>
              ) : upcomingBookings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider text-[10px]">
                        <th className="py-3 px-3">Date &amp; Time (IST)</th>
                        <th className="py-3 px-3">Court</th>
                        <th className="py-3 px-3">Customer</th>
                        <th className="py-3 px-3">Contact</th>
                        <th className="py-3 px-3">Booking ID</th>
                        <th className="py-3 px-3">Payment</th>
                        <th className="py-3 px-3">Amount</th>
                        <th className="py-3 px-3">Source</th>
                        <th className="py-3 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {upcomingBookings.map((b) => {
                        const start = new Date(b.startTime);
                        const end = new Date(b.endTime);
                        const dateStr = start.toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        });
                        const timeStr = `${start.toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })} - ${end.toLocaleTimeString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}`;

                        return (
                          <tr key={b.id} className="hover:bg-white/5 transition-colors text-white/90">
                            <td className="py-3 px-3 font-medium whitespace-nowrap">
                              <div className="text-white font-semibold">{dateStr}</div>
                              <div className="text-[11px] text-white/50 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-[#c7f711]" />
                                <span>{timeStr}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-white/10 text-white border border-white/10">
                                {b.courtName || "Court 1"}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-white whitespace-nowrap">
                              {b.customerName}
                            </td>
                            <td className="py-3 px-3 text-white/60 font-mono whitespace-nowrap text-[11px]">
                              {b.customerPhone}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-white/50 whitespace-nowrap">
                              #{b.id.slice(-6).toUpperCase()}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                  b.paymentStatus === "PAID_ONLINE" || b.paymentStatus === "CASH_COUNTER"
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : b.paymentStatus === "UPI_COUNTER"
                                    ? "bg-cyan-500/20 text-cyan-400"
                                    : "bg-amber-500/20 text-amber-400"
                                }`}
                              >
                                {b.paymentStatus?.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-[#c7f711] whitespace-nowrap">
                              ₹{b.totalPrice || 400}
                            </td>
                            <td className="py-3 px-3 text-[11px] text-white/50 uppercase whitespace-nowrap font-medium">
                              {b.source}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-white/40 border border-dashed border-white/10 rounded-2xl">
                  No upcoming reservations currently in queue. Courts 1, 2, and 3 are ready for action.
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Database 1: Pickleball */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#0d141f] border border-white/10">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                  <div className="flex items-center gap-2.5">
                    <Database className="w-5 h-5 text-[#c7f711]" />
                    <div>
                      <h3 className="font-bold text-white text-base">Pickleball Database</h3>
                      <p className="text-[11px] text-white/50">Persistent Booking &amp; Audit Ledger</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/30">
                    Active Store
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Total Confirmed Bookings:</span>
                    <span className="font-bold text-white font-mono">{reportData.pickleballDatabase.totalBookings}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Realized Collected Revenue:</span>
                    <span className="font-bold text-[#c7f711] font-mono text-sm">₹{reportData.pickleballDatabase.realizedRevenue ?? reportData.pickleballDatabase.totalRevenue}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Pending Collection at Venue:</span>
                    <span className="font-bold text-amber-400 font-mono">₹{reportData.pickleballDatabase.pendingVenuePayment ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Gross Booked Value (All Active):</span>
                    <span className="font-bold text-white font-mono">₹{reportData.pickleballDatabase.grossBookedValue ?? 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Cash Collected at Counter:</span>
                    <span className="font-bold text-white font-mono">₹{reportData.pickleballDatabase.cashRevenue}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">UPI QR Counter Revenue:</span>
                    <span className="font-bold text-white font-mono">₹{reportData.pickleballDatabase.upiCounterRevenue}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5 text-xs">
                    <span className="text-white/60">Online Verified Payments:</span>
                    <span className="font-bold text-white font-mono">₹{reportData.pickleballDatabase.onlineRevenue}</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-xs text-white/60 block mb-2 font-semibold">Booking Channel Breakdown:</span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2.5 rounded-xl bg-white/5">
                        <div className="text-[10px] text-white/40 uppercase">Online Web</div>
                        <div className="font-bold text-sm text-white mt-0.5">{reportData.pickleballDatabase.channelBreakdown.online}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/5">
                        <div className="text-[10px] text-white/40 uppercase">Phone Desk</div>
                        <div className="font-bold text-sm text-white mt-0.5">{reportData.pickleballDatabase.channelBreakdown.phone}</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-white/5">
                        <div className="text-[10px] text-white/40 uppercase">Counter Walk-in</div>
                        <div className="font-bold text-sm text-white mt-0.5">{reportData.pickleballDatabase.channelBreakdown.walkin}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operating Specs & Court Utilization */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#0d141f] border border-white/10">
                <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-[#c7f711]" />
                    <div>
                      <h3 className="font-bold text-white text-base">Court Infrastructure &amp; Rules</h3>
                      <p className="text-[11px] text-white/50">{courts.length || 3} Active Courts Configured</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/30">
                    Official Spec
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">Active Courts Available:</span>
                    <span className="font-bold text-white font-mono">{courts.filter((c) => c.isActive !== false).length || courts.length} Active Courts</span>
                  </div>
                  {courts.map((c) => (
                    <div key={c.id} className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-white/60">{c.name}:</span>
                      <span className={`font-bold ${c.isActive === false ? "text-amber-400" : "text-emerald-400"}`}>
                        {c.isActive === false ? "Paused" : "Operational"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">Equipment Desk:</span>
                    <span className="font-bold text-neutral-300">Managed at venue reception</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/60">Booking Validation:</span>
                    <span className="font-bold text-emerald-400">Server overlap check + 10-min checkout hold</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: COURT MANAGEMENT (Owner & Staff) */}
        {/* ========================================================================= */}
        {activeTab === "courts" && (
          <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <CourtManager userRole="OWNER" onCourtChanged={fetchCourts} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: GALLERY MANAGEMENT (Owner & Staff) */}
        {/* ========================================================================= */}
        {activeTab === "gallery" && (
          <div className="bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <GalleryManager userRole="OWNER" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PRICING & PEAK SURGE RULES */}
        {/* ========================================================================= */}
        {activeTab === "pricing" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Pickleball Court Pricing &amp; Surge Rates</h2>
                  <p className="text-xs text-white/60 mt-1">
                    Configure standard hourly pricing and dynamic peak surge rates across all 3 courts.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#c7f711]/20 text-[#c7f711] border border-[#c7f711]/40 px-3 py-1 rounded-full">
                  Real-time Engine
                </span>
              </div>

              {pricingMsg && (
                <div className="mb-6 p-4 rounded-xl text-xs font-semibold bg-[#c7f711]/10 text-[#c7f711] border border-[#c7f711]/30">
                  {pricingMsg}
                </div>
              )}

              <form onSubmit={handleUpdatePricing} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <label className="text-xs font-semibold text-white/80 block mb-1">
                      Standard Base Price (₹ / hr)
                    </label>
                    <span className="text-[11px] text-white/40 block mb-2">Off-peak morning &amp; afternoon</span>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-sm font-bold text-[#c7f711]">₹</span>
                      <input
                        type="number"
                        min={100}
                        max={2000}
                        value={basePrice}
                        onChange={(e) => setBasePrice(Number(e.target.value))}
                        className="w-full bg-[#161f2e] border border-white/15 rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-[#c7f711]"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20">
                    <label className="text-xs font-semibold text-purple-200 block mb-1">
                      Peak Surge Price (₹ / hr)
                    </label>
                    <span className="text-[11px] text-purple-300/60 block mb-2">Evening high-demand slots</span>
                    <div className="relative">
                      <span className="absolute left-3.5 top-3 text-sm font-bold text-purple-400">₹</span>
                      <input
                        type="number"
                        min={100}
                        max={3000}
                        value={peakSurgePrice}
                        onChange={(e) => setPeakSurgePrice(Number(e.target.value))}
                        className="w-full bg-[#161f2e] border border-purple-500/30 rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-white focus:outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Peak Surge Toggle */}
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white block">Enable Peak Surge Pricing</span>
                    <span className="text-xs text-white/50">
                      When enabled, evening peak slots automatically bill at ₹{peakSurgePrice}/hr instead of ₹{basePrice}/hr
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPeakSurgeActive(!isPeakSurgeActive)}
                    className={`w-14 h-8 rounded-full transition-colors relative p-1 flex items-center ${
                      isPeakSurgeActive ? "bg-[#c7f711]" : "bg-white/20"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-black transition-transform ${
                        isPeakSurgeActive ? "translate-x-6" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Peak Hours Checklist */}
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">
                    Peak Surge Time Windows (Select active peak hours):
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {["17:00", "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"].map((hour) => {
                      const isSelected = peakHours.includes(hour);
                      return (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setPeakHours(peakHours.filter((h) => h !== hour));
                            } else {
                              setPeakHours([...peakHours, hour]);
                            }
                          }}
                          className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-purple-600 text-white border-purple-400 shadow-md"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          }`}
                        >
                          {hour} ({Number(hour.slice(0, 2)) >= 12 ? `${Number(hour.slice(0, 2)) - 12} PM` : hour})
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white/60">
                  <span className="text-[#c7f711] font-semibold">ℹ Note:</span> Venue pricing applies per booked court hour based on active base and peak surge settings; ask desk staff regarding equipment availability or rentals.
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-[#c7f711]/20"
                >
                  Save Pricing &amp; Peak Surge Rules
                </button>
              </form>
            </div>

            {/* Active Courts Summary Card */}
            <div className="lg:col-span-5 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#c7f711]" />
                <span>Active Courts &amp; Rate Structure</span>
              </h3>
              <p className="text-xs text-white/60">
                Boss Pickleball operates 3 courts validated with server-side slot overlap checks.
              </p>

              <div className="space-y-3 pt-2">
                {courts.map((c) => (
                  <div key={c.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-sm text-white">{c.name}</div>
                      <div className="text-[11px] text-white/50">Pickleball Arena</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-[#c7f711]">₹{basePrice}/hr</div>
                      <div className="text-[10px] text-purple-300">Peak: ₹{peakSurgePrice}/hr</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ARENA OPERATING HOURS & HOLIDAY CLOSURES */}
        {/* ========================================================================= */}
        {activeTab === "schedule" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Form Column */}
            <div className="lg:col-span-7 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">Arena Operating Hours &amp; Holiday Closures</h2>
                  <p className="text-xs text-white/60 mt-1">
                    Set arena holiday closures (e.g. Diwali Holiday) or adjust custom opening/closing hours for any specific date.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full">
                  Dynamic Schedule
                </span>
              </div>

              {scheduleMsg && (
                <div className="mb-6 p-4 rounded-xl text-xs font-semibold bg-[#c7f711]/10 text-[#c7f711] border border-[#c7f711]/30">
                  {scheduleMsg}
                </div>
              )}

              <form onSubmit={handleSaveSchedule} className="space-y-6">
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">
                    Target Date for Special Schedule / Holiday
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                  />
                </div>

                {/* Status Toggle: Open vs Closed */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setScheduleIsClosed(false)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      !scheduleIsClosed
                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-md"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-bold text-sm">🟢 Arena Open</div>
                    <div className="text-[11px] opacity-75 mt-1">Custom opening &amp; closing hours</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setScheduleIsClosed(true)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      scheduleIsClosed
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-md"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-bold text-sm">🏮 Closed (Holiday / Private)</div>
                    <div className="text-[11px] opacity-75 mt-1">Pause court bookings with notice</div>
                  </button>
                </div>

                {/* If Closed: Holiday Reason */}
                {scheduleIsClosed ? (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                    <label className="text-xs font-semibold text-amber-200 block">
                      Holiday / Closure Reason (Displayed to Customers on Website) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diwali Festive Holiday, Monsoon Court Maintenance"
                      value={scheduleClosureReason}
                      onChange={(e) => setScheduleClosureReason(e.target.value)}
                      className="w-full bg-[#161f2e] border border-amber-500/40 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      {["Diwali Festive Holiday", "Monsoon Maintenance", "National Tournament", "New Year Eve"].map((preset) => (
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
                  /* If Open: Dynamic Hours (supports overnight windows e.g. 5pm to 5am, 6pm to 10am) */
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

                    {/* Quick Preset Buttons */}
                    <div>
                      <span className="text-[11px] text-white/50 block mb-2">Quick Operating Window Presets:</span>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOpenTime("06:00");
                            setScheduleCloseTime("23:00");
                          }}
                          className="p-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-center text-xs text-white"
                        >
                          <span className="font-semibold block">Regular Day</span>
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
                          <span className="font-semibold block">Overnight (5PM-5AM)</span>
                          <span className="text-[10px] opacity-75">5:00 PM to 5:00 AM</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setScheduleOpenTime("18:00");
                            setScheduleCloseTime("10:00");
                          }}
                          className="p-2.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-center text-xs text-cyan-300"
                        >
                          <span className="font-semibold block">Night Owl (6PM-10AM)</span>
                          <span className="text-[10px] opacity-75">6:00 PM to 10:00 AM</span>
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
                  {scheduleLoading ? "Saving Schedule..." : "Save Arena Schedule for Date"}
                </button>
              </form>
            </div>

            {/* Configured Special Schedules List */}
            <div className="lg:col-span-5 bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4">
              <h3 className="text-base font-bold text-white flex items-center justify-between">
                <span>Configured Arena Schedules</span>
                <span className="text-xs text-white/50 font-normal">{allSchedules.length} saved</span>
              </h3>
              <p className="text-xs text-white/60">
                Customer website automatically pulls these rules and dynamically generates slots or closure warnings.
              </p>

              <div className="space-y-3 pt-2 max-h-[460px] overflow-y-auto pr-1">
                {allSchedules.length > 0 ? (
                  allSchedules.map((item, idx) => (
                    <div
                      key={item.date || idx}
                      className={`p-3.5 rounded-2xl border ${
                        item.isClosed
                          ? "bg-amber-500/10 border-amber-500/30"
                          : "bg-white/5 border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs font-mono text-white">
                          {item.date === "DEFAULT" ? "DEFAULT (Baseline)" : item.date}
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

                      {item.date !== "DEFAULT" && (
                        <div className="mt-2 pt-2 border-t border-white/10 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleResetSchedule(item.date)}
                            className="text-[11px] text-white/40 hover:text-white underline"
                          >
                            Reset to Default (06:00 – 23:00)
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-white/40 text-center py-6">
                    No custom schedule overrides configured. Default is 06:00 – 23:00 daily.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: SCHEDULE BLOCKS & MAINTENANCE */}
        {/* ========================================================================= */}
        {activeTab === "blocks" && (
          <div className="max-w-2xl bg-[#0d141f] border border-white/10 rounded-3xl p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-2">Court Schedule Closure / Block</h2>
            <p className="text-xs text-white/60 mb-6">
              Lock out court slots for court resurfacing, net maintenance, academy training, or tournaments.
            </p>

            {blockMsg && (
              <div className="mb-6 p-4 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                {blockMsg}
              </div>
            )}

            <form onSubmit={handleCreateBlock} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white/80 block mb-2">Court</label>
                <select
                  value={blockCourtId}
                  onChange={(e) => setBlockCourtId(e.target.value)}
                  className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                >
                  {courts.map((court) => (
                    <option key={court.id} value={court.id}>
                      {court.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">Date</label>
                  <input
                    type="date"
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">Start Time</label>
                  <input
                    type="time"
                    value={blockStartTime}
                    onChange={(e) => setBlockStartTime(e.target.value)}
                    className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/80 block mb-2">End Time</label>
                  <input
                    type="time"
                    value={blockEndTime}
                    onChange={(e) => setBlockEndTime(e.target.value)}
                    className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/80 block mb-2">Closure Reason</label>
                <select
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value as any)}
                  className="w-full bg-[#161f2e] border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                >
                  <option value="MAINTENANCE">Court Resurfacing / Net Maintenance</option>
                  <option value="TOURNAMENT">Club Tournament / League</option>
                  <option value="COACHING">Coaching Clinic / Academy Session</option>
                  <option value="PRIVATE_EVENT">Other Private Event</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-white/80 block mb-2">Notes / Internal Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Floodlight repairs on court 1"
                  value={blockNotes}
                  onChange={(e) => setBlockNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#c7f711]"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-red-500 hover:bg-red-600 text-white font-extrabold text-sm py-3.5 rounded-2xl transition-all shadow-lg shadow-red-500/20 mt-4"
              >
                Apply Court Closure Block
              </button>
            </form>
          </div>
        )}
          </>
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

