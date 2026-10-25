import React from "react";
import { Link } from "react-router-dom";
import { Cross, Linkedin, Youtube, Facebook, Instagram } from "lucide-react";

const SOCIALS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/ihops-technologies-limited/",
    Icon: Linkedin,
  },
  {
    label: "YouTube",
    href: "https://youtube.com/@ihopsng?si=JZegX0VrfLSjvnPf",
    Icon: Youtube,
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1CNjxGnPHG/",
    Icon: Facebook,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/ihopsng?mdxt=MWc0M2o2cTR0Y3Z4MQ==",
    Icon: Instagram,
  },
];

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
          <div className="flex items-center gap-3 mt-5">
            {SOCIALS.map(({ label, href, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`IHOPS on ${label}`}
                title={label}
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-brand-mint transition"
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
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
