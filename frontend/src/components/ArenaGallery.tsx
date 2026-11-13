"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  Video,
  Camera,
  ArrowRight,
} from "lucide-react";

export interface GalleryItem {
  id: string;
  type: "video" | "image";
  title: string;
  category: "matchplay" | "gear" | "training" | "tournament";
  tag?: string;
  src: string;
  videoSrc?: string;
  aspect: "tall" | "square" | "standard";
  caption: string;
  duration?: string;
}

const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "gal-1",
    type: "image",
    title: "Kitchen Dink Rally & Net Play",
    category: "matchplay",
    tag: "Live Action",
    src: "/images/hero-player.jpg",
    aspect: "tall",
    caption: "Fast-paced third shot drop and kitchen rally exchanges on Court 1.",
  },
  {
    id: "gal-2",
    type: "image",
    title: "Official Pro Selkirk Carbon Paddles",
    category: "gear",
    tag: "Pro Gear",
    src: "/images/bullpadel-dark.jpg",
    aspect: "square",
    caption: "USAPA tournament-grade carbon fiber paddles and court balls available at reception.",
  },
  {
    id: "gal-3",
    type: "image",
    title: "Baseline Reset & Court Defense",
    category: "training",
    tag: "Training",
    src: "/images/athletes-team.jpg",
    aspect: "tall",
    caption: "Practicing the defensive baseline reset and crosscourt placement.",
  },
  {
    id: "gal-4",
    type: "image",
    title: "Optic Yellow Court Ball in Flight",
    category: "matchplay",
    tag: "Matchplay",
    src: "/images/ball-hand.jpg",
    aspect: "standard",
    caption: "High-visibility optic balls designed for consistent court bounce.",
  },
  {
    id: "gal-5",
    type: "image",
    title: "Precision Backhand Slice Grip",
    category: "gear",
    tag: "Equipment",
    src: "/images/gallery-action-scroll.jpg",
    aspect: "tall",
    caption: "Ergonomic moisture-wicking paddle grip for control and spin.",
  },
  {
    id: "gal-6",
    type: "image",
    title: "Overhead Smash & Volley Action",
    category: "tournament",
    tag: "Match Action",
    src: "/images/joola-court.jpg",
    aspect: "standard",
    caption: "Agile overhead court coverage and smashes during competitive play.",
  },
  {
    id: "gal-7",
    type: "image",
    title: "Singles Speed & Footwork Coverage",
    category: "matchplay",
    tag: "Court Play",
    src: "/images/hero-action.jpg",
    aspect: "tall",
    caption: "High-tempo singles rally across the full outdoor and indoor court surface.",
  },
  {
    id: "gal-8",
    type: "image",
    title: "Court Arena Illumination",
    category: "tournament",
    tag: "Arena",
    src: "/images/court-wide.jpg",
    aspect: "standard",
    caption: "Evening LED lighting setup across our dedicated Gondal pickleball courts.",
  },
];

