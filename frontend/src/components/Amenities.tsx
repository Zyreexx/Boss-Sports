"use client";

import React from "react";
import {
  Trophy,
  Shield,
  Zap,
  Users,
  Layers,
  Sparkles,
} from "lucide-react";

interface AmenitiesProps {
  activeSport?: "pickleball";
}

export default function Amenities({ activeSport }: AmenitiesProps = {}) {
  const pickleballFeatures = [
    {
      icon: <Layers className="w-5 h-5 text-[#00A852]" />,
      title: "Tournament-Grade Cushion Turf",
      desc: "USAPA approved multi-layer acrylic surface engineered to reduce joint fatigue and optimize true ball bounce across all 3 courts.",
    },
    {
      icon: <Zap className="w-5 h-5 text-[#00A852]" />,
      title: "Anti-Glare Pro Floodlights",
      desc: "Daylight-balanced 500+ lux overhead stadium fixtures for shadowless evening and night play.",
    },
    {
      icon: <Shield className="w-5 h-5 text-[#00A852]" />,
      title: "Zero Double-Booking Guarantee",
      desc: "Synchronized single source of truth calendar connecting phone, counter, and online reservations with 10-minute hold lock.",
    },
    {
      icon: <Users className="w-5 h-5 text-[#00A852]" />,
      title: "Complimentary Pro Paddles",
      desc: "Official tournament-spec carbon-fiber paddles and optic balls provided completely complimentary with every court booking.",
    },
  ];

  const features = pickleballFeatures;

  return (
    <section id="amenities" className="py-20 px-6 sm:px-10 lg:px-12 bg-white text-neutral-900 border-t border-neutral-200">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-[#00A852]">
              Facility & Standards
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-neutral-950 tracking-tight mt-2">
              Engineered For Pure Performance
            </h2>
          </div>
          <p className="text-neutral-600 text-sm max-w-md mt-4 md:mt-0 font-normal">
            Every court and training zone is calibrated for athlete comfort, speed, and safety.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-[#F8FCF9] border-2 border-neutral-200/80 hover:border-[#00E073] hover:shadow-lg transition-all duration-200 group"
            >
              <div className="w-11 h-11 rounded-xl bg-[#E6F8EE] flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                {item.icon}
              </div>
              <h3 className="font-extrabold text-base text-neutral-950 mb-2">{item.title}</h3>
              <p className="text-xs text-neutral-600 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
