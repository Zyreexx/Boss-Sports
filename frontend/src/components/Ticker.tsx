"use client";

import React from "react";
import { Zap } from "lucide-react";

interface TickerProps {
  activeSport?: "pickleball";
}

export default function Ticker({ activeSport }: TickerProps = {}) {
  const items = [
    "DIRECT VENUE BOOKINGS • ₹400/HR",
    "ZERO THIRD-PARTY SURCHARGES",
    "3 TOURNAMENT GRADE CUSHIONED COURTS",
    "COMPLIMENTARY PRO PADDLES & TOURNAMENT BALLS",
    "INSTANT ATOMIC 10-MIN SLOT HOLDS",
    "PRO 500-LUX FLOODLIGHTS & LOCKERS",
    "DESK PHONE ASSISTANCE AVAILABLE",
  ];

  return (
    <div className="relative w-full overflow-hidden py-3.5 bg-[#00E073] text-black font-black border-y-2 border-black/10 select-none shadow-sm">
      <div className="flex w-max animate-marquee space-x-12">
        {[...items, ...items, ...items].map((text, idx) => (
          <div key={idx} className="flex items-center space-x-3 text-xs sm:text-sm font-black tracking-widest uppercase">
            <Zap className="w-3.5 h-3.5 fill-black text-black" />
            <span className="text-black">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
