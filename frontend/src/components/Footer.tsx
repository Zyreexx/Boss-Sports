"use client";

import React from "react";
import Image from "next/image";
import { MapPin, Phone, Clock } from "lucide-react";

interface FooterProps {
  activeSport?: "pickleball";
}

export default function Footer({ activeSport = "pickleball" }: FooterProps = {}) {
  const isPickleball = true;

  return (
    <footer id="contact" className="border-t border-neutral-200 bg-white pt-14 pb-12 px-6 sm:px-10 lg:px-12 text-neutral-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-neutral-100">
        
        {/* Brand with Official Logo */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white p-0.5 border-2 border-[#00E073] shadow-sm">
              <Image
                src="/images/boss-logo.jpg"
                alt="Boss Pickleball"
                width={36}
                height={36}
                className="object-contain w-full h-full rounded-full"
              />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-neutral-950 block">
                Boss Pickleball
              </span>
              <span className="text-[10px] tracking-widest uppercase text-[#00A852] font-black block">
                Official Venue • Courts 1, 2, and 3
              </span>
            </div>
          </div>

          <p className="text-xs text-neutral-600 max-w-sm leading-relaxed">
            A modern sports club experience built for players of every level.
            Direct court booking at fair venue rates (₹400/hr) with zero middleman commissions.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-950 mb-3">
            Navigation
          </h4>
          <ul className="space-y-2 text-xs text-neutral-600 font-medium">
            <li>
              <a href="#gallery" className="hover:text-[#00A852] transition">
                Action Gallery
              </a>
            </li>
            <li>
              <a href="#booking-section" className="hover:text-[#00A852] transition">
                Courts & Slots (₹400/hr)
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-[#00A852] transition">
                Pricing & Memberships
              </a>
            </li>
            <li>
              <a href="#amenities" className="hover:text-[#00A852] transition">
                Amenities & Standards
              </a>
            </li>
          </ul>
        </div>

        {/* Staff & Management */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-950 mb-3">
            Staff Portal
          </h4>
          <ul className="space-y-2 text-xs text-neutral-600 font-medium">
            <li>
              <a href="#staff-desk" className="hover:text-[#00A852] transition">
                Desk Quick Booking
              </a>
            </li>
            <li>
              <a href="#owner-admin" className="hover:text-[#00A852] transition">
                Owner Administration
              </a>
            </li>
            <li>
              <span className="text-[11px] text-neutral-400 block pt-1">
                Synchronized Calendar Core
              </span>
            </li>
          </ul>
        </div>

        {/* Contact info */}
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-neutral-950 mb-3">
            Reception
          </h4>
          <ul className="space-y-2.5 text-xs text-neutral-700">
            <li className="flex items-start gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#00A852] shrink-0 mt-0.5" />
              <span>Boss Pickleball, Gondal</span>
            </li>
            <li className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#00A852] shrink-0" />
              <span>+91 98765 43210</span>
            </li>
            <li className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#00A852] shrink-0" />
              <span>Daily: 5:30 AM – 10:30 PM</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-neutral-500 gap-3">
        <p>© 2026 Boss Pickleball. All rights reserved.</p>
        <p className="flex items-center gap-3">
          <span className="text-[#00A852] font-extrabold">₹400 / hr Direct Venue Rate</span>
          <span>•</span>
          <span>Courts 1, 2, and 3</span>
        </p>
      </div>
    </footer>
  );
}
