"use client";

import React from "react";
import Image from "next/image";
import { ArrowDown, Star } from "lucide-react";
import { motion } from "framer-motion";

interface HeroProps {
  activeSport?: "pickleball";
  onSportChange?: (sport: "pickleball") => void;
}

const framerEase = [0.16, 1, 0.3, 1];

export default function Hero({ activeSport = "pickleball", onSportChange }: HeroProps = {}) {
  const isPickleball = true;

  return (
    <section className="relative min-h-[640px] sm:min-h-[720px] lg:min-h-[780px] flex flex-col justify-between pt-28 sm:pt-36 pb-10 px-6 sm:px-10 lg:px-12 overflow-hidden bg-gradient-to-b from-[#FFFFFF] via-[#F4FBF7] to-[#E9F7EF] text-neutral-900">

      {/* Background Court Action Photo blended seamlessly with White & Green Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          initial={{ scale: 1.12, opacity: 0.15 }}
          animate={{ scale: 1, opacity: 0.35 }}
          transition={{ duration: 1.8, ease: framerEase }}
          className="relative w-full h-full"
        >
          <Image
            src="/images/hero-player.jpg"
            alt="Athlete in motion on court"
            fill
            priority
            className="object-cover object-center sm:object-right mix-blend-multiply"
          />
        </motion.div>

        {/* Luminous White & Emerald Light Overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />
        <div className="absolute top-1/4 -left-20 w-[500px] h-[500px] bg-[#00E073]/15 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[450px] h-[450px] bg-[#00E073]/10 rounded-full blur-[140px] pointer-events-none" />
      </div>

      {/* Main Content Area */}
      <div className="relative max-w-7xl mx-auto w-full z-10 my-auto pt-4 sm:pt-6">
        <div className="max-w-2xl">

          {/* Tag matching "• Available For Bookings" */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: framerEase }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#00E073]/40 shadow-sm mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-[#00E073] animate-pulse" />
            <span className="text-[12px] font-bold text-neutral-800 tracking-wide">
              Available For Bookings • 3 Courts Live
            </span>
          </motion.div>

          {/* Masked Line-by-Line Slide-Up Text Reveal in Bold Black & Green */}
          <div className="overflow-hidden mb-1">
            <motion.h1
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.1, ease: framerEase }}
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-neutral-950 leading-[1.06]"
            >
              {isPickleball ? "Train Smarter. Play" : "Lift Heavy. Move"}
            </motion.h1>
          </div>
          <div className="overflow-hidden">
            <motion.h1
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: framerEase }}
              className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.06] text-transparent bg-clip-text bg-gradient-to-r from-neutral-950 via-[#00A852] to-[#00E073]"
            >
              {isPickleball ? "Stronger. Win More." : "Swiftly. Break Limits."}
            </motion.h1>
          </div>

          {/* Subtitle with fade & slide */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.35, ease: framerEase }}
            className="mt-6 text-base sm:text-lg text-neutral-600 max-w-lg leading-relaxed font-normal"
          >
            {isPickleball
              ? "A modern sports club experience built for players of every level — from first timers to competitive athletes. Direct court bookings at fair rates."
              : "High-performance strength training, Olympic rigs, and functional turf built for dedicated athletes."}
          </motion.p>

          {/* Action Row: Green Pill Button + Direct Rate Callout */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: framerEase }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <motion.a
              href="#booking-section"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="px-8 py-4 rounded-full font-black text-xs sm:text-sm tracking-tight bg-[#00E073] text-black hover:bg-neutral-950 hover:text-white transition-all shadow-lg shadow-[#00E073]/30 flex items-center justify-center cursor-pointer"
            >
              {isPickleball ? "Start Your Training" : "Claim Free Trial"}
            </motion.a>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white border border-[#00E073]/40 text-xs text-neutral-800 shadow-sm"
            >
              <span className="text-[#00A852] font-black text-sm">₹400 / hr</span>
              <span className="text-neutral-300">•</span>
              <span className="font-semibold text-neutral-600">Zero Middleman Surcharge</span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Status Bar matching Reference in White & Green Theme */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.6, ease: framerEase }}
        className="relative max-w-7xl mx-auto w-full z-10 pt-6 mt-8 border-t border-neutral-200/80 flex items-center justify-between text-xs text-neutral-700"
      >
        {/* Left: Scroll Down ↓ with hover lift */}
        <motion.a
          href="#gallery"
          whileHover={{ x: 3 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 hover:text-[#00A852] transition font-bold"
        >
          <span>Scroll Down</span>
          <motion.div
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-5 rounded-full border border-neutral-300 flex items-center justify-center transition"
          >
            <ArrowDown className="w-3 h-3 text-[#00A852]" />
          </motion.div>
        </motion.a>

        {/* Right: Truthful court & venue attributes */}
        <div className="flex items-center gap-2 text-xs text-neutral-700 font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#00A852]" />
          <span>3 Pickleball Courts</span>
          <span className="text-neutral-300">•</span>
          <span>Gondal, Gujarat</span>
        </div>
      </motion.div>
    </section>
  );
}
