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
      title: "3 Dedicated Courts",
      desc: "Dedicated indoor pickleball courts (Courts 1, 2, and 3) maintained for consistent everyday play.",
    },
    {
      icon: <Zap className="w-5 h-5 text-[#00A852]" />,
      title: "Overhead Court Lighting",
      desc: "Lit courts supporting morning through late-evening sessions daily from 06:00 to 23:00 IST.",
    },
    {
      icon: <Shield className="w-5 h-5 text-[#00A852]" />,
      title: "Shared Venue Schedule",
      desc: "Server-checked overlap protection across online bookings, temporary 10-minute checkout holds, and counter reservations.",
    },
    {
      icon: <Users className="w-5 h-5 text-[#00A852]" />,
      title: "Reception Desk Support",
      desc: "Pay on arrival via cash or counter UPI, and manage eligible cancellations at least 2 hours before start time.",
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
