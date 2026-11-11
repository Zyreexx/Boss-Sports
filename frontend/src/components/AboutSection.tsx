"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { motion, useInView } from "framer-motion";

interface AboutSectionProps {
  activeSport?: "pickleball";
}

const framerEase = [0.16, 1, 0.3, 1];

// Animated Number Counter component
function Counter({ target, suffix = "" }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = React.useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1500;
    const stepTime = 25;
    const steps = duration / stepTime;
    const increment = target / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [inView, target]);

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  );
}

export default function AboutSection({ activeSport }: AboutSectionProps = {}) {
  const isPickleball = true;

  return (
    <section id="about" className="bg-white text-neutral-900 py-16 sm:py-24 px-6 sm:px-10 lg:px-12 border-t border-neutral-100">
      <div className="max-w-7xl mx-auto">
        
        {/* Top Header Row matching Reference Layout Exactly */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: framerEase }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start mb-14 sm:mb-18"
        >
          {/* Left: About Us Pill Tag in White & Green */}
          <div className="lg:col-span-3">
            <span className="inline-block px-4 py-1.5 rounded-full border-2 border-[#00E073]/40 bg-[#F0FDF4] text-xs font-bold text-neutral-900 tracking-tight">
              About Us
            </span>
          </div>

          {/* Right: Statement matching Reference Exactly */}
          <div className="lg:col-span-9">
            <h2 className="text-2xl sm:text-4xl lg:text-[40px] font-extrabold text-neutral-950 tracking-tight leading-[1.22]">
              {isPickleball ? (
                <>
                  Boss Pickleball is a modern sports and training facility designed to help players{" "}
                  <span className="text-[#00A852]">improve faster</span>, train smarter, and{" "}
                  <span className="text-[#00A852]">stay motivated</span>.
                </>
              ) : (
                <>
                  Boss Fitness is a modern sports and training facility designed to help athletes{" "}
                  <span className="text-[#00A852]">build raw power</span>, train smarter, and{" "}
                  <span className="text-[#00A852]">break limits</span>.
                </>
              )}
            </h2>
          </div>
        </motion.div>

        {/* 3 Visual Grid Cards with Staggered Framer entrance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6 mb-20 sm:mb-24">
          
          {/* Card 1: Deep Court Emerald Green Card with Court Schematic */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.1, ease: framerEase }}
            whileHover={{ y: -6 }}
            className="rounded-[24px] p-7 sm:p-8 bg-[#042817] text-white flex flex-col justify-between min-h-[380px] shadow-lg relative overflow-hidden group cursor-pointer border border-[#00E073]/30"
          >
            <div>
              {/* Clean Outline Court Schematic Icon matching Reference */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-16 h-12 mb-12 opacity-90 group-hover:opacity-100 transition-opacity"
              >
                <svg
                  viewBox="0 0 64 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full stroke-[#00E073] group-hover:stroke-white transition-colors"
                  strokeWidth="1.75"
                >
                  <rect x="2" y="2" width="60" height="44" rx="3" />
                  <line x1="32" y1="2" x2="32" y2="46" />
                  <line x1="16" y1="2" x2="16" y2="46" />
                  <line x1="48" y1="2" x2="48" y2="46" />
                  <line x1="16" y1="24" x2="48" y2="24" />
                </svg>
              </motion.div>

              {/* Title in vibrant green matching Reference */}
              <h3 className="text-xl sm:text-2xl font-black text-[#00E073] mb-3 tracking-tight">
                Dedicated Indoor Courts
              </h3>
              <p className="text-xs sm:text-[13px] text-white/80 leading-relaxed font-normal">
                Regularly maintained pickleball courts with overhead lighting for daily morning and evening play.
              </p>
            </div>

            {/* Bottom Pill: ◉ Game On matching Reference */}
            <div className="pt-8">
              <motion.a
                href="#booking-section"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00E073] text-black text-xs font-black tracking-tight transition-colors shadow-sm"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-black flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                </div>
                <span>Game On • ₹400/hr</span>
              </motion.a>
            </div>
          </motion.div>

          {/* Card 2: Ball in Air / Hand Photo Card with Floating Center Glass Pill */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.22, ease: framerEase }}
            whileHover={{ y: -6 }}
            className="rounded-[24px] overflow-hidden relative min-h-[380px] shadow-md group bg-sky-100 cursor-pointer border border-neutral-200"
          >
            <motion.div
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.6, ease: framerEase }}
              className="relative w-full h-full"
            >
              <Image
                src="/images/ball-hand.jpg"
                alt="Hand throwing neon ball into sky"
                fill
                className="object-cover object-center"
              />
            </motion.div>
            
            {/* Center Floating Frosted Glass Pill */}
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <motion.a
                href="#booking"
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="px-5 py-2.5 rounded-full bg-white/95 hover:bg-white text-neutral-900 font-extrabold text-xs tracking-tight backdrop-blur-md shadow-xl transition-colors border border-[#00E073]/40"
              >
                Open Court Sessions
              </motion.a>
            </div>
          </motion.div>

          {/* Card 3: Team of Athletes on Court Photo Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8, delay: 0.34, ease: framerEase }}
            whileHover={{ y: -6 }}
            className="rounded-[24px] overflow-hidden relative min-h-[380px] shadow-md group bg-emerald-950 cursor-pointer border border-neutral-200"
          >
            <motion.div
              whileHover={{ scale: 1.06 }}
              transition={{ duration: 0.6, ease: framerEase }}
              className="relative w-full h-full"
            >
              <Image
                src="/images/athletes-team.jpg"
                alt="Group of athletes standing on court"
                fill
                className="object-cover object-center"
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Configured Venue Overview */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: framerEase }}
          className="p-8 sm:p-12 rounded-[28px] bg-[#F4FBF6] border-2 border-[#00E073]/30 text-center shadow-sm"
        >
          <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-[#00A852] mb-8">
            Venue At A Glance
          </h4>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12">
            {/* Fact 1 */}
            <div>
              <div className="text-3xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight">
                <Counter target={3} suffix="" />
              </div>
              <p className="text-xs sm:text-[13px] font-bold text-neutral-600 mt-1.5">
                Active Courts
              </p>
            </div>

            {/* Fact 2 */}
            <div>
              <div className="text-3xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight">
                06:00–23:00
              </div>
              <p className="text-xs sm:text-[13px] font-bold text-neutral-600 mt-1.5">
                Daily Hours (IST)
              </p>
            </div>

            {/* Fact 3 */}
            <div>
              <div className="text-3xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight">
                ₹400
              </div>
              <p className="text-xs sm:text-[13px] font-bold text-neutral-600 mt-1.5">
                Standard Rate / Hr
              </p>
            </div>

            {/* Fact 4 */}
            <div>
              <div className="text-3xl sm:text-4xl lg:text-[46px] font-black text-neutral-950 tracking-tight">
                10 min
              </div>
              <p className="text-xs sm:text-[13px] font-bold text-neutral-600 mt-1.5">
                Checkout Slot Hold
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
