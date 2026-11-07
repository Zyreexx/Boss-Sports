"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  activeSport?: "pickleball";
  onSportChange?: (sport: "pickleball") => void;
}

export default function Header({ activeSport = "pickleball", onSportChange }: HeaderProps = {}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isPickleball = true;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 sm:px-10 lg:px-12 ${scrolled
        ? "bg-white/95 backdrop-blur-xl py-3 border-b border-neutral-200 shadow-sm"
        : "bg-white/80 backdrop-blur-md py-4 sm:py-5 border-b border-neutral-100"
        }`}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">

        {/* Left: Brand with Official Circular Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ scale: 1.08, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="relative w-8 h-8 rounded-full overflow-hidden bg-white p-0.5 border-2 border-[#00E073] shadow-sm"
          >
            <Image
              src="/images/boss-logo.jpg"
              alt="Boss Sports"
              width={32}
              height={32}
              className="w-full h-full object-contain rounded-full"
              priority
            />
          </motion.div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tight text-neutral-900 group-hover:text-[#00A852] transition-colors">
              BOSS PICKLEBALL
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#00E073]" />
          </div>
        </Link>

        {/* Center: Clean Nav Links (matching "Home  About  Services  Pricing") */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-neutral-700">
          <motion.a
            whileHover={{ y: -1 }}
            href="#"
            className="text-neutral-950 font-bold transition hover:text-[#00A852]"
          >
            Home
          </motion.a>
          <motion.a
            whileHover={{ y: -1 }}
            href="#gallery"
            className="hover:text-[#00A852] transition"
          >
            Gallery
          </motion.a>
          <motion.a
            whileHover={{ y: -1 }}
            href="#booking-section"
            className="hover:text-[#00A852] transition"
          >
            Services & Courts
          </motion.a>
          <motion.a
            whileHover={{ y: -1 }}
            href="#pricing"
            className="hover:text-[#00A852] transition"
          >
            Pricing (₹400/hr)
          </motion.a>
        </nav>

        {/* Right: Action Pill Button */}
        <div className="flex items-center gap-3">
          {/* Green Pill Button: Contact Us / Book with Framer Spring */}
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            href="#booking-section"
            className="px-5 py-2 rounded-full bg-[#00E073] text-black font-extrabold text-xs tracking-tight hover:bg-[#00c563] transition shadow-md shadow-[#00E073]/25 cursor-pointer"
          >
            Book A Court
          </motion.a>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-full bg-neutral-100 text-neutral-900 border border-neutral-200"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="md:hidden mt-3 p-5 rounded-2xl bg-white border border-neutral-200 shadow-2xl space-y-4"
          >
            <div className="flex flex-col space-y-2.5 text-sm font-semibold text-neutral-800 pt-2 border-t border-neutral-100">
              <a href="#" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#00A852]">
                Home
              </a>
              <a href="#gallery" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#00A852]">
                Action Gallery
              </a>
              <a href="#booking-section" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#00A852]">
                Courts & Slots (₹400/hr)
              </a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1 hover:text-[#00A852]">
                Pricing & Memberships
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
