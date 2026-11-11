"use client";

import React, { useState, useRef, useEffect } from "react";
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
  Sparkles,
  Layers,
  Video,
  Camera,
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
  // Column 1
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
    title: "Official Pro Carbon Paddles",
    category: "gear",
    tag: "Pro Gear",
    src: "/images/gallery-grid-full.jpg",
    aspect: "square",
    caption: "Carbon fiber paddles and court balls available for players at reception.",
  },

  // Column 2
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

  // Column 3
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

  // Column 4
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
  const [playingMap, setPlayingMap] = useState<Record<string, boolean>>({});
  const [modalVideoFailed, setModalVideoFailed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const hasVideos = galleryItems.some((item) => item.type === "video" && item.videoSrc);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    fetch("/api/gallery", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.items) && data.items.length > 0) {
          setGalleryItems(data.items);
        }
      })
      .catch((err) => console.error("Error fetching live gallery:", err));
  }, []);

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

  const filteredItems = galleryItems.filter((item) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "video") return item.type === "video";
    if (activeFilter === "image") return item.type === "image";
    if (activeFilter === "gear") return item.category === "gear";
    return true;
  });

  const toggleVideoPlayback = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlayingMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

  const col1 = filteredItems.filter((_, idx) => idx % 4 === 0);
  const col2 = filteredItems.filter((_, idx) => idx % 4 === 1);
  const col3 = filteredItems.filter((_, idx) => idx % 4 === 2);
  const col4 = filteredItems.filter((_, idx) => idx % 4 === 3);

  return (
    <section
      id="gallery"
      className="relative w-full py-14 sm:py-20 lg:py-24 px-4 sm:px-8 lg:px-12 bg-gradient-to-b from-[#bcd4ea] via-[#cce0f2] to-[#bcd4ea] text-neutral-900 overflow-hidden"
    >
      {/* Background Court Atmosphere Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay">
        <div className="w-full h-full bg-[radial-gradient(#00A852_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-[1360px] mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-5 sm:gap-6 mb-8 sm:mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-white/60 shadow-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00A852] animate-pulse shrink-0" />
              <span className="text-[11px] font-bold text-neutral-800 tracking-wider uppercase">
                Live Action &amp; Arena Highlights
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight leading-[1.12]">
              Experience Boss Pickleball In Motion
            </h2>
            <p className="text-xs sm:text-sm text-neutral-800 max-w-xl mt-2 leading-relaxed">
              Explore court highlights, player matchplay, and equipment available at Boss Pickleball Gondal.
            </p>
          </div>

          {/* Interactive Controls & Filters */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <div role="group" aria-label="Filter gallery items" className="flex flex-wrap items-center gap-1 p-1.5 rounded-2xl sm:rounded-full bg-white/85 backdrop-blur-md border border-white/70 shadow-sm max-w-full">
              <button
                type="button"
                aria-pressed={activeFilter === "all"}
                onClick={() => setActiveFilter("all")}
                className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold transition-all ${activeFilter === "all"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-800 hover:text-black hover:bg-black/5"
                  }`}
              >
                All
              </button>
              {hasVideos && (
                <button
                  type="button"
                  aria-pressed={activeFilter === "video"}
                  onClick={() => setActiveFilter("video")}
                  className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${activeFilter === "video"
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
                className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${activeFilter === "image"
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
                className={`px-3.5 py-1.5 min-h-[38px] rounded-full text-xs font-bold transition-all ${activeFilter === "gear"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-800 hover:text-black hover:bg-black/5"
                  }`}
              >
                Gear &amp; Courts
              </button>
            </div>

            {hasVideos && (
              <button
                type="button"
                aria-pressed={!isMuted}
                aria-label={isMuted ? "Unmute gallery videos" : "Mute gallery videos"}
                onClick={() => setIsMuted(!isMuted)}
                className="px-3.5 py-2 min-h-[44px] rounded-full bg-white/90 border border-white/70 shadow-sm text-neutral-900 hover:bg-white transition-all flex items-center gap-1.5 text-xs font-bold"
                title={isMuted ? "Unmute all videos" : "Mute all videos"}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-neutral-600" />
                    <span>Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-[#00A852]" />
                    <span>Sound On</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Responsive Gallery Mosaic (1 col phone -> 2 cols sm/tablet -> 4 cols desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {/* Column 1 */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col1.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? !prefersReducedMotion}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col2.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? !prefersReducedMotion}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col3.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? !prefersReducedMotion}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-4 sm:gap-5">
            {col4.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? !prefersReducedMotion}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Expanded Fullscreen Lightbox Modal */}
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
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeModalItem.type === "video" && activeModalItem.videoSrc && !modalVideoFailed && (
                  <button
                    type="button"
                    onClick={() => setIsMuted(!isMuted)}
                    className="min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center"
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
                  className="min-w-[40px] min-h-[40px] p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center"
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
                <div className="relative w-full h-full">
                  <Image
                    src={activeModalItem.src}
                    alt={activeModalItem.title}
                    fill
                    className="object-contain"
                  />
                </div>
              )}

              {/* Prev / Next Arrows positioned above bottom video controls */}
              <button
                type="button"
                onClick={handlePrevModal}
                aria-label="Previous gallery item"
                className="absolute left-2 sm:left-4 top-[42%] -translate-y-1/2 min-w-[40px] min-h-[40px] p-2 sm:p-3 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/25 transition-all flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextModal}
                aria-label="Next gallery item"
                className="absolute right-2 sm:right-4 top-[42%] -translate-y-1/2 min-w-[40px] min-h-[40px] p-2 sm:p-3 rounded-full bg-black/65 hover:bg-black/90 text-white border border-white/25 transition-all flex items-center justify-center"
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
                className="px-5 py-2.5 min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-xs tracking-tight transition-all text-center shrink-0"
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

// Individual Gallery Card Component
function GalleryCard({
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

  React.useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => { });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const heightClass =
    item.aspect === "tall"
      ? "h-[260px] sm:h-[360px] lg:h-[420px]"
      : item.aspect === "square"
        ? "h-[230px] sm:h-[260px] lg:h-[280px]"
        : "h-[210px] sm:h-[240px] lg:h-[260px]";

  const handleCardClick = () => {
    onOpen();
  };

  return (
    <article
      id={`card-${item.id}`}
      className={`group relative w-full ${heightClass} rounded-none overflow-hidden bg-neutral-900 border-2 border-white/80 shadow-md hover:shadow-2xl hover:border-[#00A852] transition-all duration-300`}
    >
      <button
        type="button"
        onClick={handleCardClick}
        aria-label={`Open gallery item: ${item.title}`}
        className="absolute inset-0 z-[5] w-full h-full cursor-pointer bg-transparent border-0 p-0 focus-visible:outline-none"
      />
      {/* Video or Image Element */}
      {item.type === "video" && item.videoSrc && !videoFailed ? (
        <div className="relative w-full h-full overflow-hidden bg-black rounded-none pointer-events-none">
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
          {/* Permanent dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden bg-neutral-800 rounded-none pointer-events-none">
          <Image
            src={item.src}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {/* Permanent dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Top Right Quick Action Buttons */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-1.5 opacity-95 group-hover:opacity-100 transition-opacity">
        {item.type === "video" && (
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? `Pause ${item.title}` : `Play ${item.title}`}
            className="min-w-[38px] min-h-[38px] p-2 rounded-full bg-black/70 hover:bg-black/95 text-white backdrop-blur-md transition-all flex items-center justify-center"
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
          className="min-w-[38px] min-h-[38px] p-2 rounded-full bg-black/70 hover:bg-black/95 text-white backdrop-blur-md transition-all flex items-center justify-center"
          title="Expand View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Permanent Bottom Content Bar */}
      <div className="absolute bottom-0 inset-x-0 p-4 sm:p-5 z-10 text-white pointer-events-none">
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