export default function ArenaGallery({ standardRate = 400 }: { standardRate?: number } = {}) {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(GALLERY_ITEMS);
  const [activeFilter, setActiveFilter] = useState<"all" | "video" | "image" | "gear">("all");
  const [activeModalItem, setActiveModalItem] = useState<GalleryItem | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [modalVideoFailed, setModalVideoFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Compact Preview vs Full Gallery expansion
  const [isExpanded, setIsExpanded] = useState(false);
  const [featuredId, setFeaturedId] = useState<string>("gal-1");

  const sectionRef = useRef<HTMLElement>(null);
  const fullGalleryRef = useRef<HTMLDivElement>(null);

  const hasVideos = galleryItems.some((item) => item.type === "video" && item.videoSrc);

  // Respect reduced-motion preferences
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Fetch live gallery items if available from backend
  useEffect(() => {
    fetch("/api/gallery", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.items) && data.items.length > 0) {
          // Ensure Selkirk item has a valid asset
          const sanitized = data.items.map((item: GalleryItem) => {
            if (
              item.id === "gal-2" ||
              item.title.toLowerCase().includes("selkirk") ||
              item.title.toLowerCase().includes("official pro")
            ) {
              return {
                ...item,
                title: "Official Pro Selkirk Carbon Paddles",
                src: item.src && item.src !== "" ? item.src : "/images/bullpadel-dark.jpg",
              };
            }
            return item;
          });
          setGalleryItems(sanitized);
        }
      })
      .catch((err) => console.error("Error fetching live gallery:", err));
  }, []);

  // Pause videos when gallery section scrolls offscreen
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            // Section is offscreen: pause all videos immediately
            setActivePlayingId(null);
          }
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fullscreen modal keyboard navigation
  useEffect(() => {
    if (!activeModalItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModalItem(null);
        setModalVideoFailed(false);
      } else if (e.key === "ArrowRight") {
        const idx = galleryItems.findIndex((i) => i.id === activeModalItem.id);
        setActiveModalItem(galleryItems[(idx + 1) % galleryItems.length]);
      } else if (e.key === "ArrowLeft") {
        const idx = galleryItems.findIndex((i) => i.id === activeModalItem.id);
        setActiveModalItem(galleryItems[(idx - 1 + galleryItems.length) % galleryItems.length]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeModalItem, galleryItems]);

  const toggleVideoPlayback = useCallback((id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setActivePlayingId((prev) => (prev === id ? null : id));
  }, []);

  const handleNextModal = () => {
    if (!activeModalItem) return;
    const idx = galleryItems.findIndex((i) => i.id === activeModalItem.id);
    const nextIdx = (idx + 1) % galleryItems.length;
    setActiveModalItem(galleryItems[nextIdx]);
  };

  const handlePrevModal = () => {
    if (!activeModalItem) return;
    const idx = galleryItems.findIndex((i) => i.id === activeModalItem.id);
    const prevIdx = (idx - 1 + galleryItems.length) % galleryItems.length;
    setActiveModalItem(galleryItems[prevIdx]);
  };

  const handleExpandToFullGallery = () => {
    setIsExpanded(true);
    // Smoothly scroll down to full gallery view on next tick
    setTimeout(() => {
      fullGalleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const handleCollapseToPreview = () => {
    setIsExpanded(false);
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  // Preview data: 1 featured item + 4 thumbnails
  const featuredItem =
    galleryItems.find((i) => i.id === featuredId) || galleryItems[0];
  const thumbnailItems = galleryItems
    .filter((i) => i.id !== featuredItem.id)
    .slice(0, 4);

  // Full gallery filtered items
  const filteredItems = galleryItems.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "video") return item.type === "video";
    if (activeFilter === "image") return item.type === "image";
    if (activeFilter === "gear") return item.category === "gear";
    return true;
  });

  const col1 = filteredItems.filter((_, idx) => idx % 4 === 0);
  const col2 = filteredItems.filter((_, idx) => idx % 4 === 1);
  const col3 = filteredItems.filter((_, idx) => idx % 4 === 2);
  const col4 = filteredItems.filter((_, idx) => idx % 4 === 3);

  return (
    <section
      ref={sectionRef}
      id="gallery"
      className="relative w-full py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-10 bg-gradient-to-b from-[#bcd4ea] via-[#cce0f2] to-[#bcd4ea] text-neutral-900 overflow-hidden"
    >
      {/* Background Court Atmosphere Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay">
        <div className="w-full h-full bg-[radial-gradient(#00A852_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-[1240px] mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-white/60 shadow-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00A852] animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-neutral-800 tracking-wider uppercase">
                Live Action &amp; Arena Highlights
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-neutral-950 tracking-tight leading-[1.15]">
              Experience Boss Pickleball In Motion
            </h2>
            <p className="text-xs sm:text-sm text-neutral-800 max-w-xl mt-2 leading-relaxed">
              Explore court highlights, player matchplay, and tournament equipment available at Boss Pickleball Gondal.
            </p>
          </div>

          {/* Header Action Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isExpanded ? handleCollapseToPreview : handleExpandToFullGallery}
              aria-expanded={isExpanded}
              aria-controls="gallery-content-area"
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[42px] rounded-full bg-[#0d1a2c] hover:bg-[#1a2d47] text-white text-xs font-bold transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
            >
              <Layers className="w-3.5 h-3.5 text-[#c7f711]" />
              <span>{isExpanded ? "Compact Preview" : `View all (${galleryItems.length})`}</span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-[#c7f711]" />
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. COMPACT PREVIEW (DEFAULT STATE) */}
        {/* 1 Featured Card + 4 Smaller Thumbnails */}
        {/* ========================================================================= */}
        <div id="gallery-content-area">
          {!isExpanded ? (
            <div className="flex flex-col gap-5 sm:gap-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
                {/* 1. FEATURED ITEM (Desktop: 7 cols / Mobile: full width) */}
                <div className="lg:col-span-7 xl:col-span-7">
                  <FeaturedPreviewCard
                    item={featuredItem}
                    isMuted={isMuted}
                    isPlaying={activePlayingId === featuredItem.id}
                    onTogglePlay={(e) => toggleVideoPlayback(featuredItem.id, e)}
                    onOpen={() => setActiveModalItem(featuredItem)}
                  />
                </div>

                {/* 2. FOUR SMALLER THUMBNAILS (Desktop: 5 cols 2x2 / Mobile: 2-column layout) */}
                <div className="lg:col-span-5 xl:col-span-5">
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 h-full">
                    {thumbnailItems.map((item) => (
                      <ThumbnailCard
                        key={item.id}
                        item={item}
                        isActive={item.id === featuredId}
                        onSelect={() => setFeaturedId(item.id)}
                        onOpen={() => setActiveModalItem(item)}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Clear Prominent "View all photos and videos" Action */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl bg-white/80 border border-white/60 shadow-sm backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0d1a2c] flex items-center justify-center text-[#c7f711] shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug">
                      Complete Arena Media Archive
                    </h4>
                    <p className="text-[11px] sm:text-xs text-neutral-600 mt-0.5">
                      Explore all {galleryItems.length} matchplay photos, pro paddle showcases, and stadium angles.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleExpandToFullGallery}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-full bg-[#0d1a2c] hover:bg-[#1a2d47] text-white text-xs font-bold tracking-tight transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
                >
                  <span>View all photos and videos</span>
                  <ArrowRight className="w-4 h-4 text-[#c7f711]" />
                </button>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 2. COMPLETE FULL GALLERY (EXPANDED STATE) */
            /* Full Filters, Sound Toggle, and Mosaic Grid */
            /* ========================================================================= */
            <div ref={fullGalleryRef} className="flex flex-col gap-6 sm:gap-8 animate-in fade-in duration-300">
              {/* Interactive Controls & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl bg-white/85 backdrop-blur-md border border-white/70 shadow-sm">
                <div role="group" aria-label="Filter gallery items" className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    aria-pressed={activeFilter === "all"}
                    onClick={() => setActiveFilter("all")}
                    className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852] ${
                      activeFilter === "all"
                        ? "bg-[#0d1a2c] text-white shadow-sm"
                        : "text-neutral-800 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    All ({galleryItems.length})
                  </button>
                  {hasVideos && (
                    <button
                      type="button"
                      aria-pressed={activeFilter === "video"}
                      onClick={() => setActiveFilter("video")}
                      className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852] ${
                        activeFilter === "video"
                          ? "bg-[#0d1a2c] text-white shadow-sm"
                          : "text-neutral-800 hover:text-black hover:bg-black/5"
                      }`}
                    >
                      <Video className="w-3.5 h-3.5 text-[#c7f711]" />
                      <span>Videos</span>
                    </button>
                  )}
                  <button
                    type="button"
                    aria-pressed={activeFilter === "image"}
                    onClick={() => setActiveFilter("image")}
                    className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852] ${
                      activeFilter === "image"
                        ? "bg-[#0d1a2c] text-white shadow-sm"
                        : "text-neutral-800 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5 text-blue-600" />
                    <span>Photos</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={activeFilter === "gear"}
                    onClick={() => setActiveFilter("gear")}
                    className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852] ${
                      activeFilter === "gear"
                        ? "bg-[#0d1a2c] text-white shadow-sm"
                        : "text-neutral-800 hover:text-black hover:bg-black/5"
                    }`}
                  >
                    Gear &amp; Courts
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {hasVideos && (
                    <button
                      type="button"
                      aria-pressed={!isMuted}
                      aria-label={isMuted ? "Unmute gallery videos" : "Mute gallery videos"}
                      onClick={() => setIsMuted(!isMuted)}
                      className="px-3.5 py-1.5 min-h-[38px] rounded-full bg-white border border-neutral-200 shadow-sm text-neutral-900 hover:bg-neutral-50 transition-all flex items-center gap-1.5 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852]"
                      title={isMuted ? "Unmute all videos" : "Mute all videos"}
                    >
                      {isMuted ? (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-neutral-600" />
                          <span>Muted</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-[#00A852]" />
                          <span>Sound On</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCollapseToPreview}
                    className="px-3.5 py-1.5 min-h-[38px] rounded-full bg-neutral-200/80 hover:bg-neutral-300 text-neutral-800 text-xs font-bold transition-all flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00A852]"
                    title="Collapse to compact preview"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Collapse</span>
                  </button>
                </div>
              </div>

              {/* Complete Responsive Gallery Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <div className="flex flex-col gap-4 sm:gap-5">
                  {col1.map((item) => (
                    <FullGalleryCard
                      key={item.id}
                      item={item}
                      isMuted={isMuted}
                      isPlaying={activePlayingId === item.id}
                      onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                      onOpen={() => setActiveModalItem(item)}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4 sm:gap-5">
                  {col2.map((item) => (
                    <FullGalleryCard
                      key={item.id}
                      item={item}
                      isMuted={isMuted}
                      isPlaying={activePlayingId === item.id}
                      onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                      onOpen={() => setActiveModalItem(item)}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4 sm:gap-5">
                  {col3.map((item) => (
                    <FullGalleryCard
                      key={item.id}
                      item={item}
                      isMuted={isMuted}
                      isPlaying={activePlayingId === item.id}
                      onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                      onOpen={() => setActiveModalItem(item)}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-4 sm:gap-5">
                  {col4.map((item) => (
                    <FullGalleryCard
                      key={item.id}
                      item={item}
                      isMuted={isMuted}
                      isPlaying={activePlayingId === item.id}
                      onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                      onOpen={() => setActiveModalItem(item)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. EXPANDED FULLSCREEN LIGHTBOX MODAL */}
      {/* ========================================================================= */}
      {activeModalItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="gallery-lightbox-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200"
        >
          <div className="relative max-w-4xl w-full max-h-[92vh] overflow-y-auto bg-[#0d141f] border border-white/15 rounded-2xl sm:rounded-3xl shadow-2xl text-white flex flex-col">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <h3 id="gallery-lightbox-title" className="font-bold text-sm sm:text-base text-white truncate">
                  {activeModalItem.title}
                </h3>
                {activeModalItem.tag && (
                  <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-[#c7f711]">
                    {activeModalItem.tag}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeModalItem.type === "video" && activeModalItem.videoSrc && !modalVideoFailed && (
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
                    title="Toggle Mute"
                    aria-label={isMuted ? "Unmute video" : "Mute video"}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#c7f711]" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveModalItem(null);
                    setModalVideoFailed(false);
                  }}
                  className="min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden shrink-0">
              {activeModalItem.type === "video" && activeModalItem.videoSrc && !modalVideoFailed ? (
                <video
                  src={activeModalItem.videoSrc}
                  autoPlay={!prefersReducedMotion}
                  loop={!prefersReducedMotion}
                  muted={isMuted}
                  controls
                  playsInline
                  onError={() => setModalVideoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <SafeImage
                  src={activeModalItem.src}
                  alt={activeModalItem.title}
                  fill
                  className="object-contain"
                />
              )}

              {/* Prev / Next Arrows */}
              <button
                type="button"
                onClick={handlePrevModal}
                aria-label="Previous gallery item"
                className="absolute left-2 sm:left-4 top-[42%] -translate-y-1/2 min-w-[40px] min-h-[40px] p-2 sm:p-3 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/25 transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextModal}
                aria-label="Next gallery item"
                className="absolute right-2 sm:right-4 top-[42%] -translate-y-1/2 min-w-[40px] min-h-[40px] p-2 sm:p-3 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/25 transition-all flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Caption Footer */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a1019]">
              <p className="text-xs sm:text-sm text-white/85 leading-relaxed max-w-xl">
                {activeModalItem.caption}
              </p>
              <a
                href="#booking"
                onClick={() => setActiveModalItem(null)}
                className="px-5 py-2.5 min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-xs tracking-tight transition-all text-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                Book Court Now • ₹{standardRate}/hr
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// =========================================================================
// Helper Component: Robust Image with Polished Fallback
// =========================================================================
function SafeImage({
  src,
  alt,
  fill = false,
  className = "",
  sizes,
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#0d141f] via-neutral-900 to-neutral-800 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2">
          <Sparkles className="w-5 h-5 text-[#c7f711]" />
        </div>
        <span className="text-xs font-bold text-white uppercase tracking-wider line-clamp-1">
          {alt}
        </span>
        <span className="text-[10px] text-white/70 mt-0.5 line-clamp-1">Boss Arena Equipment</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

// =========================================================================
// Component: Featured Preview Card (Single prominent item in compact view)
// =========================================================================
function FeaturedPreviewCard({
  item,
  isMuted,
  isPlaying,
  onTogglePlay,
  onOpen,
}: {
  item: GalleryItem;
  isMuted: boolean;
  isPlaying: boolean;
  onTogglePlay: (e: React.MouseEvent) => void;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <div
      onClick={onOpen}
      className="group relative w-full h-[280px] sm:h-[360px] lg:h-[460px] rounded-2xl sm:rounded-3xl overflow-hidden bg-neutral-900 shadow-xl border border-white/20 hover:border-[#00A852] transition-all duration-300 cursor-pointer focus-within:ring-2 focus-within:ring-[#c7f711]"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open featured media: ${item.title}`}
        className="absolute inset-0 z-[5] w-full h-full cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none"
      />

      {/* Media Source */}
      {item.type === "video" && item.videoSrc && !videoFailed ? (
        <div className="relative w-full h-full overflow-hidden bg-black pointer-events-none">
          <video
            ref={videoRef}
            src={item.videoSrc}
            poster={item.src}
            autoPlay={isPlaying}
            loop
            muted={isMuted}
            playsInline
            onError={() => setVideoFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden bg-neutral-800 pointer-events-none">
          <SafeImage
            src={item.src}
            alt={item.title}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Top Bar Badges & Actions */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        {item.type === "video" && (
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
            className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md transition-all flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
            title={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-[#c7f711]" />}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`Expand ${item.title}`}
          className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-md transition-all flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
          title="Fullscreen Lightbox"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Top Left Featured Indicator */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 flex items-center gap-1.5">
        <span className="px-3 py-1 rounded-full bg-[#00A852] text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-[#c7f711]" />
          <span>Featured Highlight</span>
        </span>
      </div>

      {/* Bottom Content Bar */}
      <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10 text-white pointer-events-none">
        {item.tag && (
          <span className="inline-block text-[10px] font-bold tracking-wider uppercase text-[#c7f711] mb-1">
            {item.tag}
          </span>
        )}
        <h3 className="font-extrabold text-base sm:text-xl text-white leading-snug group-hover:text-[#c7f711] transition-colors drop-shadow-sm">
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm text-white/85 mt-1 line-clamp-2 leading-relaxed max-w-xl">
          {item.caption}
        </p>
      </div>
    </div>
  );
}

// =========================================================================
// Component: Thumbnail Card (One of four smaller cards in preview)
// =========================================================================
function ThumbnailCard({
  item,
  isActive,
  onSelect,
  onOpen,
}: {
  item: GalleryItem;
  isActive: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative w-full h-[140px] sm:h-[180px] lg:h-[220px] rounded-xl sm:rounded-2xl overflow-hidden bg-neutral-900 border transition-all duration-300 cursor-pointer shadow-md hover:shadow-xl focus-within:ring-2 focus-within:ring-[#c7f711] ${
        isActive ? "border-[#c7f711] ring-2 ring-[#c7f711]" : "border-white/20 hover:border-white/60"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Select ${item.title}`}
        className="absolute inset-0 z-[5] w-full h-full cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none"
      />

      {/* Thumbnail Image */}
      <div className="relative w-full h-full overflow-hidden bg-neutral-800 pointer-events-none">
        <SafeImage
          src={item.src}
          alt={item.title}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
          className="object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none" />
      </div>

      {/* Top Right Mini Action */}
      <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-20 flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`Open lightbox for ${item.title}`}
          className="w-7 h-7 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
          title="Open in lightbox"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      </div>

      {/* Bottom Title Bar */}
      <div className="absolute bottom-0 inset-x-0 p-2.5 sm:p-3.5 z-10 text-white pointer-events-none">
        {item.tag && (
          <span className="block text-[9px] sm:text-[10px] font-bold text-[#c7f711] uppercase tracking-wider truncate mb-0.5">
            {item.tag}
          </span>
        )}
        <h4 className="font-bold text-xs sm:text-sm text-white leading-tight group-hover:text-[#c7f711] transition-colors truncate drop-shadow-sm">
          {item.title}
        </h4>
      </div>
    </div>
  );
}

// =========================================================================
// Component: Full Gallery Card (Used when complete gallery is expanded)
// =========================================================================
function FullGalleryCard({
  item,
  isMuted,
  isPlaying,
  onTogglePlay,
  onOpen,
}: {
  item: GalleryItem;
  isMuted: boolean;
  isPlaying: boolean;
  onTogglePlay: (e: React.MouseEvent) => void;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const heightClass =
    item.aspect === "tall"
      ? "h-[260px] sm:h-[340px] lg:h-[380px]"
      : item.aspect === "square"
      ? "h-[220px] sm:h-[250px] lg:h-[270px]"
      : "h-[190px] sm:h-[220px] lg:h-[240px]";

  return (
    <article
      id={`card-${item.id}`}
      onClick={onOpen}
      className={`group relative w-full ${heightClass} rounded-2xl overflow-hidden bg-neutral-900 border border-white/20 shadow-md hover:shadow-2xl hover:border-[#00A852] transition-all duration-300 cursor-pointer focus-within:ring-2 focus-within:ring-[#c7f711]`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open gallery item: ${item.title}`}
        className="absolute inset-0 z-[5] w-full h-full cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none"
      />

      {item.type === "video" && item.videoSrc && !videoFailed ? (
        <div className="relative w-full h-full overflow-hidden bg-black pointer-events-none">
          <video
            ref={videoRef}
            src={item.videoSrc}
            poster={item.src}
            autoPlay={isPlaying}
            loop
            muted={isMuted}
            playsInline
            onError={() => setVideoFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden bg-neutral-800 pointer-events-none">
          <SafeImage
            src={item.src}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Top Right Quick Action Buttons */}
      <div className="absolute top-3 right-3 sm:top-3.5 sm:right-3.5 z-20 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
        {item.type === "video" && (
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
            className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
            title={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 text-[#c7f711]" />}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          aria-label={`Expand ${item.title}`}
          className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all flex items-center justify-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7f711]"
          title="Expand View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Content Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 z-10 text-white pointer-events-none">
        {item.tag && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#c7f711] mb-1">
            {item.tag}
          </span>
        )}
        <h3 className="font-extrabold text-sm sm:text-base text-white leading-snug group-hover:text-[#c7f711] transition-colors drop-shadow-sm">
          {item.title}
        </h3>
        {item.caption && (
          <p className="text-[11px] sm:text-xs text-white/85 mt-1 line-clamp-2 leading-snug">
            {item.caption}
          </p>
        )}
      </div>
    </article>
  );
}
