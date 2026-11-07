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
    type: "video",
    title: "Championship Kitchen Dink Rally",
    category: "matchplay",
    tag: "",
    src: "/images/hero-player.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "Fast-paced third shot drop and kitchen rally exchanges on Court 1.",
    duration: "0:12",
  },
  {
    id: "gal-2",
    type: "image",
    title: "Official Pro Selkirk Carbon Paddles",
    category: "gear",
    tag: "Pro Gear",
    src: "/images/gallery-grid-full.jpg",
    aspect: "square",
    caption: "Complimentary USAPA tournament-grade carbon fiber paddles provided at reception.",
  },

  // Column 2
  {
    id: "gal-3",
    type: "video",
    title: "Baseline Reset & Crosscourt Angle",
    category: "training",
    tag: "Pro Clinic",
    src: "/images/athletes-team.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "Mastering the defensive baseline reset under intense topspin pressure.",
    duration: "0:10",
  },
  {
    id: "gal-4",
    type: "image",
    title: "Optic Yellow Tournament Ball in Flight",
    category: "matchplay",
    tag: "Matchplay",
    src: "/images/ball-hand.jpg",
    aspect: "standard",
    caption: "High-visibility tournament optic balls engineered for consistent court bounce.",
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
    caption: "Ergonomic moisture-wicking grip designed for maximum control and spin.",
  },
  {
    id: "gal-6",
    type: "video",
    title: "Overhead Smash & Jump Volley",
    category: "tournament",
    tag: "",
    src: "/images/joola-court.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "standard",
    caption: "Agile overhead court coverage and put-away smashes during tournament semi-finals.",
    duration: "0:08",
  },

  // Column 4
  {
    id: "gal-7",
    type: "video",
    title: "Singles Speed & Footwork Coverage",
    category: "matchplay",
    tag: "",
    src: "/images/hero-action.jpg",
    videoSrc: "https://vjs.zencdn.net/v/oceans.mp4",
    aspect: "tall",
    caption: "High-intensity singles rally across the entire 44-foot championship court.",
    duration: "0:15",
  },
  {
    id: "gal-8",
    type: "image",
    title: "Court 2 Stadium Illumination",
    category: "tournament",
    tag: "Arena",
    src: "/images/court-wide.jpg",
    aspect: "standard",
    caption: "500-lux anti-glare overhead LED stadium lighting for evening gameplay.",
  },
];

