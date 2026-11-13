"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Plus,
  Video,
  Camera,
  Trash2,
  Edit2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Play,
  Eye,
  X,
  Upload,
  Film,
  Check,
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
  createdAt?: string;
}

const PRESET_ASSETS: Array<{ label: string; type: "image" | "video"; src: string; videoSrc?: string }> = [
  { label: "Pro Carbon Paddles", type: "image", src: "/images/gallery-grid-full.jpg" },
  { label: "Court Singles Rally", type: "image", src: "/images/gallery-reference-1.jpg" },
  { label: "Paddle Grip & Net", type: "image", src: "/images/gallery-reference-2.jpg" },
  { label: "High Smash Rally", type: "image", src: "/images/gallery-action-scroll.jpg" },
  { label: "Kitchen Dink Action", type: "image", src: "/images/hero-player.jpg" },
  { label: "Arena Stadium Lights", type: "image", src: "/images/court-wide.jpg" },
];

function SafeGalleryImage({
  src,
  alt,
  fill = false,
  className = "",
  fallbackSrc = "/images/bullpadel-dark.jpg",
}: {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  fallbackSrc?: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    if (
      !src ||
      src.includes("1794565470-296fa30a.jpg") ||
      src.includes("AABkmLeciCopvNRvdpJiq0IIsVnL3iu388iQQEa7EgeQZ32ne2_")
    ) {
      setCurrentSrc(fallbackSrc);
      setErrorCount(1);
    } else {
      setCurrentSrc(src);
      setErrorCount(0);
    }
  }, [src, fallbackSrc]);

  const handleError = () => {
    if (errorCount === 0 && fallbackSrc && currentSrc !== fallbackSrc) {
      setErrorCount(1);
      setCurrentSrc(fallbackSrc);
    } else {
      setErrorCount(2);
    }
  };

  if (errorCount >= 2) {
    return (
      <div className="w-full h-full min-h-[160px] bg-neutral-900 flex flex-col items-center justify-center p-4 text-center">
        <Camera className="w-8 h-8 text-white/30 mb-2" />
        <span className="text-[11px] text-white/50 line-clamp-1">{alt}</span>
        <span className="text-[10px] text-amber-400/80 mt-1">Image unavailable</span>
      </div>
    );
  }

  return (
    <Image
      src={currentSrc}
      alt={alt}
      fill={fill}
      className={className}
      onError={handleError}
    />
  );
}

