"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Power,
  Edit2,
  Trash2,
  Layers,
  DollarSign,
  ShieldCheck,
  Check,
  X,
  Sparkles,
} from "lucide-react";

export interface CourtItem {
  id: string;
  courtNumber: number;
  name: string;
  surfaceType: string;
  isIndoor: boolean;
  basePricePerHour: number;
  isActive: boolean;
}

export default function CourtManager({
  userRole = "STAFF",
  onCourtChanged,
}: {
  userRole?: string;
  onCourtChanged?: () => void;
}) {
  const isOwner = userRole === "OWNER";
  const [courts, setCourts] = useState<CourtItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // New Court Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCourtName, setNewCourtName] = useState("");
  const [newCourtPrice, setNewCourtPrice] = useState(400);
  const [newCourtIsIndoor, setNewCourtIsIndoor] = useState(true);
  const [newCourtSurface, setNewCourtSurface] = useState("Pickleball Court Surface");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Court Modal
  const [editingCourt, setEditingCourt] = useState<CourtItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(400);
  const [editIsIndoor, setEditIsIndoor] = useState(true);
  const [editSurface, setEditSurface] = useState("");

  const fetchCourts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pickleball/courts?all=true", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setMsg({ type: "error", text: data.error || "Failed to load courts from database" });
        return;
      }
      if (Array.isArray(data.courts)) {
        setCourts(data.courts);
      }
    } catch (err: any) {
      console.error(err);
      setMsg({ type: "error", text: "Failed to load courts from database" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    if (!editingCourt) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingCourt(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingCourt]);

  const handleAddCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/pickleball/courts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCourtName || undefined,
          basePricePerHour: Number(newCourtPrice) || 400,
          isIndoor: newCourtIsIndoor,
          surfaceType: newCourtSurface,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create court");
      }

      setMsg({ type: "success", text: data.message || "Court added successfully!" });
      setNewCourtName("");
      setNewCourtPrice(400);
      setShowAddForm(false);
      await fetchCourts();
      if (onCourtChanged) onCourtChanged();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (court: CourtItem) => {
    setMsg(null);
    try {
      const res = await fetch("/api/pickleball/courts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: court.id,
          isActive: !court.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update court status");
      }

      setMsg({
        type: "success",
        text: `Court "${court.name}" is now ${!court.isActive ? "ACTIVE & Bookable" : "PAUSED (Maintenance)"}.`,
      });
      await fetchCourts();
      if (onCourtChanged) onCourtChanged();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
  };

  const handleOpenEdit = (court: CourtItem) => {
    setEditingCourt(court);
    setEditName(court.name);
    setEditPrice(court.basePricePerHour || 400);
    setEditIsIndoor(court.isIndoor ?? true);
    setEditSurface(court.surfaceType || "Pickleball Court");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourt) return;
    setIsSubmitting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/pickleball/courts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId: editingCourt.id,
          name: editName,
          basePricePerHour: Number(editPrice),
          isIndoor: editIsIndoor,
          surfaceType: editSurface,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update court");
      }

      setMsg({ type: "success", text: `Court "${editName}" updated successfully!` });
      setEditingCourt(null);
      await fetchCourts();
      if (onCourtChanged) onCourtChanged();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourt = async (court: CourtItem) => {
    if (!confirm(`Are you sure you want to remove ${court.name}? If it has past bookings, it will be safely deactivated.`)) {
      return;
    }
    setMsg(null);
    try {
      const res = await fetch(`/api/pickleball/courts?courtId=${court.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete court");
      }

      setMsg({ type: "success", text: data.message || `Court ${court.name} removed.` });
      await fetchCourts();
      if (onCourtChanged) onCourtChanged();
    } catch (err: any) {
      setMsg({ type: "error", text: err.message });
    }
  };

  const nextCourtNum = courts.length > 0 ? Math.max(...courts.map((c) => c.courtNumber || 0)) + 1 : 1;

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00A852] shrink-0" />
            <h2 className="text-xl font-bold text-neutral-900">Arena Court Manager</h2>
            <span className="text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 shrink-0">
              {userRole} Permission
            </span>
          </div>
          <p className="text-xs text-neutral-500">
            {isOwner
              ? "Add new pickleball courts, configure pricing, and toggle booking availability."
              : "Toggle court maintenance availability. Court creation, deletion, and pricing require owner access."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={fetchCourts}
            disabled={loading}
            aria-label="Refresh courts list"
            className="p-2.5 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50 text-neutral-700 transition"
            title="Refresh Courts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!newCourtName) setNewCourtName(`Court ${nextCourtNum}`);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-[#0d1a2c] text-white hover:bg-[#1a2d47] text-xs font-bold transition shadow-sm"
            >
              <Plus className="w-4 h-4 text-[#c7f711] shrink-0" aria-hidden="true" />
              <span>{showAddForm ? "Close Form" : "Add New Court"}</span>
            </button>
          )}
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

      {/* Inline Add Court Form (Owner Only) */}
      {isOwner && showAddForm && (
        <form
          onSubmit={handleAddCourt}
          className="bg-gradient-to-br from-neutral-50 to-white p-4 sm:p-6 rounded-2xl border-2 border-[#00A852]/30 shadow-md space-y-4 animate-in fade-in slide-in-from-top-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-200 pb-3">
            <h3 className="font-bold text-sm text-neutral-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00A852] shrink-0" aria-hidden="true" />
              <span>Create New Court ({newCourtName || `Court ${nextCourtNum}`})</span>
            </h3>
            <span className="text-[11px] text-neutral-500">
              Will immediately be bookable on homepage at ₹{newCourtPrice}/hr
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label htmlFor="add-court-name" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Court Name
              </label>
              <input
                id="add-court-name"
                type="text"
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
                placeholder={`Court ${nextCourtNum}`}
                className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                required
              />
            </div>

            <div>
              <label htmlFor="add-court-price" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Hourly Base Rate (₹)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-xs text-neutral-500 pointer-events-none" aria-hidden="true">₹</span>
                <input
                  id="add-court-price"
                  type="number"
                  value={newCourtPrice}
                  onChange={(e) => setNewCourtPrice(Number(e.target.value))}
                  min={100}
                  step={50}
                  className="w-full min-h-[42px] pl-7 pr-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="add-court-indoor" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Facility Layout
              </label>
              <select
                id="add-court-indoor"
                value={newCourtIsIndoor ? "indoor" : "outdoor"}
                onChange={(e) => setNewCourtIsIndoor(e.target.value === "indoor")}
                className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 bg-white rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
              >
                <option value="indoor">Indoor Court</option>
                <option value="outdoor">Outdoor Court</option>
              </select>
            </div>

            <div>
              <label htmlFor="add-court-surface" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                Surface Type
              </label>
              <input
                id="add-court-surface"
                type="text"
                value={newCourtSurface}
                onChange={(e) => setNewCourtSurface(e.target.value)}
                placeholder="Pickleball Court Surface"
                className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
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
              className="px-5 py-2.5 min-h-[42px] rounded-xl bg-[#00A852] hover:bg-[#008f45] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? "Creating Court..." : "Confirm & Launch Court"}
            </button>
          </div>
        </form>
      )}

      {/* Courts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {courts.map((court) => (
          <div
            key={court.id}
            className={`p-4 sm:p-5 rounded-2xl border transition-all ${
              court.isActive
                ? "bg-white border-neutral-200 shadow-sm hover:shadow-md"
                : "bg-neutral-50 border-neutral-300 opacity-75"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      court.isActive ? "bg-[#00A852]" : "bg-neutral-400"
                    }`}
                  />
                  <h4 className="font-extrabold text-base text-neutral-900 truncate">{court.name}</h4>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                  ID: <span className="font-mono text-neutral-600">{court.id}</span>
                </p>
              </div>

              <span
                className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full shrink-0 ${
                  court.isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-200 text-neutral-700"
                }`}
              >
                {court.isActive ? "Active (Bookable)" : "Paused"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-3 my-2 border-y border-neutral-100">
              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Rate</span>
                <span className="font-extrabold text-neutral-900">₹{court.basePricePerHour}/hr</span>
              </div>
              <div>
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Type</span>
                <span className="font-semibold text-neutral-800">
                  {court.isIndoor ? "Indoor Court" : "Outdoor Court"}
                </span>
              </div>
              <div className="col-span-2 mt-1">
                <span className="text-neutral-500 text-[10px] uppercase font-bold block">Surface</span>
                <span className="text-neutral-700 truncate block">{court.surfaceType || "Pickleball Court"}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleToggleActive(court)}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg text-xs font-bold transition ${
                  court.isActive
                    ? "bg-neutral-100 text-neutral-700 hover:bg-rose-50 hover:text-rose-700"
                    : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                }`}
              >
                <Power className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{court.isActive ? "Pause Court" : "Activate"}</span>
              </button>

              {isOwner && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(court)}
                    aria-label={`Edit ${court.name}`}
                    className="p-2 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 hover:bg-neutral-100 transition"
                    title="Edit Court"
                  >
                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCourt(court)}
                    aria-label={`Delete ${court.name}`}
                    className="p-2 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:text-rose-600 hover:border-rose-200 transition"
                    title="Delete Court"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Court Modal (Owner Only) */}
      {isOwner && editingCourt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-court-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-neutral-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-3">
              <h3 id="edit-court-modal-title" className="font-bold text-sm text-neutral-900 truncate">
                Edit {editingCourt.name}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCourt(null)}
                aria-label="Close edit court dialog"
                className="p-2 min-w-[38px] min-h-[38px] inline-flex items-center justify-center rounded-lg hover:bg-neutral-100 text-neutral-500 shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label htmlFor="edit-court-name" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Court Name
                </label>
                <input
                  id="edit-court-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-court-price" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Hourly Rate (₹)
                </label>
                <input
                  id="edit-court-price"
                  type="number"
                  value={editPrice}
                  onChange={(e) => setEditPrice(Number(e.target.value))}
                  min={100}
                  step={50}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-court-indoor" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Environment
                </label>
                <select
                  id="edit-court-indoor"
                  value={editIsIndoor ? "indoor" : "outdoor"}
                  onChange={(e) => setEditIsIndoor(e.target.value === "indoor")}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 bg-white rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                >
                  <option value="indoor">Indoor Court</option>
                  <option value="outdoor">Outdoor Court</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-court-surface" className="block text-[11px] font-bold text-neutral-700 uppercase mb-1">
                  Surface Description
                </label>
                <input
                  id="edit-court-surface"
                  type="text"
                  value={editSurface}
                  onChange={(e) => setEditSurface(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2.5 text-base sm:text-xs text-neutral-900 rounded-xl border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-[#00A852]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setEditingCourt(null)}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[42px] rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] rounded-xl bg-[#00A852] hover:bg-[#008f45] text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
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