export default function ArenaGallery() {
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>(GALLERY_ITEMS);
  const [activeFilter, setActiveFilter] = useState<"all" | "video" | "image" | "gear">("all");
  const [activeModalItem, setActiveModalItem] = useState<GalleryItem | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [playingMap, setPlayingMap] = useState<Record<string, boolean>>({
    "gal-1": true,
    "gal-3": true,
    "gal-6": true,
    "gal-7": true,
  });

  useEffect(() => {
    fetch("/api/gallery")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.items) && data.items.length > 0) {
          setGalleryItems(data.items);
        }
      })
      .catch((err) => console.error("Error fetching live gallery:", err));
  }, []);

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
      className="relative w-full py-20 sm:py-24 px-4 sm:px-8 lg:px-12 bg-gradient-to-b from-[#bcd4ea] via-[#cce0f2] to-[#bcd4ea] text-neutral-900 overflow-hidden"
    >
      {/* Background Court Atmosphere Watermark */}
      <div className="absolute inset-0 pointer-events-none opacity-25 mix-blend-overlay">
        <div className="w-full h-full bg-[radial-gradient(#00A852_1px,transparent_1px)] [background-size:24px_24px]" />
      </div>

      <div className="max-w-[1360px] mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-white/60 shadow-sm mb-3">
              <span className="w-2 h-2 rounded-full bg-[#00A852] animate-pulse" />
              <span className="text-[11px] font-bold text-neutral-800 tracking-wider uppercase">
                Live Action &amp; Arena Highlights
              </span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight leading-[1.12]">
              Experience Boss Pickleball In Motion
            </h2>
            <p className="text-xs sm:text-sm text-neutral-700 max-w-xl mt-2 leading-relaxed">
              Explore dynamic court play, live player dinks, high-flying smashes, and tournament-grade pro gear in our official arena gallery.
            </p>
          </div>

          {/* Interactive Controls & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex p-1 rounded-full bg-white/80 backdrop-blur-md border border-white/70 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilter === "all"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-700 hover:text-black"
                  }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("video")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${activeFilter === "video"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-700 hover:text-black"
                  }`}
              >
                <Video className="w-3.5 h-3.5 text-[#c7f711]" />
                <span>Live Videos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("image")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all ${activeFilter === "image"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-700 hover:text-black"
                  }`}
              >
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                <span>Action Photos</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("gear")}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${activeFilter === "gear"
                  ? "bg-[#0d1a2c] text-white shadow-sm"
                  : "text-neutral-700 hover:text-black"
                  }`}
              >
                Gear &amp; Courts
              </button>
            </div>

            {/* Global Audio Toggle */}
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-full bg-white/90 border border-white/70 shadow-sm text-neutral-800 hover:bg-white transition-all flex items-center gap-1.5 text-xs font-bold"
              title={isMuted ? "Unmute all videos" : "Mute all videos"}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-neutral-500" />
                  <span className="hidden sm:inline">Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#00A852]" />
                  <span className="hidden sm:inline">Sound On</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4-Column Mosaic Gallery Grid Matching Reference Images */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Column 1 */}
          <div className="flex flex-col gap-5">
            {col1.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? true}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-5">
            {col2.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? true}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 3 */}
          <div className="flex flex-col gap-5">
            {col3.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? true}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>

          {/* Column 4 */}
          <div className="flex flex-col gap-5">
            {col4.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                isMuted={isMuted}
                isPlaying={playingMap[item.id] ?? true}
                onTogglePlay={(e) => toggleVideoPlayback(item.id, e)}
                onOpen={() => setActiveModalItem(item)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Expanded Fullscreen Lightbox Modal */}
      {activeModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative max-w-4xl w-full bg-[#0d141f] border border-white/15 rounded-3xl overflow-hidden shadow-2xl text-white">
            {/* Top Bar */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {activeModalItem.title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                  title="Toggle Mute"
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#c7f711]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModalItem(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Media Content */}
            <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
              {activeModalItem.type === "video" && activeModalItem.videoSrc ? (
                <video
                  src={activeModalItem.videoSrc}
                  autoPlay
                  loop
                  muted={isMuted}
                  controls
                  playsInline
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

              {/* Prev / Next Arrows */}
              <button
                type="button"
                onClick={handlePrevModal}
                className="absolute left-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNextModal}
                className="absolute right-4 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition-all"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Caption Footer */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0a1019]">
              <p className="text-xs text-white/80 leading-relaxed max-w-xl">
                {activeModalItem.caption}
              </p>
              <a
                href="#booking"
                onClick={() => setActiveModalItem(null)}
                className="px-5 py-2.5 rounded-full bg-[#c7f711] hover:bg-[#b0dc0d] text-black font-extrabold text-xs tracking-tight transition-all text-center"
              >
                Book Court Now • ₹400/hr
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
      ? "h-[360px] sm:h-[420px]"
      : item.aspect === "square"
        ? "h-[240px] sm:h-[280px]"
        : "h-[220px] sm:h-[260px]";

  const handleCardClick = () => {
    onOpen();
  };

  return (
    <div
      id={`card-${item.id}`}
      onClick={handleCardClick}
      className={`group relative w-full ${heightClass} rounded-none overflow-hidden bg-neutral-900 border-2 border-white/80 shadow-md hover:shadow-2xl hover:border-[#00A852] transition-all duration-300 cursor-pointer`}
    >
      {/* Video or Image Element */}
      {item.type === "video" && item.videoSrc ? (
        <div className="relative w-full h-full overflow-hidden bg-black rounded-none">
          <video
            ref={videoRef}
            src={item.videoSrc}
            poster={item.src}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {/* Permanent dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        </div>
      ) : (
        <div className="relative w-full h-full overflow-hidden bg-neutral-800 rounded-none">
          <Image
            src={item.src}
            alt={item.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-700"
          />
          {/* Permanent dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Top Right Quick Action Buttons */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
        {item.type === "video" && (
          <button
            type="button"
            onClick={onTogglePlay}
            className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all"
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
          className="p-2 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all"
          title="Expand View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Permanent Bottom Content Bar */}
      <div className="absolute bottom-0 inset-x-0 p-5 sm:p-6 z-10 text-white transform transition-transform pointer-events-none">
        <h3 className="font-extrabold text-sm sm:text-base leading-snug group-hover:text-[#c7f711] transition-colors drop-shadow-sm">
          {item.title}
        </h3>
        {item.caption && (
          <p className="text-[11px] text-white/75 mt-1 line-clamp-1 leading-relaxed">
            {item.caption}
          </p>
        )}
      </div>
    </div>
  );
}