export default function GalleryManager({
  userRole = "STAFF",
}: {
  userRole?: string;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Quick Change Media Modal
  const [quickMediaItem, setQuickMediaItem] = useState<GalleryItem | null>(null);
  const [quickType, setQuickType] = useState<"image" | "video">("image");
  const [quickSrc, setQuickSrc] = useState("");
  const [quickVideoSrc, setQuickVideoSrc] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Item State
  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState<"image" | "video">("image");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"matchplay" | "gear" | "training" | "tournament">("matchplay");
  const [src, setSrc] = useState("/images/hero-player.jpg");
  const [videoSrc, setVideoSrc] = useState("");
  const [aspect, setAspect] = useState<"tall" | "square" | "standard">("tall");
  const [caption, setCaption] = useState("");
  const [duration, setDuration] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Full Edit Modal State
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<"image" | "video">("image");
  const [editCategory, setEditCategory] = useState<"matchplay" | "gear" | "training" | "tournament">("matchplay");
  const [editSrc, setEditSrc] = useState("");
  const [editVideoSrc, setEditVideoSrc] = useState("");
  const [editAspect, setEditAspect] = useState<"tall" | "square" | "standard">("tall");
  const [editCaption, setEditCaption] = useState("");
  const [editDuration, setEditDuration] = useState("");

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gallery", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMsg({ type: "error", text: data.error || "Failed to load gallery items from database" });
        return;
      }
      if (Array.isArray(data.items)) {
        setItems(data.items);
      }
    } catch (err: any) {
      console.error(err);
      setMsg({ type: "error", text: "Failed to load gallery items from database" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGallery();
  }, []);

  useEffect(() => {
    if (!quickMediaItem && !editingItem) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setQuickMediaItem(null);
        setEditingItem(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [quickMediaItem, editingItem]);

  // Upload a file to /api/upload
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, target: "quick" | "new" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Upload failed");
      }

      const uploadedUrl = data.url;
      const isVideo = file.type.startsWith("video");

      if (target === "quick") {
        if (isVideo) {
          setQuickType("video");
          setQuickVideoSrc(uploadedUrl);
        } else {
          setQuickSrc(uploadedUrl);
        }
      } else if (target === "new") {
        if (isVideo) {
          setType("video");
          setVideoSrc(uploadedUrl);
        } else {
          setSrc(uploadedUrl);
        }
      } else if (target === "edit") {
        if (isVideo) {
          setEditType("video");
          setEditVideoSrc(uploadedUrl);
        } else {
          setEditSrc(uploadedUrl);
        }
      }

      setMsg({ type: "success", text: `File "${file.name}" uploaded successfully!` });
    } catch (err: any) {
      setMsg({ type: "error", text: err.message || "Failed to upload file" });
    } finally {
      setUploading(false);
      // Reset input so user can pick same file again if desired
      if (e.target) e.target.value = "";
    }
  };

  // Open Quick Change Modal
  const handleOpenQuickChange = (item: GalleryItem) => {
    setQuickMediaItem(item);
    setQuickType(item.type);
    setQuickSrc(item.src);
    setQuickVideoSrc(item.videoSrc || "");
  };

  // Save Quick Change Media
  const handleSaveQuickChange = async () => {
    if (!quickMediaItem) return;
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: quickMediaItem.id,
          type: quickType,
          src: quickSrc,
          videoSrc: quickType === "video" ? quickVideoSrc : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update media");
      }

      setMsg({ type: "success", text: `Media updated for "${quickMediaItem.title}"!` });
      setQuickMediaItem(null);
      await fetchGallery();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add Item
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title || "Court Action",
          category,
          tag: "",
          src,
          videoSrc: type === "video" ? videoSrc : undefined,
          aspect,
          caption,
          duration: type === "video" ? duration : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to add gallery item");
      }

      setMsg({ type: "success", text: `"${title || "Card"}" published to live gallery!` });
      setTitle("");
      setCaption("");
      setShowAddForm(false);
      await fetchGallery();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Full Edit Modal
  const handleOpenEdit = (item: GalleryItem) => {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditType(item.type);
    setEditCategory(item.category);
    setEditSrc(item.src);
    setEditVideoSrc(item.videoSrc || "");
    setEditAspect(item.aspect);
    setEditCaption(item.caption || "");
    setEditDuration(item.duration || "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingItem.id,
          title: editTitle,
          type: editType,
          category: editCategory,
          tag: "",
          src: editSrc,
          videoSrc: editType === "video" ? editVideoSrc : undefined,
          aspect: editAspect,
          caption: editCaption,
          duration: editType === "video" ? editDuration : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update item");
      }

      setMsg({ type: "success", text: `Gallery card "${editTitle}" updated successfully!` });
      setEditingItem(null);
      await fetchGallery();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: GalleryItem) => {
    if (!confirm(`Are you sure you want to remove "${item.title}" from the live gallery?`)) {
      return;
    }
    setMsg(null);
    try {
      const res = await fetch(`/api/gallery?id=${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete item");
      }

      setMsg({ type: "success", text: `"${item.title}" removed from gallery.` });
      await fetchGallery();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
            <h2 className="text-xl font-bold text-neutral-900">Arena Gallery Publisher</h2>
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
              {userRole} Access
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Easily replace photos or playing videos with 1 click, upload files from your device, or add new court media.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/#gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 min-h-[42px] rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-bold text-neutral-700 transition"
          >
            <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>View Live Gallery</span>
            <ExternalLink className="w-3 h-3 text-neutral-400 shrink-0" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={fetchGallery}
            disabled={loading}
            aria-label="Refresh gallery"
            className="p-2.5 min-w-[42px] min-h-[42px] inline-flex items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition"
            title="Refresh Gallery"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] rounded-xl bg-[#0d1a2c] text-white hover:bg-[#1a2d47] text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#c7f711] shrink-0" aria-hidden="true" />
            <span>{showAddForm ? "Close Form" : "Add Photo / Video"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex flex-wrap items-center justify-between gap-2 border ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {msg.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
            )}
            <span>{msg.text}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="text-xs hover:underline min-h-[34px] px-1 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Add Media Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="bg-gradient-to-br from-neutral-50 to-white p-4 sm:p-6 rounded-2xl border-2 border-blue-400/40 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-200 pb-3">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
              <span>Publish New Gallery Card</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={type === "image"}
                onClick={() => setType("image")}
                className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  type === "image"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                <Camera className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Action Photo</span>
              </button>
              <button
                type="button"
                aria-pressed={type === "video"}
                onClick={() => setType("video")}
                className={`px-3 py-2 min-h-[40px] rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  type === "video"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                <Video className="w-3.5 h-3.5 text-[#c7f711] shrink-0" aria-hidden="true" />
                <span>Playing Video Clip</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="add-gallery-title" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Title / Moment Name
              </label>
              <input
                id="add-gallery-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Crosscourt Kitchen Dink"
                className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="add-gallery-aspect" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Card Aspect Layout
              </label>
              <select
                id="add-gallery-aspect"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as any)}
                className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 bg-white rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tall">Tall Portrait (Hero Shot)</option>
                <option value="square">Square Tile</option>
                <option value="standard">Standard Landscape</option>
              </select>
            </div>

            {/* Media Source & Upload */}
            <div className="sm:col-span-2 md:col-span-3 bg-white p-4 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-neutral-800 uppercase flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />
                  <span>Choose Media (Upload from Device or Paste URL)</span>
                </span>
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition focus-within:ring-2 focus-within:ring-blue-600 self-start sm:self-auto">
                  <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{uploading ? "Uploading..." : "Upload File"}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleUploadFile(e, "new")}
                    className="sr-only"
                    disabled={uploading}
                  />
                </label>
              </div>

              <div>
                <label htmlFor="add-gallery-src" className="text-[11px] font-semibold text-neutral-600 block mb-1">
                  Image / Poster URL:
                </label>
                <input
                  id="add-gallery-src"
                  type="text"
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  placeholder="/images/hero-player.jpg or https://..."
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {type === "video" && (
                <div>
                  <label htmlFor="add-gallery-video" className="text-[11px] font-semibold text-neutral-600 block mb-1">
                    Video MP4 URL:
                  </label>
                  <input
                    id="add-gallery-video"
                    type="text"
                    value={videoSrc}
                    onChange={(e) => setVideoSrc(e.target.value)}
                    placeholder="/uploads/arena-clip.mp4 or https://..."
                    className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label htmlFor="add-gallery-caption" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Description (Optional)
              </label>
              <textarea
                id="add-gallery-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Third shot drop rally on Court 1."
                className="w-full px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Publishing..." : "Publish to Arena Gallery"}
            </button>
          </div>
        </form>
      )}

      {/* Gallery Cards Grid (Clean, NO TAGS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative bg-white rounded-none border border-neutral-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
          >
            {/* Visual Thumbnail (No Tags, No Round Edges) */}
            <div className="relative h-48 w-full bg-neutral-900 overflow-hidden rounded-none">
              <SafeGalleryImage
                src={item.src}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                fallbackSrc={
                  item.category === "gear" || item.title.toLowerCase().includes("paddle")
                    ? "/images/bullpadel-dark.jpg"
                    : "/images/hero-player.jpg"
                }
              />

              {item.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 text-[#c7f711] fill-[#c7f711] ml-0.5" aria-hidden="true" />
                  </div>
                </div>
              )}

              {/* Quick Change Media Pill Button */}
              <button
                type="button"
                onClick={() => handleOpenQuickChange(item)}
                className="absolute top-2.5 right-2.5 z-10 px-3 py-1.5 min-h-[32px] rounded-full bg-black/75 hover:bg-black text-white text-[10px] font-bold backdrop-blur-md transition-all flex items-center gap-1 shadow-md opacity-95 group-hover:opacity-100"
              >
                <Upload className="w-3 h-3 text-[#c7f711]" aria-hidden="true" />
                <span>Change Media</span>
              </button>
            </div>

            {/* Meta & Actions */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-xs text-neutral-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h4>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1 leading-relaxed">
                  {item.caption || "Action shot"}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 mt-3 border-t border-neutral-100">
                <span className="text-[10px] text-neutral-500 font-mono">
                  {item.type === "video" ? "Video Clip" : "Photo"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickChange(item)}
                    className="px-2.5 py-1.5 min-h-[36px] rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1"
                    title="Change image or video"
                  >
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    aria-label={`Edit details for ${item.title}`}
                    className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition"
                    title="Edit Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item)}
                    aria-label={`Delete ${item.title}`}
                    className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-rose-600 hover:border-rose-200 transition"
                    title="Delete Card"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK CHANGE MEDIA MODAL (Instant Photo/Video Switcher) */}
      {quickMediaItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-media-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-2 border-b border-neutral-100 pb-3">
              <div className="min-w-0">
                <h3 id="quick-media-modal-title" className="font-bold text-sm text-neutral-900">
                  Change Image or Video
                </h3>
                <p className="text-[11px] text-neutral-500 truncate">
                  Updating: <span className="font-semibold text-neutral-800">{quickMediaItem.title}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickMediaItem(null)}
                aria-label="Close change media dialog"
                className="p-2 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Media Type Switcher */}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                aria-pressed={quickType === "image"}
                onClick={() => setQuickType("image")}
                className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  quickType === "image"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Make It a Photo</span>
              </button>
              <button
                type="button"
                aria-pressed={quickType === "video"}
                onClick={() => setQuickType("video")}
                className={`flex-1 py-2.5 px-3 min-h-[44px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  quickType === "video"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <Video className="w-4 h-4 text-[#c7f711] shrink-0" aria-hidden="true" />
                <span>Make It a Video</span>
              </button>
            </div>

            {/* File Upload Button */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-xs font-bold text-neutral-900 block">
                  Upload From Your Device
                </span>
                <span className="text-[11px] text-neutral-500">
                  Select any photo or MP4 video from your computer or phone
                </span>
              </div>
              <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition focus-within:ring-2 focus-within:ring-blue-400 shrink-0">
                <Upload className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{uploading ? "Uploading..." : "Browse File"}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => handleUploadFile(e, "quick")}
                  className="sr-only"
                  disabled={uploading}
                />
              </label>
            </div>

            {/* URL Inputs */}
            <div className="space-y-3">
              <div>
                <label htmlFor="quick-media-src" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Photo / Poster URL
                </label>
                <input
                  id="quick-media-src"
                  type="text"
                  value={quickSrc}
                  onChange={(e) => setQuickSrc(e.target.value)}
                  placeholder="/images/... or https://..."
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {quickType === "video" && (
                <div>
                  <label htmlFor="quick-media-video" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Video Stream MP4 URL
                  </label>
                  <input
                    id="quick-media-video"
                    type="text"
                    value={quickVideoSrc}
                    onChange={(e) => setQuickVideoSrc(e.target.value)}
                    placeholder="/uploads/arena-clip.mp4 or https://..."
                    className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* 1-Click Preset Selection */}
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-500 block mb-2">
                Or Pick From Arena Assets (1-Click):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRESET_ASSETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={quickSrc === preset.src}
                    onClick={() => {
                      setQuickSrc(preset.src);
                      if (preset.videoSrc) {
                        setQuickType("video");
                        setQuickVideoSrc(preset.videoSrc);
                      } else {
                        setQuickType("image");
                      }
                    }}
                    className={`px-3 py-2 min-h-[40px] rounded-lg text-left text-xs sm:text-[11px] border transition flex items-center justify-between gap-2 ${
                      quickSrc === preset.src
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-bold"
                        : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="truncate">{preset.label}</span>
                    {quickSrc === preset.src && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setQuickMediaItem(null)}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickChange}
                disabled={isSubmitting || !quickSrc}
                className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl bg-[#00A852] hover:bg-[#008f45] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? "Applying..." : "Apply & Save to Live Gallery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT MODAL */}
      {editingItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="full-edit-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <h3 id="full-edit-modal-title" className="font-bold text-sm text-neutral-900 truncate">
                Edit Card: {editingItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                aria-label="Close edit card dialog"
                className="p-2 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label htmlFor="edit-gallery-title" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Title
                </label>
                <input
                  id="edit-gallery-title"
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-gallery-type" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Media Type
                  </label>
                  <select
                    id="edit-gallery-type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 bg-white rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="image">Action Photo</option>
                    <option value="video">Playing Video Clip</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-gallery-aspect" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Card Aspect Layout
                  </label>
                  <select
                    id="edit-gallery-aspect"
                    value={editAspect}
                    onChange={(e) => setEditAspect(e.target.value as any)}
                    className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 bg-white rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tall">Tall Portrait</option>
                    <option value="square">Square Tile</option>
                    <option value="standard">Standard Landscape</option>
                  </select>
                </div>
              </div>

              {/* Upload or URL */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="edit-gallery-src" className="text-[11px] font-bold text-neutral-700 uppercase">
                    Photo / Poster URL
                  </label>
                  <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 min-h-[32px] px-2 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
                    <Upload className="w-3 h-3" aria-hidden="true" />
                    <span>Upload New</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => handleUploadFile(e, "edit")}
                      className="sr-only"
                    />
                  </label>
                </div>
                <input
                  id="edit-gallery-src"
                  type="text"
                  value={editSrc}
                  onChange={(e) => setEditSrc(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {editType === "video" && (
                <div>
                  <label htmlFor="edit-gallery-video" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Video Stream MP4 URL
                  </label>
                  <input
                    id="edit-gallery-video"
                    type="text"
                    value={editVideoSrc}
                    onChange={(e) => setEditVideoSrc(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label htmlFor="edit-gallery-caption" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Caption (Optional)
                </label>
                <textarea
                  id="edit-gallery-caption"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
