"use client";

import Link from "next/link";

export const Footer = () => {
  return (
    <footer className="w-full relative border-t border-white/20">
      <div className="w-full max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <div className="text-white/80 text-sm">
            © 2025 ColdStart. All rights reserved.
          </div>
          
          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Link 
              href="/privacy" 
              className="text-white/80 hover:text-white transition-colors"
            >
              Privacy Policy
            </Link>
            <Link 
              href="/terms" 
              className="text-white/80 hover:text-white transition-colors"
            >
              Terms of Service
            </Link>
            <Link 
              href="/contact" 
              className="text-white/80 hover:text-white transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

