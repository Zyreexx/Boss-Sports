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
  Star,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Receipt,
  X,
  Search,
  Timer,
  Zap,
  Lock,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";
import ArenaGallery from "@/components/ArenaGallery";

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // --- Auth & Role Assignment State ---
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // --- Real-time Interactive Booking Engine State ---
  const [bookingDate, setBookingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("court-1");
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  // 10-minute Hold state
  const [holdSessionId, setHoldSessionId] = useState<string>("");
  const [activeHold, setActiveHold] = useState<any | null>(null);
  const [holdTimerSeconds, setHoldTimerSeconds] = useState<number>(0);

  // Customer Form
  const [custName, setCustName] = useState<string>("");
  const [custPhone, setCustPhone] = useState<string>("");
  const [bookingSubmitting, setBookingSubmitting] = useState<boolean>(false);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Dynamic Operating Hours & Holiday Schedule state
  const [arenaClosed, setArenaClosed] = useState<boolean>(false);
  const [closureReason, setClosureReason] = useState<string | null>(null);
  const [arenaOpenTime, setArenaOpenTime] = useState<string>("06:00");
  const [arenaCloseTime, setArenaCloseTime] = useState<string>("23:00");

  // --- Modals State ---
  const [showLookupModal, setShowLookupModal] = useState<boolean>(false);
  const [lookupPhone, setLookupPhone] = useState<string>("");
  const [userBookings, setUserBookings] = useState<any[]>([]);
  const [lookupLoading, setLookupLoading] = useState<boolean>(false);
  const [cancelStatus, setCancelStatus] = useState<string | null>(null);

  // Check authentication session on mount
  useEffect(() => {
    checkCurrentUser();
  }, []);

  const checkCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === "CUSTOMER") {
          setCustName(data.user.name || "");
          setCustPhone(data.user.phone || "");
        }
      } else {
        const stored = localStorage.getItem("boss_current_user");
        if (stored) {
          const parsed = JSON.parse(stored);
          setCurrentUser(parsed);
          if (parsed.role === "CUSTOMER") {
            setCustName(parsed.name || "");
            setCustPhone(parsed.phone || "");
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    localStorage.removeItem("boss_current_user");
    setCurrentUser(null);
  };

  // Initialize Session ID on mount
  useEffect(() => {
    let sid = localStorage.getItem("boss_session_id");
    if (!sid) {
      sid = "sess-" + Math.random().toString(36).substring(2, 9) + Date.now();
      localStorage.setItem("boss_session_id", sid);
    }
    setHoldSessionId(sid);
  }, []);

  // Fetch courts & slots when bookingDate or selectedCourtId changes
  useEffect(() => {
    fetchSlots();
  }, [bookingDate, selectedCourtId]);

  // Hold Timer countdown
  useEffect(() => {
    if (holdTimerSeconds <= 0) return;
    const interval = setInterval(() => {
      setHoldTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveHold(null);
          fetchSlots();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdTimerSeconds]);

  const fetchSlots = async () => {
    try {
      const url = `/api/pickleball/availability?date=${bookingDate}${
        selectedCourtId ? `&courtId=${selectedCourtId}` : ""
      }`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCourts(data.courts || []);
        if (!selectedCourtId && data.courts?.length > 0) {
          setSelectedCourtId(data.courts[0].id);
        }
        setAvailableSlots(data.slots || []);
        setArenaClosed(Boolean(data.isClosed));
        setClosureReason(data.closureReason || null);
        setArenaOpenTime(data.openTime || "06:00");
        setArenaCloseTime(data.closeTime || "23:00");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Lock a 10-minute hold on a slot
  const handleSelectSlot = async (slot: any) => {
    if (!slot.isAvailable) return;
    setBookingError(null);
    setSelectedSlot(slot);

    try {
      const res = await fetch("/api/pickleball/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourtId || (courts[0] && courts[0].id),
          startTime: slot.startTime,
          endTime: slot.endTime,
          sessionId: holdSessionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveHold(data.hold);
        setHoldTimerSeconds(600); // 10 minutes (600s)
      } else {
        setBookingError(data.error || "Slot could not be held.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Confirm Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setBookingError("Please pick a time slot first.");
      return;
    }
    setBookingSubmitting(true);
    setBookingError(null);

    try {
      const res = await fetch("/api/pickleball/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourtId || courts[0]?.id,
          startTime: selectedSlot.startTime,
          endTime: selectedSlot.endTime,
          customerName: custName,
          customerPhone: custPhone,
          source: "ONLINE",
          paymentStatus: "PAID_ONLINE",
          sessionId: holdSessionId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfirmedBooking(data.booking);
        setActiveHold(null);
        setHoldTimerSeconds(0);
        setSelectedSlot(null);
        setCustName("");
        setCustPhone("");
        fetchSlots();
      } else {
        setBookingError(data.error || "Failed to confirm reservation.");
      }
    } catch (e: any) {
      setBookingError("Network error occurred during booking.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Customer Phone Lookup
  const handleLookupBookings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupPhone) return;
    setLookupLoading(true);
    setCancelStatus(null);
    try {
      const res = await fetch(`/api/pickleball/bookings?phone=${encodeURIComponent(lookupPhone)}`);
      const data = await res.json();
      if (data.success) {
        setUserBookings(data.bookings || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLookupLoading(false);
    }
  };

  // Customer Self-Cancel (with 2-hr policy enforcement)
  const handleCustomerCancel = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch("/api/pickleball/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          phone: lookupPhone,
          reason: "Cancelled by customer self-service",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCancelStatus("Booking cancelled successfully.");
        // refresh list
        handleLookupBookings({ preventDefault: () => {} } as any);
        fetchSlots();
      } else {
        setCancelStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setCancelStatus("Network error cancelling reservation.");
    }
  };

  const faqs = [
    {
      q: "How does the zero double-booking court guarantee work?",
      a: "Our system uses strict atomic interval math (startA < endB && endA > startB) across every booking source (Online, Desk Walk-in, Phone). When you pick a time slot, it is held atomically for 10 minutes so no one else can book over your session.",
    },
    {
      q: "What is your cancellation and refund policy?",
      a: "Cancellations are permitted up to 2 hours before your scheduled slot through our self-service lookup portal. Within 2 hours of game start, slots are locked for play preparation. Staff can assist in special circumstances.",
    },
    {
      q: "Do I need to bring my own paddles and balls?",
      a: "Not at all! Official pro tournament-grade carbon fiber paddles and optic balls are provided completely complimentary by Boss Pickleball for all players. Locker rooms, clean towels, and showers are also complimentary.",
    },
    {
      q: "How many courts are available and how are they maintained?",
      a: "Boss Pickleball features 3 dedicated championship courts (Court 1, Court 2, and Court 3) with USAPA-standard acrylic cushioning, professional 500-lux anti-glare floodlighting, and regular maintenance for true bounce.",
    },
    {
      q: "Where is Boss Pickleball located?",
      a: "We are situated centrally in Gondal, featuring 3 professional tournament-spec acrylic courts with glare-free 500-lux LED court illumination and shaded player lounges.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#000000] font-sans antialiased selection:bg-[#c7f711] selection:text-[#0000ee]">
      {/* ========================================================================= */}
      {/* 1. HEADER (Hero + Top Nav) */}
      {/* ========================================================================= */}
      <header className="relative w-full min-h-[92vh] flex flex-col justify-between overflow-hidden bg-[#0d1a2c]">
        {/* Background Hero Image with Dynamic Action Player */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-player.jpg"
            alt="Hero court athlete in motion"
            fill
            priority
            className="object-cover object-center md:object-[75%_center] transition-transform duration-1000 scale-100 hover:scale-105"
          />
          {/* Subtle cinematic overlays for contrast & legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d1a2c]/95 via-[#0d1a2c]/70 md:via-[#0d1a2c]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a2c] via-transparent to-[#0d1a2c]/60" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#c7f711]/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Top Navbar */}
        <div className="relative z-20 w-full max-w-[1200px] mx-auto px-6 sm:px-10 pt-8 flex items-center justify-between">
          {/* Official Logo */}
          <Link href="/" className="flex items-center gap-3 text-white no-underline group">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md border-2 border-white/60 overflow-hidden group-hover:scale-105 transition-transform">
              <Image
                src="/images/official-boss-logo.jpg"
                alt="Boss Pickleball"
                width={40}
                height={40}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
            <div className="flex items-center">
              <span className="font-extrabold text-lg text-white tracking-tight leading-tight">
                BOSS PICKLEBALL
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-[14px] font-medium text-white/90">
            <a href="#booking" className="text-white hover:text-[#c7f711] transition-colors">
              Book Court
            </a>
            <a href="#gallery" className="hover:text-[#c7f711] transition-colors">
              Gallery
            </a>
            <a href="#services" className="hover:text-[#c7f711] transition-colors">
              Services
            </a>
            <a href="#pricing" className="hover:text-[#c7f711] transition-colors">
              Pricing &amp; Plans
            </a>
            {currentUser ? (
              <Link
                href="/profile"
                className="text-[#c7f711] hover:underline font-semibold flex items-center gap-1"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>My Bookings</span>
              </Link>
            ) : (
              <button
                onClick={() => setShowLookupModal(true)}
                className="text-[#c7f711] hover:underline font-semibold flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>My Bookings</span>
              </button>
            )}
          </nav>

          {/* Role Status & Auth Access */}
          <div className="flex items-center gap-2">
            {currentUser ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-full border border-white/20 transition-all"
                  title="View Profile & Upcoming Bookings"
                >
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-5 h-5 rounded-full object-cover border border-white/30"
                    />
                  ) : null}
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      currentUser.role === "OWNER"
                        ? "bg-purple-500 text-white"
                        : currentUser.role === "EMPLOYEE"
                        ? "bg-emerald-400 text-black"
                        : "bg-[#c7f711] text-black"
                    }`}
                  >
                    {currentUser.role === "OWNER"
                      ? "👑 Owner"
                      : currentUser.role === "EMPLOYEE"
                      ? "🛡️ Employee"
                      : "🎾 Customer"}
                  </span>
                  <span className="text-xs font-semibold text-white max-w-[120px] truncate">
                    {currentUser.name}
                  </span>
                </Link>

                <Link
                  href="/profile"
                  className="bg-[#c7f711] hover:bg-[#b0dc0d] text-black text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1 shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">My Schedule</span>
                </Link>

                {currentUser.role === "OWNER" && (
                  <Link
                    href="/admin"
                    className="bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                  >
                    Admin Suite
                  </Link>
                )}

                {currentUser.role === "EMPLOYEE" && (
                  <Link
                    href="/staff"
                    className="bg-emerald-400 hover:bg-emerald-500 text-black text-xs font-bold px-3 py-1.5 rounded-full transition-all"
                  >
                    Staff Desk
                  </Link>
                )}

                <button
                  onClick={handleLogout}
                  className="text-[11px] text-white/50 hover:text-white underline ml-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-xs font-semibold tracking-tight transition-all border border-white/20 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-[#c7f711]" />
                  <span>Login / Roles</span>
                </button>
                <Link
                  href="/staff"
                  className="hidden sm:inline-block bg-[#c7f711] text-[#0000ee] hover:bg-[#b5e010] px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-all shadow-md"
                >
                  Staff Desk
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-10 my-auto pt-16 pb-8">
          <div className="max-w-[700px]">
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c7f711] animate-pulse" />
              <span className="text-[12px] font-medium text-white/90 tracking-wide uppercase">
                Available For Bookings • Gondal Arena
              </span>
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-[64px] font-semibold text-white tracking-tight leading-[1.08] mb-6">
              Train Smarter. Play <br />
              Stronger. Win More.
            </h1>

            <p className="text-sm sm:text-[15px] text-white/80 max-w-[520px] leading-relaxed mb-8">
              Gondal&apos;s premier Pickleball Club. 3 championship tournament courts available in use (Courts 1, 2, and 3), 10-minute instant slot holds, zero double-booking guarantee, and complimentary pro paddles &amp; balls.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <a href="#booking" className="button-primary inline-flex items-center gap-2 no-underline">
                <span>Start Your Training</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <button
                onClick={() => setShowLookupModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-full text-xs font-semibold tracking-tight border border-white/20 transition-all flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-[#c7f711]" />
                <span>Manage My Reservation</span>
              </button>
            </div>
          </div>
        </div>

        {/* Hero Bottom Bar */}
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-6 sm:px-10 py-6 border-t border-white/10 flex items-center justify-between text-white/80 text-xs">
          <div className="flex items-center gap-2">
            <span>Scroll Down</span>
            <ChevronDown className="w-4 h-4 animate-bounce" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-[#f2b600]">
              <Star className="w-4 h-4 fill-current" />
              <span className="font-semibold text-white">4.9</span>
            </div>
            <div className="flex -space-x-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0d1a2c]" />
              <div className="w-6 h-6 rounded-full bg-[#c7f711] border-2 border-[#0d1a2c]" />
              <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[#0d1a2c]" />
            </div>
            <span className="text-[12px] text-white/70">3.2k+ Members</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. SECTION — Action Arena Video & Photo Gallery */}
      {/* ========================================================================= */}
      <ArenaGallery />

      {/* ========================================================================= */}
      {/* 3. LIVE INTERACTIVE COURT BOOKING SECTION (REAL BACKEND INTEGRATION) */}
      {/* ========================================================================= */}
      <section id="booking" className="relative w-full py-24 px-6 sm:px-10 lg:px-12 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full border border-neutral-200 text-xs text-neutral-600 mb-3 bg-white font-medium">
              Live Real-Time Reservation Engine
            </span>
            <h3 className="text-3xl sm:text-[34px] font-medium text-[#0d1a2c] tracking-tight leading-[1.2]">
              Reserve Your Court Now
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2">
              Select date, pick your preferred court, and tap any green slot to lock an atomic 10-minute checkout hold. Zero double-booking guarantee.
            </p>
          </div>

          {/* Success Booking Modal / Receipt Card */}
          {confirmedBooking && (
            <div className="mb-10 p-6 sm:p-8 rounded-3xl bg-emerald-50 border border-emerald-300 max-w-2xl mx-auto shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-emerald-200 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-bold text-emerald-950 text-base">Booking Confirmed!</h4>
                    <p className="text-xs text-emerald-800">
                      Booking Ref: <strong className="font-mono">#{confirmedBooking.id.slice(-6).toUpperCase()}</strong>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmedBooking(null)}
                  className="text-xs text-emerald-800 hover:text-black font-semibold"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs text-emerald-950 mb-4">
                <div>
                  <span className="text-emerald-700 block">Court:</span>
                  <span className="font-semibold text-sm">{confirmedBooking.courtName}</span>
                </div>
                <div>
                  <span className="text-emerald-700 block">Player:</span>
                  <span className="font-semibold text-sm">{confirmedBooking.customerName} ({confirmedBooking.customerPhone})</span>
                </div>
                <div>
                  <span className="text-emerald-700 block">Date &amp; Time:</span>
                  <span className="font-semibold text-sm">
                    {new Date(confirmedBooking.startTime).toLocaleString("en-IN", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-emerald-700 block">Total Paid:</span>
                  <span className="font-bold text-sm text-emerald-900">₹{confirmedBooking.totalPrice}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-100/60 rounded-xl text-[11px] text-emerald-900">
                A confirmation has been recorded in the Pickleball isolated database. You can manage or cancel this booking up to 2 hours before start using the &ldquo;My Bookings&rdquo; link above.
              </div>
            </div>
          )}

          {/* Active Hold Countdown Banner */}
          {activeHold && holdTimerSeconds > 0 && (
            <div className="mb-6 max-w-2xl mx-auto p-4 rounded-2xl bg-[#0d1a2c] text-white flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-3">
                <Timer className="w-5 h-5 text-[#c7f711] animate-spin" />
                <div>
                  <span className="text-xs font-semibold block text-[#c7f711]">
                    Atomic Hold Active: {Math.floor(holdTimerSeconds / 60)}:
                    {(holdTimerSeconds % 60).toString().padStart(2, "0")} left
                  </span>
                  <span className="text-[11px] text-white/70">
                    This slot is reserved exclusively for you. Complete details to lock it.
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveHold(null);
                  setHoldTimerSeconds(0);
                  setSelectedSlot(null);
                }}
                className="text-[11px] text-white/50 hover:text-white"
              >
                Release
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Slot Picker Column */}
            <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-[16px] p-6 sm:p-8 card">
              {/* Top Controls: Date and Court Picker */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#0000ee]" />
                  <span className="text-xs font-semibold text-neutral-800">Date:</span>
                  <input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="border border-neutral-200 rounded-lg px-3 py-1.5 text-xs text-neutral-800 focus:outline-none focus:border-[#0000ee]"
                  />
                </div>

                {/* Court Filter Tabs */}
                <div className="flex items-center gap-1.5">
                  {courts.map((court) => (
                    <button
                      key={court.id}
                      onClick={() => setSelectedCourtId(court.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        selectedCourtId === court.id
                          ? "bg-[#0d1a2c] text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                      }`}
                    >
                      {court.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Operating Hours & Holiday Badge */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                {arenaClosed ? (
                  <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-center gap-3">
                    <span className="text-2xl">🏮</span>
                    <div>
                      <span className="font-bold text-xs uppercase tracking-wider block text-amber-950">
                        Holiday Notice: {closureReason || "Arena Closed"}
                      </span>
                      <span className="text-xs text-amber-800">
                        Courts are closed on {bookingDate}. Please pick another date above to book your game.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Operating Hours for {bookingDate}: {arenaOpenTime} – {arenaCloseTime}</span>
                  </div>
                )}
              </div>

              {/* Slot Grid */}
              {!arenaClosed && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableSlots.length > 0 ? (
                    availableSlots.map((slot) => {
                      const isSelected = selectedSlot?.slotId === slot.slotId;
                      return (
                        <button
                          key={slot.slotId}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => handleSelectSlot(slot)}
                          className={`p-3.5 rounded-[12px] border text-left flex flex-col justify-between transition-all ${
                            !slot.isAvailable
                              ? "bg-neutral-100 border-neutral-200 text-neutral-400 cursor-not-allowed opacity-60"
                              : isSelected
                              ? "bg-[#c7f711] border-[#c7f711] text-[#0000ee] font-semibold shadow-md scale-[1.02]"
                              : "bg-white border-neutral-200 hover:border-neutral-400 text-neutral-800 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-medium">{slot.timeLabel}</span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                slot.isAvailable ? "bg-emerald-500" : "bg-red-400"
                              }`}
                            />
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] opacity-75">
                              {slot.isAvailable ? `₹${slot.price}` : "Booked / Blocked"}
                            </span>
                            {slot.isPeak && slot.isAvailable && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                                Peak
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-3 text-center py-8 text-xs text-neutral-500">
                      Loading available court slots...
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reservation Checkout Card */}
            <div className="lg:col-span-4 bg-[#0d1a2c] text-white rounded-[16px] p-6 sm:p-8 flex flex-col justify-between min-h-[380px] shadow-xl">
              <div>
                <h4 className="text-base font-medium text-white mb-4 flex items-center justify-between">
                  <span>Checkout Summary</span>
                  <span className="text-xs bg-[#c7f711] text-black px-2 py-0.5 rounded-full font-bold">
                    Official Rate
                  </span>
                </h4>

                <div className="space-y-2.5 text-xs text-white/70 border-b border-white/10 pb-4 mb-4">
                  <div className="flex justify-between">
                    <span>Venue</span>
                    <span className="text-white font-medium">Boss Pickleball</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Court</span>
                    <span className="text-white font-medium">
                      {courts.find((c) => c.id === selectedCourtId)?.name || "Court 1"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Selected Slot</span>
                    <span className="text-[#c7f711] font-semibold">
                      {selectedSlot ? selectedSlot.timeLabel : "Select a slot"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Duration</span>
                    <span className="text-white">60 Minutes</span>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleConfirmBooking} className="space-y-3 mb-4">
                  <div>
                    <label className="text-[11px] text-white/70 block mb-1">Your Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Anand Mehta"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#c7f711]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-white/70 block mb-1">Mobile Phone (for OTP &amp; Entry) *</label>
                    <input
                      type="tel"
                      required
                      placeholder="10-digit mobile number"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#c7f711]"
                    />
                  </div>

                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-[#c7f711] flex items-center gap-2">
                    <span>✓</span>
                    <span>Pro Carbon paddles &amp; balls are provided complimentary at the venue.</span>
                  </div>

                  {bookingError && (
                    <div className="p-2.5 rounded-xl text-[11px] bg-red-500/20 text-red-300 border border-red-500/30">
                      {bookingError}
                    </div>
                  )}

                  <div className="flex justify-between text-xs font-semibold text-white pt-2">
                    <span>Total Amount</span>
                    <span className="text-lg text-[#c7f711]">
                      ₹{selectedSlot ? selectedSlot.price : 400}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingSubmitting || !selectedSlot || arenaClosed}
                    className="button-primary w-full text-center mt-3 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bookingSubmitting ? (
                      <span>Verifying &amp; Locking...</span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Confirm &amp; Pay at Venue / UPI</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="text-[10px] text-white/40 text-center">
                Protected by atomic collision locking. 100% money back guarantee if cancelled 2+ hours ahead.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION — Everything You Need To Play Better Padel (Dark #0D1A2C) */}
      {/* ========================================================================= */}
      <section id="services" className="relative w-full py-24 px-6 sm:px-10 lg:px-12 bg-[#0d1a2c] text-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-white/20 text-xs text-white/80 mb-4 bg-white/5">
              Club Facilities
            </span>
            <h3 className="text-3xl sm:text-[44px] font-medium text-white tracking-tight leading-[1.15] capitalize">
              Everything You Need To Play Better Pickleball
            </h3>
            <p className="text-xs sm:text-sm text-white/70 mt-3 font-normal">
              State-of-the-art championship courts, pro coaching, tournament gear, and a warm community.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-[16px] bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#c7f711]/10 text-[#c7f711] flex items-center justify-center mb-6">
                  <Zap className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-medium text-white mb-2">Court Reservations</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Book premium tournament-grade courts with guaranteed zero double-bookings and instant 10-minute slot holds.
                </p>
              </div>
              <a href="#booking" className="text-xs text-[#c7f711] hover:underline pt-6 inline-flex items-center gap-1">
                <span>Reserve Court</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-8 rounded-[16px] bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#c7f711]/10 text-[#c7f711] flex items-center justify-center mb-6">
                  <User className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-medium text-white mb-2">Pro Coaching Academy</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Private &amp; group training with certified instructors focused on dinking, third-shot drops, and rally defense.
                </p>
              </div>
              <a href="#booking" className="text-xs text-[#c7f711] hover:underline pt-6 inline-flex items-center gap-1">
                <span>View Programs</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-8 rounded-[16px] bg-white/5 border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#c7f711]/10 text-[#c7f711] flex items-center justify-center mb-6">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h4 className="text-xl font-medium text-white mb-2">Pro Gear &amp; Player Lounge</h4>
                <p className="text-xs text-white/70 leading-relaxed">
                  Complimentary tournament carbon-fiber paddles, optic balls, locker rooms, showers, and shaded spectator lounges.
                </p>
              </div>
              <a
                href="#booking"
                className="text-xs text-[#c7f711] hover:underline pt-6 inline-flex items-center gap-1"
              >
                <span>Reserve Court</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. SECTION — Plans As Ambitious As Your Goals (Membership Tiers) */}
      {/* ========================================================================= */}
      <section id="pricing" className="relative w-full py-24 px-6 sm:px-10 lg:px-12 bg-white">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-16">
            <span className="inline-block px-4 py-1.5 rounded-full border border-neutral-200 text-xs text-neutral-600 mb-4 bg-neutral-50 font-medium">
              Transparent Pricing
            </span>
            <h3 className="text-3xl sm:text-[44px] font-medium text-[#0d1a2c] tracking-tight leading-[1.15] capitalize">
              Plans As Ambitious As Your Goals
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 mt-3 font-normal">
              Direct pricing with zero surprise charges. Pickleball court slots and memberships can be booked on-demand or monthly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Pickleball Pay-as-you-play */}
            <div className="p-8 rounded-[16px] bg-white border border-neutral-200 card flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-2">
                  Court Rental
                </span>
                <h4 className="text-2xl font-bold text-[#0d1a2c] mb-1">Open Play Hourly Pass</h4>
                <p className="text-xs text-neutral-500 mb-6">
                  Ideal for casual rallies, matchplay, and friendly weekend games.
                </p>
                <div className="text-4xl font-semibold text-[#0d1a2c] mb-6">
                  ₹400 <span className="text-xs font-normal text-neutral-500">/ hour</span>
                </div>
                <ul className="space-y-3 text-xs text-neutral-600 border-t border-neutral-100 pt-6">
                  <li className="flex items-center gap-2">✓ Full 60-minute championship court</li>
                  <li className="flex items-center gap-2">✓ 10-minute atomic hold lock guarantee</li>
                  <li className="flex items-center gap-2">✓ Complimentary pro paddles &amp; optic balls</li>
                  <li className="flex items-center gap-2">✓ Shower &amp; locker room access</li>
                  <li className="flex items-center gap-2">✓ Free cancellation up to 2 hours</li>
                </ul>
              </div>
              <a href="#booking" className="button-primary w-full text-center mt-8 no-underline">
                Select Plan
              </a>
            </div>

            {/* Monthly Club Member (Featured) */}
            <div className="p-8 rounded-[16px] bg-[#0d1a2c] text-white flex flex-col justify-between relative shadow-xl border-2 border-[#c7f711]">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c7f711] text-[#0000ee] text-[10px] font-bold tracking-wider uppercase px-3 py-1 rounded-full">
                Most Popular
              </div>
              <div>
                <span className="text-xs font-semibold text-[#c7f711] uppercase tracking-wider block mb-2">
                  Club Membership
                </span>
                <h4 className="text-2xl font-bold text-white mb-1">Monthly Club Member</h4>
                <p className="text-xs text-white/70 mb-6">
                  Dedicated monthly package for passionate regular players.
                </p>
                <div className="text-4xl font-semibold text-[#c7f711] mb-6">
                  ₹3,500 <span className="text-xs font-normal text-white/70">/ month</span>
                </div>
                <ul className="space-y-3 text-xs text-white/80 border-t border-white/10 pt-6">
                  <li className="flex items-center gap-2">✓ 10 court hours included every month</li>
                  <li className="flex items-center gap-2">✓ Priority 7-day advance slot reservation</li>
                  <li className="flex items-center gap-2">✓ Complimentary tournament paddles &amp; balls</li>
                  <li className="flex items-center gap-2">✓ Dedicated locker &amp; shower amenities</li>
                  <li className="flex items-center gap-2">✓ 1 reservation reschedule / cycle</li>
                </ul>
              </div>
              <a href="#booking" className="button-primary w-full text-center mt-8 no-underline">
                Select Plan
              </a>
            </div>

            {/* Annual VIP Champion */}
            <div className="p-8 rounded-[16px] bg-white border border-neutral-200 card flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider block mb-2">
                  Pro Champion Tier
                </span>
                <h4 className="text-2xl font-bold text-[#0d1a2c] mb-1">Annual VIP Champion</h4>
                <p className="text-xs text-neutral-500 mb-6">
                  Full 365-day VIP access for competitive league &amp; tournament players.
                </p>
                <div className="text-4xl font-semibold text-[#0d1a2c] mb-6">
                  ₹24,000 <span className="text-xs font-normal text-neutral-500">/ year</span>
                </div>
                <ul className="space-y-3 text-xs text-neutral-600 border-t border-neutral-100 pt-6">
                  <li className="flex items-center gap-2">✓ Unlimited off-peak court hours</li>
                  <li className="flex items-center gap-2">✓ Priority booking across Courts 1, 2, and 3</li>
                  <li className="flex items-center gap-2">✓ Permanent locker allocation</li>
                  <li className="flex items-center gap-2">✓ 4 complimentary guest player passes / quarter</li>
                  <li className="flex items-center gap-2">✓ Entry to official club tournaments</li>
                </ul>
              </div>
              <a href="#booking" className="button-primary w-full text-center mt-8 no-underline">
                Select Plan
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. SECTION — Frequently Asked Questions */}
      {/* ========================================================================= */}
      <section className="relative w-full py-24 px-6 sm:px-10 lg:px-12 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full border border-neutral-200 text-xs text-neutral-600 mb-3 bg-white font-medium">
              Got Questions?
            </span>
            <h3 className="text-3xl sm:text-[34px] font-medium text-[#0d1a2c] tracking-tight leading-[1.2]">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-[16px] bg-white border border-neutral-200 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4"
                  >
                    <span className="text-sm font-semibold text-[#0d1a2c]">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-500 transition-transform ${
                        isOpen ? "rotate-180 text-[#0000ee]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 text-xs text-neutral-600 leading-relaxed border-t border-neutral-100 pt-4">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. FOOTER (#0D1A2C background) */}
      {/* ========================================================================= */}
      <footer id="contact" className="relative w-full py-20 px-6 sm:px-10 lg:px-12 bg-[#0d1a2c] text-white border-t border-white/10">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 pb-16 border-b border-white/10">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md border-2 border-white/60 overflow-hidden">
                <Image
                  src="/images/official-boss-logo.jpg"
                  alt="Boss Pickleball"
                  width={40}
                  height={40}
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
              <div className="flex items-center">
                <span className="font-extrabold text-base text-white tracking-tight leading-tight block">
                  BOSS PICKLEBALL
                </span>
              </div>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">
              Experience the thrill of pickleball with a community that plays hard, laughs often, and welcomes everyone.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Navigation</h5>
            <ul className="space-y-2 text-xs text-white/70">
              <li><a href="#booking" className="hover:text-[#c7f711] transition-colors">Book Court</a></li>
              <li><a href="#gallery" className="hover:text-[#c7f711] transition-colors">Action Gallery</a></li>
              <li><a href="#services" className="hover:text-[#c7f711] transition-colors">Services</a></li>
              <li><a href="#pricing" className="hover:text-[#c7f711] transition-colors">Pricing &amp; Plans</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Staff &amp; Management</h5>
            <div className="flex flex-col gap-2">
              <Link href="/staff" className="button-primary text-center no-underline">
                Registrar Staff Desk
              </Link>
              <Link href="/admin" className="button-primary text-center no-underline">
                Owner Audit Suite
              </Link>
            </div>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Arena Schedule</h5>
            <p className="text-xs text-white/70 leading-relaxed">
              Monday – Sunday <br />
              5:30 AM – 10:30 PM <br />
              Boss Pickleball Arena, Gujarat
            </p>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto w-full pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/50 gap-4">
          <p>© 2026 Boss Pickleball. All rights reserved.</p>
          <p>Official Tournament Venue • Courts 1, 2, and 3</p>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: MY BOOKINGS (PHONE LOOKUP & 2-HOUR CANCELLATION) */}
      {/* ========================================================================= */}
      {showLookupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d141f] border border-white/15 rounded-3xl p-6 sm:p-8 max-w-lg w-full text-white">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-[#c7f711]" />
                <h3 className="font-bold text-base text-white">Look Up My Bookings</h3>
              </div>
              <button onClick={() => setShowLookupModal(false)} className="text-white/50 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-white/60 mb-4">
              Enter your registered mobile number to review upcoming court slots and cancel if needed (allowed up to 2 hours prior).
            </p>

            <form onSubmit={handleLookupBookings} className="flex gap-2 mb-4">
              <input
                type="tel"
                required
                placeholder="Enter 10-digit phone number..."
                value={lookupPhone}
                onChange={(e) => setLookupPhone(e.target.value)}
                className="flex-1 bg-white/5 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#c7f711]"
              />
              <button
                type="submit"
                disabled={lookupLoading}
                className="bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-bold text-xs px-4 py-2 rounded-xl transition-all"
              >
                {lookupLoading ? "Searching..." : "Search"}
              </button>
            </form>

            {cancelStatus && (
              <div className="mb-4 p-3 rounded-xl text-xs bg-white/10 border border-white/20 text-[#c7f711]">
                {cancelStatus}
              </div>
            )}

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {userBookings.length > 0 ? (
                userBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">
                        {b.courtName} • <span className="text-[#c7f711]">₹{b.totalPrice}</span>
                      </div>
                      <div className="text-[11px] text-white/60 mt-0.5">
                        {new Date(b.startTime).toLocaleString("en-IN", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <span className="text-[10px] text-white/40 block mt-0.5 font-mono">
                        Ref: #{b.id.slice(-6).toUpperCase()} • Status: {b.status}
                      </span>
                    </div>

                    <div>
                      {b.status === "CONFIRMED" ? (
                        <button
                          onClick={() => handleCustomerCancel(b.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/40 italic">{b.status}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-xs text-white/40">
                  {lookupPhone ? "No reservations found for this phone." : "Enter phone above to fetch bookings."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: LOGIN & ROLE ASSIGNMENT */}
      {/* ========================================================================= */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          if (user.role === "CUSTOMER") {
            setCustName(user.name || "");
            setCustPhone(user.phone || "");
          }
        }}
      />
    </div>
  );
}
