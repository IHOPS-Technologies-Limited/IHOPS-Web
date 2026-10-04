import React from "react";
import { Link } from "react-router-dom";
import { Cross } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-brand-forest text-white/60">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-14 grid md:grid-cols-4 gap-10">
        <div>
          <div className="flex items-center gap-2 text-white mb-3">
            <span className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <Cross size={16} />
            </span>
            <span className="font-display font-extrabold text-lg">IHOPS</span>
          </div>
          <p className="text-sm leading-relaxed">
            Intelligent Hospital Operation System (IHOPS) <br></br>Smarter
            Hospital Operations. <br></br>Better Patient Care.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-3">Company</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/about" className="hover:text-brand-mint">
                About
              </Link>
            </li>
            <li>
              <Link to="/services" className="hover:text-brand-mint">
                Services
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-brand-mint">
                Pricing
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-brand-mint">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-brand-mint">
                Privacy Policy
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-3">Account</div>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/signup" className="hover:text-brand-mint">
                Register your hospital
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-brand-mint">
                Sign in
              </Link>
            </li>
            <li>
              <Link to="/internal/login" className="hover:text-brand-mint">
                IHOPS staff console
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="text-sm font-semibold text-white mb-3">
            Built for Nigeria
          </div>
          <p className="text-sm leading-relaxed">
            Naira-first billing, WhatsApp/SMS reminders, and workflows for
            hospitals, clinics, dental, veterinary, and diagnostic centres.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-6 text-center text-xs text-white/30">
        © {new Date().getFullYear()} IHOPS. All rights reserved.
      </div>
    </footer>
  );
}
