"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Phone,
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
  Lock,
  RefreshCw,
  Menu,
  Upload,
  QrCode,
  Copy,
  Check,
  CreditCard,
} from "lucide-react";
import LoginModal from "@/components/LoginModal";
import ArenaGallery from "@/components/ArenaGallery";
import { formatDurationLabel, formatBookingDuration, SUPPORTED_DURATIONS_MINUTES } from "@/lib/utils/duration";

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // --- Auth & Role Assignment State ---
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // --- Real-time Interactive Booking Engine State ---
  const todayDate = React.useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }, []);
  const [bookingDate, setBookingDate] = useState<string>(todayDate);
  const [courts, setCourts] = useState<any[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("court-1");
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

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

  // Manual UPI Payment State
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<"PAY_AT_VENUE" | "UPI_MANUAL">("PAY_AT_VENUE");
  const [paymentScreenshotFile, setPaymentScreenshotFile] = useState<File | null>(null);
  const [paymentScreenshotPreview, setPaymentScreenshotPreview] = useState<string | null>(null);
  const [paymentUtr, setPaymentUtr] = useState<string>("");
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);

  const venueUpiId = process.env.NEXT_PUBLIC_VENUE_UPI_ID || "bosssports@upi";
  const venueUpiName = process.env.NEXT_PUBLIC_VENUE_UPI_NAME || "Boss Sports and Fitness";
  const venueUpiQrUrl = process.env.NEXT_PUBLIC_VENUE_UPI_QR_URL || "";

  const selectedRangeDetails = React.useMemo(() => {
    if (!selectedSlot) return null;
    const startMs = new Date(selectedSlot.startTime).getTime();
    const endMs = startMs + durationMinutes * 60 * 1000;
    const endIso = new Date(endMs).toISOString();

    const coveredSlots = availableSlots.filter((s) => {
      const sStart = new Date(s.startTime).getTime();
      const sEnd = new Date(s.endTime).getTime();
      return sStart < endMs && sEnd > startMs;
    });

    const numIntervals = Math.max(1, durationMinutes / 30);
    const isFullyAvailable = coveredSlots.length === numIntervals &&
      coveredSlots.every((s) => s.isAvailable || s.slotId === selectedSlot.slotId || (activeHold && s.startTime === activeHold.startTime));

    const totalPrice = coveredSlots.length > 0
      ? coveredSlots.reduce((sum, s) => sum + (s.price || 200), 0)
      : (durationMinutes / 60) * 400;

    const startLocal = new Date(selectedSlot.startTime).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const endLocal = new Date(endMs).toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      startTime: selectedSlot.startTime,
      endTime: endIso,
      timeLabel: `${startLocal} - ${endLocal}`,
      durationMinutes,
      durationLabel: formatDurationLabel(durationMinutes),
      totalPrice,
      isFullyAvailable,
    };
  }, [selectedSlot, durationMinutes, availableSlots, activeHold]);

  // Sync & Connection Status state
  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState<boolean>(false);
  const [hasLoadedSlots, setHasLoadedSlots] = useState<boolean>(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        if (data.user.role === "CUSTOMER") {
          setCustName(data.user.name || "");
          setCustPhone(data.user.phone || "");
        }
      } else {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
      }
    } catch {
      setCurrentUser(null);
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

  // Fetch courts & slots when bookingDate or selectedCourtId changes + Live Polling & Focus Refresh
  useEffect(() => {
    fetchSlots(false);

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchSlots(true);
      }
    }, 6000);

    const handleFocusRefresh = () => {
      if (document.visibilityState === "visible") {
        fetchSlots(true);
      }
    };

    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
    };
  }, [bookingDate, selectedCourtId]);

  // Hold Timer countdown
  useEffect(() => {
    if (holdTimerSeconds <= 0) return;
    const interval = setInterval(() => {
      setHoldTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setActiveHold(null);
          setSelectedSlot(null);
          setBookingError("Your 10-minute temporary slot hold has expired. Please select a slot to re-lock.");
          fetchSlots(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdTimerSeconds]);

  const fetchSlots = async (silent = false) => {
    if (!silent) {
      setIsRefreshingAvailability(true);
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `/api/pickleball/availability?date=${bookingDate}${
        selectedCourtId ? `&courtId=${selectedCourtId}` : ""
      }`;
      const res = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const data = await res.json();
      if (data.success) {
        setAvailabilityError(null);
        setLastSyncedAt(new Date());
        setCourts(data.courts || []);
        if (!selectedCourtId && data.courts?.length > 0) {
          setSelectedCourtId(data.courts[0].id);
        }
        const incomingSlots = data.slots || [];
        setAvailableSlots(incomingSlots);
        setArenaClosed(Boolean(data.isClosed));
        setClosureReason(data.closureReason || null);
        setArenaOpenTime(data.openTime || "06:00");
        setArenaCloseTime(data.closeTime || "23:00");

        // Reconcile if currently selected slot was taken or blocked externally
        setSelectedSlot((currentSelected: any) => {
          if (!currentSelected) return null;
          const matching = incomingSlots.find((s: any) => s.slotId === currentSelected.slotId);
          if (matching && (matching.status === "BOOKED" || matching.status === "BLOCKED" || matching.status === "PASSED")) {
            setActiveHold(null);
            setHoldTimerSeconds(0);
            setBookingError(`The ${currentSelected.timeLabel} slot is no longer available (${matching.status.toLowerCase()}). Please pick another slot.`);
            return null;
          }
          return currentSelected;
        });
      } else {
        setAvailabilityError(data.error || "Unable to verify live availability.");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setAvailabilityError("Timed out waiting for availability from the server. Please retry.");
      } else {
        setAvailabilityError("Unable to reach booking server. Displayed slots may be out of date.");
      }
    } finally {
      clearTimeout(timeoutId);
      setHasLoadedSlots(true);
      if (!silent) {
        setIsRefreshingAvailability(false);
      }
    }
  };

  // Explicit Release of Active Hold
  const handleReleaseHold = async () => {
    const currentHoldId = activeHold?.id;
    setActiveHold(null);
    setHoldTimerSeconds(0);
    setSelectedSlot(null);
    try {
      await fetch("/api/pickleball/hold", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: holdSessionId,
          holdId: currentHoldId,
        }),
      });
      await fetchSlots(true);
    } catch {
      // Ignore release network error
    }
  };

  // Lock a 10-minute hold on a flexible slot range
  const handleSelectSlot = async (slot: any, chosenDuration: number = durationMinutes) => {
    if (!slot.isAvailable) return;
    setBookingError(null);

    const endMs = new Date(slot.startTime).getTime() + chosenDuration * 60 * 1000;
    const computedEndTime = new Date(endMs).toISOString();

    try {
      const res = await fetch("/api/pickleball/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourtId || (courts[0] && courts[0].id),
          startTime: slot.startTime,
          endTime: computedEndTime,
          sessionId: holdSessionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedSlot(slot);
        setActiveHold(data.hold);
        setHoldTimerSeconds(600); // 10 minutes (600s)
        fetchSlots(true);
      } else {
        setSelectedSlot(null);
        setActiveHold(null);
        setHoldTimerSeconds(0);
        setBookingError(data.error || "Slot is no longer available. Availability refreshed.");
        fetchSlots(true);
      }
    } catch (e) {
      setBookingError("Could not reach server to lock slot. Please check your connection.");
    }
  };

  const handleChangeDuration = async (newDuration: number) => {
    setDurationMinutes(newDuration);
    if (selectedSlot) {
      await handleSelectSlot(selectedSlot, newDuration);
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

    const endMs = new Date(selectedSlot.startTime).getTime() + durationMinutes * 60 * 1000;
    const computedEndTime = new Date(endMs).toISOString();

    let uploadedScreenshotUrl = "";

    try {
      if (checkoutPaymentMethod === "UPI_MANUAL") {
        if (!paymentScreenshotFile) {
          setBookingError("Please upload your UPI payment screenshot before submitting.");
          setBookingSubmitting(false);
          return;
        }

        const uploadFormData = new FormData();
        uploadFormData.append("file", paymentScreenshotFile);

        const uploadRes = await fetch("/api/upload/payment-proof", {
          method: "POST",
          body: uploadFormData,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok || !uploadData.success) {
          setBookingError(uploadData.error || "Failed to upload payment screenshot. Please try again.");
          setBookingSubmitting(false);
          return;
        }
        uploadedScreenshotUrl = uploadData.url;
      }

      const res = await fetch("/api/pickleball/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: selectedCourtId || courts[0]?.id,
          startTime: selectedSlot.startTime,
          endTime: computedEndTime,
          customerName: custName,
          customerPhone: custPhone,
          source: "ONLINE",
          paymentStatus: checkoutPaymentMethod === "UPI_MANUAL" ? "PENDING" : "PAY_AT_VENUE",
          paymentMethod: checkoutPaymentMethod === "UPI_MANUAL" ? "UPI_MANUAL" : "PAY_AT_VENUE",
          paymentScreenshotUrl: uploadedScreenshotUrl || undefined,
          paymentUtr: paymentUtr.trim() || undefined,
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
        setPaymentScreenshotFile(null);
        setPaymentScreenshotPreview(null);
        setPaymentUtr("");
        fetchSlots(false);
      } else {
        setBookingError(data.error || "Failed to confirm reservation.");
        fetchSlots(true);
      }
    } catch (e: any) {
      setBookingError("Network error occurred during booking.");
    } finally {
      setBookingSubmitting(false);
    }
  };

  // Customer Verified Reservation Lookup
  const handleLookupBookings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) {
      setCancelStatus("Please sign in to securely access your reservations.");
      setShowLoginModal(true);
      return;
    }
    setLookupLoading(true);
    setCancelStatus(null);
    try {
      const res = await fetch("/api/pickleball/bookings", { cache: "no-store" });
      if (res.status === 401) {
        localStorage.removeItem("boss_current_user");
        setCurrentUser(null);
        setUserBookings([]);
        setCancelStatus("Your session has expired. Please sign in again.");
        setShowLoginModal(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUserBookings(data.bookings || []);
      } else {
        setCancelStatus(data.error || "Failed to retrieve reservations.");
      }
    } catch (e) {
      console.error(e);
      setCancelStatus("Network error retrieving reservations.");
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    if (!showLookupModal && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowLookupModal(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showLookupModal, mobileMenuOpen]);

  const activeCourtCount = courts.length || 3;
  const standardRate = courts.find((c) => c.id === selectedCourtId)?.basePricePerHour ?? courts[0]?.basePricePerHour ?? 400;
  const configuredHoursText = arenaClosed
    ? `Closed on ${bookingDate}${closureReason ? ` (${closureReason})` : ""}`
    : `${arenaOpenTime} – ${arenaCloseTime} IST`;

  // Customer Self-Cancel (with 2-hr policy enforcement)
  const handleCustomerCancel = async (bookingId: string) => {
    if (!currentUser) {
      setCancelStatus("Please sign in to verify your identity and cancel your booking.");
      setShowLoginModal(true);
      return;
    }

    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch("/api/pickleball/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
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
        if (res.status === 401) {
          localStorage.removeItem("boss_current_user");
          setCurrentUser(null);
          setUserBookings([]);
          setShowLoginModal(true);
        }
        setCancelStatus(`Error: ${data.error}`);
      }
    } catch (e) {
      setCancelStatus("Network error cancelling reservation.");
    }
  };

  const faqs = [
    {
      q: "How do court slot holds and overlap checks work?",
      a: "Online bookings, temporary 10-minute checkout holds, and staff desk reservations share one server booking store that validates overlapping time intervals (`start < endB && end > startB`) before confirming a booking.",
    },
    {
      q: "What is your cancellation and payment policy?",
      a: "Self-service cancellations are permitted up to 2 hours before your scheduled start time through your signed-in account. Within 2 hours of game start, or for any payment adjustment, please contact the venue reception desk.",
    },
    {
      q: "What payment methods are accepted?",
      a: "Reservations booked on the website are confirmed for payment on arrival at the reception desk via Cash or Counter UPI.",
    },
    {
      q: "How many courts and operating hours does Boss Pickleball offer?",
      a: `Boss Pickleball operates ${activeCourtCount} dedicated pickleball courts with configured hours for ${bookingDate} of ${configuredHoursText} (generally ${arenaOpenTime} – ${arenaCloseTime} IST unless a holiday closure is active).`,
    },
    {
      q: "Where is Boss Pickleball located and how about paddles or gear?",
      a: "We are located in Gondal, Gujarat. Check directly with venue reception on arrival regarding paddle rentals, equipment, or coaching inquiries.",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white text-[#000000] font-sans antialiased selection:bg-[#c7f711] selection:text-[#0000ee]">
      {/* ========================================================================= */}
      {/* 1. HEADER (Hero + Top Nav) */}
      {/* ========================================================================= */}
      <header className="relative w-full min-h-screen min-h-[100dvh] flex flex-col justify-between overflow-hidden bg-[#0d1a2c]">
        {/* Background Hero Image with Dynamic Action Player */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-player.jpg"
            alt="Hero court athlete in motion"
            fill
            priority
            className="object-cover object-center md:object-[75%_center] transition-transform duration-1000 scale-100 hover:scale-105"/>
          {/* Subtle cinematic overlays for contrast & legibility */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d1a2c]/95 via-[#0d1a2c]/80 md:via-[#0d1a2c]/55 to-[#0d1a2c]/40 md:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1a2c] via-transparent to-[#0d1a2c]/65" />
          <div className="absolute bottom-0 right-0 w-72 h-72 sm:w-96 sm:h-96 bg-[#c7f711]/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Top Navbar */}
        <div className="relative z-20 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 pt-5 sm:pt-8 flex items-center justify-between gap-2 sm:gap-3">
          {/* Official Logo */}
          <Link href="/" className="flex items-center gap-1.5 min-[360px]:gap-2 sm:gap-3 text-white no-underline group min-w-0 min-h-[38px]">
            <div className="w-8 h-8 min-[360px]:w-9 min-[360px]:h-9 sm:w-10 sm:h-10 shrink-0 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md border-2 border-white/60 overflow-hidden group-hover:scale-105 transition-transform">
              <Image
                src="/images/official-boss-logo.jpg"
                alt="Boss Pickleball"
                width={40}
                height={40}
                className="w-full h-full object-contain rounded-full"
                priority
              />
            </div>
            <div className="flex items-center min-w-0">
              <span className="font-extrabold text-[11px] min-[350px]:text-[13px] min-[375px]:text-sm sm:text-lg text-white tracking-tighter min-[360px]:tracking-tight leading-tight truncate">
                BOSS PICKLEBALL
              </span>
            </div>
          </Link>

          {/* Navigation Links (Desktop) */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-6 text-[14px] font-medium text-white/90 shrink-0">
            <a href="#booking" className="text-white hover:text-[#c7f711] transition-colors">
              Book Court
            </a>
            <a href="#gallery" className="hover:text-[#c7f711] transition-colors">
              Gallery
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
                type="button"
                onClick={() => setShowLookupModal(true)}
                className="text-[#c7f711] hover:underline font-semibold flex items-center gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>My Bookings</span>
              </button>
            )}
          </nav>

          {/* Role Status, Auth Access & Mobile Menu Toggle */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
            {currentUser ? (
              <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0">
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 sm:gap-2 bg-white/10 hover:bg-white/15 px-2.5 sm:px-3 py-1.5 min-h-[40px] rounded-full border border-white/20 transition-all min-w-0"
                  title="View Profile & Upcoming Bookings"
                >
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-5 h-5 rounded-full object-cover border border-white/30 shrink-0"
                    />
                  ) : null}
                  <span
                    className={`text-[10px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-full shrink-0 ${
                      currentUser.role === "OWNER"
                        ? "bg-purple-500 text-white"
                        : currentUser.role === "EMPLOYEE"
                        ? "bg-emerald-400 text-black"
                        : "bg-[#c7f711] text-black"
                    }`}
                  >
                    {currentUser.role === "OWNER"
                      ? "Owner"
                      : currentUser.role === "EMPLOYEE"
                      ? "Staff"
                      : "Customer"}
                  </span>
                  <span className="hidden min-[400px]:inline text-xs font-semibold text-white max-w-[72px] sm:max-w-[110px] truncate">
                    {currentUser.name}
                  </span>
                </Link>

                <Link
                  href="/profile"
                  className="hidden lg:flex bg-[#c7f711] hover:bg-[#b0dc0d] text-black text-xs font-bold px-3 py-1.5 min-h-[36px] rounded-full transition-all items-center gap-1 shadow-sm"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>My Schedule</span>
                </Link>

                {currentUser.role === "OWNER" && (
                  <Link
                    href="/admin"
                    className="hidden lg:inline-flex items-center bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold px-3 py-1.5 min-h-[36px] rounded-full transition-all"
                  >
                    Admin Suite
                  </Link>
                )}

                {currentUser.role === "EMPLOYEE" && (
                  <Link
                    href="/staff"
                    className="hidden lg:inline-flex items-center bg-emerald-400 hover:bg-emerald-500 text-black text-xs font-bold px-3 py-1.5 min-h-[36px] rounded-full transition-all"
                  >
                    Staff Desk
                  </Link>
                )}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden lg:inline-block text-[11px] text-white/80 hover:text-white underline ml-1"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="bg-white/10 hover:bg-white/20 text-white px-3 sm:px-3.5 py-2 min-h-[40px] rounded-full text-xs font-semibold tracking-tight transition-all border border-white/20 flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5 text-[#c7f711] shrink-0" />
                  <span>Sign In</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="lg:hidden min-w-[44px] min-h-[44px] p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 inline-flex items-center justify-center shrink-0"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-nav-drawer"
            aria-label="Mobile Navigation"
            className="relative z-20 lg:hidden mx-4 sm:mx-6 mt-3 p-3 sm:p-4 rounded-2xl bg-[#0d141f]/95 border border-white/15 backdrop-blur-md flex flex-col gap-1 text-sm font-medium text-white shadow-xl"
          >
            <a
              href="#booking"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#c7f711] hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
            >
              Book Court
            </a>
            <a
              href="#gallery"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-[#c7f711] hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
            >
              Gallery
            </a>
            {currentUser ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-[#c7f711] font-semibold hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
                >
                  My Bookings &amp; Profile ({currentUser.name})
                </Link>
                {(currentUser.role === "OWNER" || currentUser.role === "EMPLOYEE") && (
                  <Link
                    href="/staff"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-emerald-300 font-semibold hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
                  >
                    Staff Desk
                  </Link>
                )}
                {currentUser.role === "OWNER" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-purple-300 font-semibold hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
                  >
                    Owner Admin Suite
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="text-left text-white/80 hover:text-white hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors border-t border-white/10 mt-1 pt-2.5"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowLookupModal(true);
                  }}
                  className="text-left text-[#c7f711] font-semibold hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
                >
                  My Bookings
                </button>
                <Link
                  href="/staff"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white/90 hover:text-[#c7f711] hover:bg-white/5 px-3 py-2.5 min-h-[44px] flex items-center rounded-xl transition-colors"
                >
                  Staff Desk
                </Link>
              </>
            )}
          </nav>
        )}

        {/* Hero Content */}
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 my-auto pt-10 sm:pt-16 pb-6 sm:pb-8">
          <div className="max-w-[700px]">
            <div className="inline-flex items-center gap-2 mb-4 sm:mb-6">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c7f711] animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs font-medium text-white/90 tracking-wide uppercase">
                Available For Bookings • Gondal Arena
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-[64px] font-semibold text-white tracking-tight leading-[1.1] sm:leading-[1.08] mb-4 sm:mb-6">
              Train Smarter. Play <br className="hidden sm:inline" />
              Stronger. Win More.
            </h1>

            <p className="text-sm sm:text-[15px] text-white/85 max-w-[520px] leading-relaxed mb-6 sm:mb-8">
              Gondal&apos;s dedicated Pickleball facility featuring 3 courts (Courts 1, 2, and 3) with live server-checked availability, 10-minute checkout holds, and transparent direct rates.
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4">
              <a href="#booking" className="button-primary inline-flex items-center justify-center gap-2 no-underline">
                <span>Book a Court</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Hero Bottom Bar */}
        <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-3 sm:py-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5 text-white/85 text-xs">
          <a href="#booking" className="inline-flex items-center gap-2 hover:text-[#c7f711] transition-colors py-2 min-h-[38px]">
            <span>Scroll Down</span>
            <ChevronDown className="w-4 h-4 animate-bounce" aria-hidden="true" />
          </a>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/85">
            <span className="flex items-center gap-1.5 text-white/95">
              <span className="w-2 h-2 rounded-full bg-[#c7f711]" />
              {activeCourtCount} {activeCourtCount === 1 ? "Court" : "Courts"} Live
            </span>
            <span className="hidden sm:inline text-white/40">•</span>
            <span className="text-white/75">₹{standardRate} / hr Standard Rate</span>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. SECTION — Action Arena Video & Photo Gallery */}
      {/* ========================================================================= */}
      <ArenaGallery standardRate={standardRate} />

      {/* ========================================================================= */}
      {/* 3. LIVE INTERACTIVE COURT BOOKING SECTION (REAL BACKEND INTEGRATION) */}
      {/* ========================================================================= */}
      <section id="booking" className="relative w-full py-14 sm:py-24 px-4 sm:px-6 lg:px-12 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center max-w-[700px] mx-auto mb-8 sm:mb-12">
            <h3 className="text-2xl sm:text-[34px] font-medium text-[#0d1a2c] tracking-tight leading-[1.2]">
              Reserve Your Court Now
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 mt-2">
              Select a date and court, then choose any available slot below to start a temporary 10-minute checkout hold.
            </p>
          </div>

          {/* Success Booking Modal / Receipt Card */}
          {confirmedBooking && (
            <div
              className={`mb-8 sm:mb-10 p-5 sm:p-8 rounded-2xl sm:rounded-3xl border max-w-2xl mx-auto shadow-sm ${
                confirmedBooking.status === "PENDING_VERIFICATION"
                  ? "bg-amber-50 border-amber-300 text-amber-950"
                  : "bg-emerald-50 border-emerald-300 text-emerald-950"
              }`}
            >
              <div
                className={`flex flex-wrap items-start sm:items-center justify-between gap-3 pb-4 border-b mb-4 ${
                  confirmedBooking.status === "PENDING_VERIFICATION"
                    ? "border-amber-200"
                    : "border-emerald-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-bold text-white ${
                      confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "bg-amber-600"
                        : "bg-emerald-600"
                    }`}
                  >
                    {confirmedBooking.status === "PENDING_VERIFICATION" ? "⏱" : "✓"}
                  </div>
                  <div>
                    <h4 className="font-bold text-base">
                      {confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "Payment Pending Verification"
                        : "Booking Confirmed"}
                    </h4>
                    <p
                      className={`text-xs ${
                        confirmedBooking.status === "PENDING_VERIFICATION"
                          ? "text-amber-800"
                          : "text-emerald-800"
                      }`}
                    >
                      Booking Ref:{" "}
                      <strong className="font-mono">
                        #{confirmedBooking.id.slice(-6).toUpperCase()}
                      </strong>{" "}
                      • Status:{" "}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          confirmedBooking.status === "PENDING_VERIFICATION"
                            ? "bg-amber-200 text-amber-900"
                            : "bg-emerald-200 text-emerald-900"
                        }`}
                      >
                        {confirmedBooking.status === "PENDING_VERIFICATION"
                          ? "PAYMENT PENDING VERIFICATION"
                          : confirmedBooking.status}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmedBooking(null)}
                  aria-label="Close booking confirmation"
                  className={`text-xs font-semibold px-3 py-1.5 min-h-[36px] rounded-lg transition-colors ${
                    confirmedBooking.status === "PENDING_VERIFICATION"
                      ? "text-amber-900 bg-amber-200/50 hover:bg-amber-200"
                      : "text-emerald-900 bg-emerald-200/50 hover:bg-emerald-200"
                  }`}
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4">
                <div className="min-w-0">
                  <span
                    className={
                      confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "text-amber-700 block"
                        : "text-emerald-700 block"
                    }
                  >
                    Venue &amp; Court:
                  </span>
                  <span className="font-semibold text-sm break-words">
                    Boss Pickleball, Gondal • {confirmedBooking.courtName}
                  </span>
                </div>
                <div className="min-w-0">
                  <span
                    className={
                      confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "text-amber-700 block"
                        : "text-emerald-700 block"
                    }
                  >
                    Player:
                  </span>
                  <span className="font-semibold text-sm break-words">
                    {confirmedBooking.customerName} ({confirmedBooking.customerPhone})
                  </span>
                </div>
                <div className="min-w-0">
                  <span
                    className={
                      confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "text-amber-700 block"
                        : "text-emerald-700 block"
                    }
                  >
                    Date &amp; Time Window (IST):
                  </span>
                  <span className="font-semibold text-sm">
                    {new Date(confirmedBooking.startTime).toLocaleDateString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    •{" "}
                    {new Date(confirmedBooking.startTime).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}{" "}
                    –{" "}
                    {new Date(confirmedBooking.endTime).toLocaleTimeString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </span>
                </div>
                <div>
                  <span
                    className={
                      confirmedBooking.status === "PENDING_VERIFICATION"
                        ? "text-amber-700 block"
                        : "text-emerald-700 block"
                    }
                  >
                    Duration &amp;{" "}
                    {confirmedBooking.status === "PENDING_VERIFICATION"
                      ? "Submitted Amount"
                      : confirmedBooking.paymentStatus === "PAID_ONLINE"
                      ? "Paid Online"
                      : "Due at Venue (Cash / UPI)"}
                    :
                  </span>
                  <span className="font-bold text-sm">
                    {formatBookingDuration(confirmedBooking)} • ₹{confirmedBooking.totalPrice}
                  </span>
                  {confirmedBooking.paymentUtr && (
                    <span className="block text-[11px] text-neutral-600 mt-0.5 font-mono">
                      UTR: {confirmedBooking.paymentUtr}
                    </span>
                  )}
                </div>
              </div>

              {confirmedBooking.status === "PENDING_VERIFICATION" ? (
                <div className="p-3 bg-amber-100/70 rounded-xl text-[11px] text-amber-900 leading-relaxed border border-amber-200">
                  <strong>Notice:</strong> Your payment screenshot has been submitted for review. Your slot is held temporarily while our front desk verifies the UPI transfer against bank records. Once verified, this booking will become confirmed and count toward venue bookings.
                </div>
              ) : (
                <div className="p-3 bg-emerald-100/60 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                  Reservation confirmed for payment at the venue reception desk upon arrival. Signed-in account holders can cancel up to 2 hours before start via &ldquo;My Reservations&rdquo;; within 2 hours or for payment adjustments, contact venue reception.
                </div>
              )}
            </div>
          )}

          {/* Active Hold Countdown Banner */}
          {activeHold && holdTimerSeconds > 0 && (
            <div className="mb-6 max-w-2xl mx-auto p-4 rounded-2xl bg-[#0d1a2c] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start sm:items-center gap-3">
                <Timer className="w-5 h-5 text-[#c7f711] animate-spin shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <span className="text-xs font-semibold block text-[#c7f711]">
                    Temporary Hold Active: {Math.floor(holdTimerSeconds / 60)}:
                    {(holdTimerSeconds % 60).toString().padStart(2, "0")} left
                  </span>
                  <span className="text-[11px] text-white/75 leading-relaxed block">
                    Temporarily held for this checkout session. Confirm your details before the timer expires.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleReleaseHold}
                className="self-start sm:self-center shrink-0 px-3.5 py-2 min-h-[36px] rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
              >
                Release Hold
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Slot Picker Column */}
            <div className="lg:col-span-8 bg-white border border-neutral-200 rounded-[16px] p-4 sm:p-6 lg:p-8 card">
              {/* Top Controls: Date and Court Picker */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-neutral-100 mb-4">
                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Calendar className="w-4 h-4 text-[#0000ee] shrink-0" />
                  <label htmlFor="booking-date-input" className="text-xs font-semibold text-neutral-800 shrink-0">
                    Date:
                  </label>
                  <input
                    id="booking-date-input"
                    type="date"
                    min={todayDate}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="min-w-0 flex-1 sm:flex-initial min-h-[44px] border border-neutral-300 rounded-lg px-3 py-2 text-base sm:text-xs text-neutral-800 focus:border-[#0000ee]"
                  />
                </div>

                {/* Court Filter Tabs */}
                <div role="group" aria-label="Select Pickleball Court" className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {courts.map((court) => (
                    <button
                      key={court.id}
                      type="button"
                      aria-pressed={selectedCourtId === court.id}
                      onClick={() => setSelectedCourtId(court.id)}
                      className={`px-3.5 py-2 min-h-[42px] flex-1 sm:flex-initial rounded-lg text-xs font-semibold transition-all text-center whitespace-nowrap ${
                        selectedCourtId === court.id
                          ? "bg-[#0d1a2c] text-white shadow-sm"
                          : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                      }`}
                    >
                      {court.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Operating Hours, Holiday Badge & Live Sync Indicator */}
              <div className="mb-4 sm:mb-5 flex flex-wrap items-center justify-between gap-2.5">
                {arenaClosed ? (
                  <div className="w-full p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 flex items-start sm:items-center gap-3">
                    <span className="text-2xl shrink-0">🏮</span>
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
                  <>
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-2xl sm:rounded-full max-w-full leading-snug">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Operating Hours ({bookingDate}): {arenaOpenTime} – {arenaCloseTime} IST</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isRefreshingAvailability ? (
                        <span className="text-[11px] text-neutral-600 flex items-center gap-1">
                          <RefreshCw className="w-3 h-3 animate-spin text-[#0000ee]" />
                          Updating availability...
                        </span>
                      ) : lastSyncedAt ? (
                        <span className="text-[11px] text-neutral-600 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Live synced {lastSyncedAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => fetchSlots(false)}
                        className="min-w-[40px] min-h-[40px] p-2 rounded-lg border border-neutral-200 text-neutral-700 hover:bg-neutral-100 hover:text-black transition-all flex items-center justify-center shrink-0"
                        title="Refresh live slot availability"
                        aria-label="Refresh live slot availability"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAvailability ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Connection Error / Stale Warning */}
              {availabilityError && (
                <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{availabilityError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchSlots(false)}
                    className="px-3.5 py-2 min-h-[38px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold flex-shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Slot Status Legend (non-color cues + color indicators) */}
              {!arenaClosed && (
                <div
                  aria-label="Slot status legend"
                  className="mb-4 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[11px] text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5"
                >
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
                    ✓ Available
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-black" aria-hidden="true" />
                    ● Selected
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-amber-600" aria-hidden="true" />
                    ⏳ Held
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-600" aria-hidden="true" />
                    ✕ Booked
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-slate-500" aria-hidden="true" />
                    ⊘ Blocked
                  </span>
                </div>
              )}

              {/* Slot Grid */}
              {!arenaClosed && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {availableSlots.length > 0 ? (
                    availableSlots.map((slot) => {
                      const slotStartMs = new Date(slot.startTime).getTime();
                      const slotEndMs = new Date(slot.endTime).getTime();
                      const rangeStartMs = selectedSlot ? new Date(selectedSlot.startTime).getTime() : 0;
                      const rangeEndMs = selectedSlot ? rangeStartMs + durationMinutes * 60 * 1000 : 0;
                      const isRangeCovered = Boolean(selectedSlot && slotStartMs >= rangeStartMs && slotEndMs <= rangeEndMs);
                      const isSelected = selectedSlot?.slotId === slot.slotId || isRangeCovered;
                      const isHeld = slot.status === "HELD" && !isRangeCovered;
                      const isBooked = slot.status === "BOOKED";
                      const isBlocked = slot.status === "BLOCKED";
                      const isPassed = slot.status === "PASSED";

                      let statusBadgeLabel = `✓ ₹${slot.price}`;
                      let statusBadgeClass = "bg-emerald-600";
                      let cardStyle = "bg-white border-neutral-300 hover:border-[#0d1a2c] text-neutral-900 hover:shadow-sm";

                      if (isSelected) {
                        cardStyle = "bg-[#c7f711] border-[#0d1a2c] text-black font-semibold shadow-md ring-2 ring-[#0d1a2c]/30";
                        statusBadgeClass = "bg-black";
                        statusBadgeLabel = slot.slotId === selectedSlot?.slotId ? "● Start Time" : "● Selected";
                      } else if (isPassed) {
                        cardStyle = "bg-neutral-100 border-neutral-300 text-neutral-600 cursor-not-allowed";
                        statusBadgeClass = "bg-neutral-500";
                        statusBadgeLabel = "– Passed";
                      } else if (isHeld) {
                        cardStyle = "bg-amber-50 border-amber-300 text-amber-950 cursor-not-allowed";
                        statusBadgeClass = "bg-amber-600";
                        statusBadgeLabel = "⏳ Held";
                      } else if (isBooked) {
                        cardStyle = "bg-rose-50 border-rose-300 text-rose-900 cursor-not-allowed";
                        statusBadgeClass = "bg-rose-600";
                        statusBadgeLabel = "✕ Booked";
                      } else if (isBlocked) {
                        cardStyle = "bg-slate-100 border-slate-300 text-slate-800 cursor-not-allowed";
                        statusBadgeClass = "bg-slate-500";
                        statusBadgeLabel = "⊘ Blocked";
                      }

                      const accessibleText = `${slot.timeLabel}, ${
                        slot.isAvailable
                          ? `Available at ₹${slot.price}`
                          : isSelected
                          ? "Selected"
                          : isHeld
                          ? "Temporarily held in another cart"
                          : isBooked
                          ? "Already booked"
                          : isBlocked
                          ? "Blocked for maintenance"
                          : "Time slot passed"
                      }`;

                      return (
                        <button
                          key={slot.slotId}
                          type="button"
                          disabled={!slot.isAvailable && !isSelected}
                          onClick={() => handleSelectSlot(slot)}
                          aria-label={accessibleText}
                          aria-pressed={isSelected}
                          tabIndex={slot.isAvailable ? 0 : -1}
                          className={`p-3 sm:p-3.5 min-h-[70px] rounded-[12px] border text-left flex flex-col justify-between gap-1.5 transition-all ${cardStyle}`}
                        >
                          <div className="flex items-start justify-between gap-1.5 w-full">
                            <span className="text-[11px] min-[375px]:text-xs font-semibold leading-tight">{slot.timeLabel}</span>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 mt-1 ${statusBadgeClass}`}
                              aria-hidden="true"
                            />
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                            <span className="text-[11px] font-semibold">
                              {statusBadgeLabel}
                            </span>
                            {slot.isPeak && slot.isAvailable && !isSelected && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded">
                                Peak
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })
                  ) : !hasLoadedSlots || isRefreshingAvailability ? (
                    <div className="col-span-2 sm:col-span-3 text-center py-8 text-xs text-neutral-600 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0000ee]" />
                      <span>Checking live court availability...</span>
                    </div>
                  ) : availabilityError ? (
                    <div className="col-span-2 sm:col-span-3 text-center py-8 px-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                      <p className="font-semibold">Unable to load court slots right now.</p>
                      <button
                        type="button"
                        onClick={() => fetchSlots(false)}
                        className="px-4 py-2 min-h-[40px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                      >
                        Retry Availability Check
                      </button>
                    </div>
                  ) : (
                    <div className="col-span-2 sm:col-span-3 text-center py-8 px-4 rounded-xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 space-y-2">
                      <p>No bookable slots found for {bookingDate} on this court.</p>
                      <button
                        type="button"
                        onClick={() => fetchSlots(false)}
                        className="px-4 py-2 min-h-[40px] rounded-lg border border-neutral-300 hover:bg-white font-semibold text-neutral-800"
                      >
                        Refresh Slots
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reservation Checkout Card */}
            <div className="lg:col-span-4 bg-[#0d1a2c] text-white rounded-[16px] p-5 sm:p-6 lg:p-8 flex flex-col justify-between min-h-[380px] shadow-xl">
              <div>
                <h4 className="text-base font-medium text-white mb-4 flex items-center justify-between gap-2">
                  <span>Checkout Summary</span>
                  <span className="text-xs bg-[#c7f711] text-black px-2.5 py-0.5 rounded-full font-bold shrink-0">
                    Direct Rate
                  </span>
                </h4>

                <div className="space-y-2.5 text-xs text-white/75 border-b border-white/10 pb-4 mb-4">
                  <div className="flex justify-between gap-3">
                    <span>Venue</span>
                    <span className="text-white font-medium text-right">Boss Pickleball, Gondal</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Date</span>
                    <span className="text-white font-medium text-right">{bookingDate}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Court</span>
                    <span className="text-white font-medium text-right">
                      {courts.find((c) => c.id === selectedCourtId)?.name || "Court 1"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Selected Window</span>
                    <span className="text-[#c7f711] font-semibold text-right">
                      {selectedRangeDetails ? selectedRangeDetails.timeLabel : "Select an available slot"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pt-1 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <span>Duration</span>
                      <span className="text-[#c7f711] font-bold">
                        {selectedRangeDetails ? selectedRangeDetails.durationLabel : formatDurationLabel(durationMinutes)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[30, 60, 90, 120, 150, 180].map((mins) => {
                        const isSelectedDuration = durationMinutes === mins;
                        return (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => handleChangeDuration(mins)}
                            className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all text-center ${
                              isSelectedDuration
                                ? "bg-[#c7f711] text-black border-[#c7f711] shadow-sm font-bold"
                                : "bg-white/10 hover:bg-white/20 text-white/90 border-white/15"
                            }`}
                          >
                            {mins === 30 ? "30m" : mins === 60 ? "1 hr" : mins === 90 ? "1.5h" : mins === 120 ? "2 hrs" : mins === 150 ? "2.5h" : "3 hrs"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-2.5 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-[#c7f711]" /> Choose Payment Option
                      </span>
                      <span className="text-[10px] text-[#c7f711] font-semibold bg-[#c7f711]/10 px-2 py-0.5 rounded-full border border-[#c7f711]/30">
                        {checkoutPaymentMethod === "UPI_MANUAL" ? "⚡ UPI Online" : "🏟️ Pay at Venue"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setCheckoutPaymentMethod("UPI_MANUAL")}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                          checkoutPaymentMethod === "UPI_MANUAL"
                            ? "bg-[#c7f711] text-black border-[#c7f711] shadow-md shadow-[#c7f711]/20 ring-2 ring-[#c7f711]/30"
                            : "bg-white/10 hover:bg-white/15 text-white/90 border-white/20"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <QrCode className="w-3.5 h-3.5" /> Pay Online (UPI)
                        </span>
                        <span className={`text-[9px] ${checkoutPaymentMethod === "UPI_MANUAL" ? "text-black/75" : "text-[#c7f711]"}`}>
                          Scan QR &amp; Upload
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckoutPaymentMethod("PAY_AT_VENUE")}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 shadow-sm ${
                          checkoutPaymentMethod === "PAY_AT_VENUE"
                            ? "bg-[#c7f711] text-black border-[#c7f711] shadow-md shadow-[#c7f711]/20 ring-2 ring-[#c7f711]/30"
                            : "bg-white/10 hover:bg-white/15 text-white/90 border-white/20"
                        }`}
                      >
                        <span>🏟️ Pay at Venue</span>
                        <span className={`text-[9px] ${checkoutPaymentMethod === "PAY_AT_VENUE" ? "text-black/75" : "text-white/50"}`}>
                          Cash / Reception
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Form fields */}
                <form onSubmit={handleConfirmBooking} className="space-y-3 mb-4">
                  <div>
                    <label htmlFor="checkout-cust-name" className="text-[11px] text-white/80 block mb-1">
                      Your Full Name *
                    </label>
                    <input
                      id="checkout-cust-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Enter your full name"
                      value={custName}
                      onChange={(e) => setCustName(e.target.value)}
                      className="w-full min-h-[44px] bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-white/45 focus:border-[#c7f711]"
                    />
                  </div>

                  <div>
                    <label htmlFor="checkout-cust-phone" className="text-[11px] text-white/80 block mb-1">
                      Mobile Phone (for Booking Confirmation) *
                    </label>
                    <input
                      id="checkout-cust-phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      placeholder="10-digit mobile number"
                      value={custPhone}
                      onChange={(e) => setCustPhone(e.target.value)}
                      className="w-full min-h-[44px] bg-white/10 border border-white/20 rounded-xl px-3.5 py-2.5 text-base sm:text-xs text-white placeholder-white/45 focus:border-[#c7f711]"
                    />
                  </div>

                  {checkoutPaymentMethod === "PAY_AT_VENUE" ? (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-[11px] text-white/80 flex items-start gap-2">
                      <span className="text-[#c7f711] shrink-0">•</span>
                      <span>
                        Pay at reception upon arrival (Cash / Counter UPI QR). Ask desk staff regarding venue equipment availability.
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 bg-white/5 border border-white/15 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#c7f711] flex items-center gap-1.5">
                          <QrCode className="w-4 h-4" /> Scan &amp; Pay via UPI
                        </span>
                        <span className="text-xs bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                          ₹{selectedRangeDetails ? selectedRangeDetails.totalPrice : (durationMinutes / 60) * 400}
                        </span>
                      </div>

                      {/* QR Display */}
                      <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center text-center shadow-inner">
                        <img
                          src={
                            venueUpiQrUrl ||
                            `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=4&data=${encodeURIComponent(
                              `upi://pay?pa=${venueUpiId}&pn=${encodeURIComponent(
                                venueUpiName
                              )}&am=${
                                selectedRangeDetails
                                  ? selectedRangeDetails.totalPrice
                                  : (durationMinutes / 60) * 400
                              }&cu=INR&tn=${encodeURIComponent(
                                `Court Booking ${custPhone || ""}`
                              )}`
                            )}`
                          }
                          alt="Venue UPI QR Code"
                          className="w-36 h-36 object-contain rounded"
                        />
                        <p className="text-[11px] font-semibold text-neutral-800 mt-2">
                          {venueUpiName}
                        </p>
                        <p className="text-[10px] text-neutral-500">
                          Exact Amount: ₹
                          {selectedRangeDetails
                            ? selectedRangeDetails.totalPrice
                            : (durationMinutes / 60) * 400}
                        </p>
                      </div>

                      {/* UPI ID + Copy */}
                      <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-lg border border-white/10 text-xs">
                        <div className="truncate mr-2">
                          <span className="text-white/60 block text-[10px]">Venue UPI ID</span>
                          <span className="font-mono text-white font-semibold">{venueUpiId}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(venueUpiId);
                            setCopiedUpi(true);
                            setTimeout(() => setCopiedUpi(false), 2000);
                          }}
                          className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded text-[11px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                        >
                          {copiedUpi ? (
                            <>
                              <Check className="w-3 h-3 text-[#c7f711]" /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" /> Copy ID
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-[10px] text-white/70 leading-tight">
                        Include your mobile number or name in the payment remark. Take a screenshot after payment completes.
                      </p>

                      {/* Payment Screenshot Upload */}
                      <div>
                        <label className="text-[11px] text-white/90 block mb-1 font-semibold flex items-center gap-1">
                          <Upload className="w-3.5 h-3.5 text-[#c7f711]" /> Upload Payment Screenshot *
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          required={checkoutPaymentMethod === "UPI_MANUAL"}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) {
                                alert("Screenshot exceeds 5MB limit. Please choose a smaller image.");
                                e.target.value = "";
                                return;
                              }
                              setPaymentScreenshotFile(file);
                              setPaymentScreenshotPreview(URL.createObjectURL(file));
                            }
                          }}
                          className="w-full text-xs text-white/80 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#c7f711] file:text-black hover:file:bg-[#b0dc0d] cursor-pointer"
                        />
                        {paymentScreenshotPreview && (
                          <div className="mt-2 relative inline-block">
                            <img
                              src={paymentScreenshotPreview}
                              alt="Payment Proof Preview"
                              className="w-20 h-20 object-cover rounded-lg border border-white/30"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentScreenshotFile(null);
                                setPaymentScreenshotPreview(null);
                              }}
                              className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Optional UTR / Reference */}
                      <div>
                        <label htmlFor="checkout-utr" className="text-[11px] text-white/80 block mb-1">
                          UPI Ref / UTR / Transaction ID (Optional)
                        </label>
                        <input
                          id="checkout-utr"
                          type="text"
                          placeholder="e.g. 432109876543 (12 digits)"
                          value={paymentUtr}
                          onChange={(e) => setPaymentUtr(e.target.value)}
                          className="w-full min-h-[40px] bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:border-[#c7f711]"
                        />
                      </div>
                    </div>
                  )}

                  {bookingError && (
                    <div className="p-3 rounded-xl text-[11px] bg-red-500/20 text-red-200 border border-red-500/30 flex flex-col gap-1.5">
                      <span>{bookingError}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBookingError(null);
                          fetchSlots();
                        }}
                        className="text-xs text-[#c7f711] underline hover:no-underline font-medium text-left py-1"
                      >
                        Refresh Availability &amp; Try Again
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white pt-2">
                    <span>
                      Total Amount (
                      {selectedRangeDetails
                        ? selectedRangeDetails.durationLabel
                        : formatDurationLabel(durationMinutes)}
                      )
                    </span>
                    <span className="text-lg text-[#c7f711]">
                      {selectedRangeDetails ? `₹${selectedRangeDetails.totalPrice}` : "Select a slot"}
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={bookingSubmitting || !selectedSlot || arenaClosed}
                    className="button-primary w-full min-h-[48px] text-center mt-3 disabled:opacity-50 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold leading-snug"
                  >
                    {bookingSubmitting ? (
                      <span>
                        {checkoutPaymentMethod === "UPI_MANUAL"
                          ? "Uploading Proof & Submitting..."
                          : "Verifying & Locking Slot..."}
                      </span>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 shrink-0" />
                        <span>
                          {checkoutPaymentMethod === "UPI_MANUAL"
                            ? "Submit for Verification (Manual UPI)"
                            : "Confirm Reservation (Pay at Venue)"}
                        </span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              <p className="text-[11px] text-white/70 text-center leading-relaxed">
                Availability is revalidated on the server before confirmation. Cancellations allowed up to 2 hours before start via your account.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. SECTION — Frequently Asked Questions */}
      {/* ========================================================================= */}
      <section className="relative w-full py-14 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <span className="inline-block px-4 py-1.5 rounded-full border border-neutral-200 text-xs text-neutral-700 mb-3 bg-neutral-50 font-medium">
              Got Questions?
            </span>
            <h3 className="text-2xl sm:text-[34px] font-medium text-[#0d1a2c] tracking-tight leading-[1.2]">
              Frequently Asked Questions
            </h3>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div
                  key={index}
                  className="rounded-[16px] bg-white border border-neutral-200 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full p-4 sm:p-6 min-h-[52px] text-left flex items-center justify-between gap-4"
                  >
                    <span className="text-sm font-semibold text-[#0d1a2c] leading-snug">{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 shrink-0 text-neutral-600 transition-transform ${
                        isOpen ? "rotate-180 text-[#0000ee]" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 sm:px-6 pb-5 sm:pb-6 text-xs sm:text-sm text-neutral-700 leading-relaxed border-t border-neutral-100 pt-4">
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
      {/* 5. FOOTER (#0D1A2C background) */}
      {/* ========================================================================= */}
      <footer id="contact" className="relative w-full py-14 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#0d1a2c] text-white border-t border-white/10">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10 pb-12 sm:pb-16 border-b border-white/10">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 shrink-0 rounded-full bg-white flex items-center justify-center p-0.5 shadow-md border-2 border-white/60 overflow-hidden">
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
            <p className="text-xs text-white/75 leading-relaxed">
              Experience the thrill of pickleball with a community that plays hard, laughs often, and welcomes everyone.
            </p>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Navigation</h5>
            <ul className="space-y-1.5 text-xs text-white/80">
              <li><a href="#booking" className="hover:text-[#c7f711] transition-colors inline-flex items-center min-h-[36px]">Book Court</a></li>
              <li><a href="#gallery" className="hover:text-[#c7f711] transition-colors inline-flex items-center min-h-[36px]">Action Gallery</a></li>
            </ul>
          </div>

          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wider text-white mb-4">Arena Schedule &amp; Venue</h5>
            <p className="text-xs text-white/75 leading-relaxed">
              Hours ({bookingDate}): <br />
              {configuredHoursText} <br />
              Boss Pickleball, Gondal, Gujarat <br />
              <span className="text-white/60 mt-1 block italic">[Venue Phone: Pending Owner Setup]</span>
            </p>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto w-full pt-8 flex flex-col sm:flex-row items-center justify-between text-[11px] text-white/60 gap-3 text-center sm:text-left">
          <p>© 2026 Boss Pickleball. All rights reserved.</p>
          <p>Pickleball Venue • Courts 1, 2, and 3 • Gondal, Gujarat</p>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: MY BOOKINGS (SECURE CUSTOMER RESERVATIONS & CANCELLATION) */}
      {/* ========================================================================= */}
      {showLookupModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lookup-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="bg-[#0d141f] border border-white/15 rounded-3xl p-5 sm:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto text-white">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-5 h-5 text-[#c7f711] shrink-0" />
                <h3 id="lookup-modal-title" className="font-bold text-base text-white truncate">My Reservations</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLookupModal(false)}
                aria-label="Close my reservations modal"
                className="text-white/60 hover:text-white min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-white/10 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!currentUser ? (
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 mb-2 text-center">
                <ShieldCheck className="w-10 h-10 text-[#c7f711] mx-auto mb-2" />
                <h4 className="font-semibold text-sm text-white mb-1.5">Sign In to View Your Reservations</h4>
                <p className="text-xs text-white/75 mb-4 leading-relaxed">
                  To protect customer privacy, reservation records are only accessible to verified account holders. (Public phone lookup is disabled until an SMS OTP provider is configured).
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowLookupModal(false);
                    setShowLoginModal(true);
                  }}
                  className="button-primary w-full text-center py-2.5 text-xs font-bold"
                >
                  Sign In With Account
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="min-w-0 flex-1">
                    <span className="text-white/60 block text-[10px] uppercase tracking-wider">Verified Account</span>
                    <span className="text-white font-medium break-words">{currentUser.name} ({currentUser.phone || currentUser.email})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLookupBookings()}
                    disabled={lookupLoading}
                    className="bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-bold text-xs px-3.5 py-2 min-h-[38px] rounded-lg transition-all shrink-0"
                  >
                    {lookupLoading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

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
                        className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-white">
                            {b.courtName} • <span className="text-[#c7f711]">₹{b.totalPrice}</span>
                          </div>
                          <div className="text-[11px] text-white/70 mt-0.5">
                            {new Date(b.startTime).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })} IST
                          </div>
                          <span className="text-[10px] text-white/50 block mt-0.5 font-mono">
                            Ref: #{b.id.slice(-6).toUpperCase()} • Status: {b.status}
                          </span>
                        </div>

                        <div className="shrink-0">
                          {b.status === "CONFIRMED" ? (
                            <button
                              type="button"
                              onClick={() => handleCustomerCancel(b.id)}
                              className="px-3.5 py-2 min-h-[38px] rounded-lg text-xs font-semibold bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 w-full sm:w-auto"
                            >
                              Cancel
                            </button>
                          ) : (
                            <span className="text-[10px] text-white/50 italic">{b.status}</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-xs text-white/55">
                      No reservations found for your account. Select a slot on the calendar to book!
                    </div>
                  )}
                </div>
              </>
            )}
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
            if (user.phone) {
              setLookupPhone(user.phone);
            }
          }
        }}
      />
    </div>
  );
}
