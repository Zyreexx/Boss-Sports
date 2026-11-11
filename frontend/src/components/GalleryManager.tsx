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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-xl font-bold text-neutral-900">Arena Gallery Publisher</h2>
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {userRole} Access
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            Easily replace photos or playing videos with 1 click, upload files from your device, or add new court media.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/#gallery"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-xs font-bold text-neutral-700 transition"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Live Gallery</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </a>

          <button
            type="button"
            onClick={fetchGallery}
            disabled={loading}
            className="p-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition"
            title="Refresh Gallery"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d1a2c] text-white hover:bg-[#1a2d47] text-xs font-bold transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#c7f711]" />
            <span>{showAddForm ? "Close Form" : "Add Photo / Video"}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {msg && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between border ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : "bg-rose-50 text-rose-900 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {msg.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{msg.text}</span>
          </div>
          <button type="button" onClick={() => setMsg(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add Media Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddItem}
          className="bg-gradient-to-br from-neutral-50 to-white p-6 rounded-2xl border-2 border-blue-400/40 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3"
        >
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Publish New Gallery Card</span>
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setType("image")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  type === "image"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Action Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setType("video")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                  type === "video"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                }`}
              >
                <Video className="w-3.5 h-3.5 text-[#c7f711]" />
                <span>Playing Video Clip</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Title / Moment Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Crosscourt Kitchen Dink"
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Card Aspect Layout
              </label>
              <select
                value={aspect}
                onChange={(e) => setAspect(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tall">Tall Portrait (Hero Shot)</option>
                <option value="square">Square Tile</option>
                <option value="standard">Standard Landscape</option>
              </select>
            </div>

            {/* Media Source & Upload */}
            <div className="md:col-span-3 bg-white p-4 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-neutral-800 uppercase flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>Choose Media (Upload from Device or Paste URL)</span>
                </label>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? "Uploading..." : "Upload File"}</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleUploadFile(e, "new")}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 block mb-1">Image / Poster URL:</span>
                <input
                  type="text"
                  value={src}
                  onChange={(e) => setSrc(e.target.value)}
                  placeholder="/images/hero-player.jpg or https://..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {type === "video" && (
                <div>
                  <span className="text-[10px] text-neutral-500 block mb-1">Video MP4 URL:</span>
                  <input
                    type="text"
                    value={videoSrc}
                    onChange={(e) => setVideoSrc(e.target.value)}
                    placeholder="/uploads/arena-clip.mp4 or https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Description (Optional)
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={2}
                placeholder="Third shot drop rally on Court 1."
                className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Publishing..." : "Publish to Arena Gallery"}
            </button>
          </div>
        </form>
      )}

      {/* Gallery Cards Grid (Clean, NO TAGS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative bg-white rounded-none border border-neutral-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col justify-between"
          >
            {/* Visual Thumbnail (No Tags, No Round Edges) */}
            <div className="relative h-48 w-full bg-neutral-900 overflow-hidden rounded-none">
              <Image
                src={item.src}
                alt={item.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-500"
              />

              {item.type === "video" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-4 h-4 text-[#c7f711] fill-[#c7f711] ml-0.5" />
                  </div>
                </div>
              )}

              {/* Quick Change Media Pill Button */}
              <button
                type="button"
                onClick={() => handleOpenQuickChange(item)}
                className="absolute top-2.5 right-2.5 z-10 px-2.5 py-1 rounded-full bg-black/70 hover:bg-black text-white text-[10px] font-bold backdrop-blur-md transition-all flex items-center gap-1 shadow-md opacity-90 group-hover:opacity-100"
              >
                <Upload className="w-3 h-3 text-[#c7f711]" />
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

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-neutral-100">
                <span className="text-[10px] text-neutral-400 font-mono">
                  {item.type === "video" ? "Video Clip" : "Photo"}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenQuickChange(item)}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition flex items-center gap-1"
                    title="Change image or video"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(item)}
                    className="p-1.5 rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition"
                    title="Edit Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item)}
                    className="p-1.5 rounded-lg border border-neutral-200 text-neutral-400 hover:text-rose-600 hover:border-rose-200 transition"
                    title="Delete Card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* QUICK CHANGE MEDIA MODAL (Instant Photo/Video Switcher) */}
      {quickMediaItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="font-bold text-sm text-neutral-900">
                  Change Image or Video
                </h3>
                <p className="text-[11px] text-neutral-500">
                  Updating: <span className="font-semibold text-neutral-800">{quickMediaItem.title}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickMediaItem(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Media Type Switcher */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQuickType("image")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  quickType === "image"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>Make It a Photo</span>
              </button>
              <button
                type="button"
                onClick={() => setQuickType("video")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  quickType === "video"
                    ? "bg-[#0d1a2c] text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                <Video className="w-4 h-4 text-[#c7f711]" />
                <span>Make It a Video</span>
              </button>
            </div>

            {/* File Upload Button */}
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-neutral-900 block">
                  Upload From Your Device
                </span>
                <span className="text-[11px] text-neutral-500">
                  Select any photo or MP4 video from your computer or phone
                </span>
              </div>
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploading ? "Uploading..." : "Browse File"}</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => handleUploadFile(e, "quick")}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {/* URL Inputs */}
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Photo / Poster URL
                </label>
                <input
                  type="text"
                  value={quickSrc}
                  onChange={(e) => setQuickSrc(e.target.value)}
                  placeholder="/images/... or https://..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {quickType === "video" && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Video Stream MP4 URL
                  </label>
                  <input
                    type="text"
                    value={quickVideoSrc}
                    onChange={(e) => setQuickVideoSrc(e.target.value)}
                    placeholder="/uploads/arena-clip.mp4 or https://..."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              )}
            </div>

            {/* 1-Click Preset Selection */}
            <div>
              <span className="text-[10px] uppercase font-bold text-neutral-400 block mb-2">
                Or Pick From Arena Assets (1-Click):
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_ASSETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuickSrc(preset.src);
                      if (preset.videoSrc) {
                        setQuickType("video");
                        setQuickVideoSrc(preset.videoSrc);
                      } else {
                        setQuickType("image");
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] border transition flex items-center justify-between ${
                      quickSrc === preset.src
                        ? "bg-blue-50 border-blue-400 text-blue-900 font-bold"
                        : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <span className="truncate">{preset.label}</span>
                    {quickSrc === preset.src && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => setQuickMediaItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuickChange}
                disabled={isSubmitting || !quickSrc}
                className="px-5 py-2.5 rounded-xl bg-[#00A852] hover:bg-[#008f45] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? "Applying..." : "Apply & Save to Live Gallery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <h3 className="font-bold text-sm text-neutral-900">
                Edit Card: {editingItem.title}
              </h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Media Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="image">Action Photo</option>
                    <option value="video">Playing Video Clip</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Card Aspect Layout
                  </label>
                  <select
                    value={editAspect}
                    onChange={(e) => setEditAspect(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="tall">Tall Portrait</option>
                    <option value="square">Square Tile</option>
                    <option value="standard">Standard Landscape</option>
                  </select>
                </div>
              </div>

              {/* Upload or URL */}
              <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-neutral-700 uppercase">
                    Photo / Poster URL
                  </span>
                  <label className="cursor-pointer text-xs font-bold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Upload New</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => handleUploadFile(e, "edit")}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={editSrc}
                  onChange={(e) => setEditSrc(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {editType === "video" && (
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                    Video Stream MP4 URL
                  </label>
                  <input
                    type="text"
                    value={editVideoSrc}
                    onChange={(e) => setEditVideoSrc(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Caption (Optional)
                </label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
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
