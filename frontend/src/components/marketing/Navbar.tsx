import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Cross, Search, Menu, X } from "lucide-react";

const LINKS = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/services", label: "Services" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar({
  variant = "overlay",
}: {
  variant?: "overlay" | "solid";
}) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  const wrapperClass =
    variant === "overlay"
      ? "absolute top-0 left-0 right-0 z-40"
      : "sticky top-0 z-40 bg-brand-forest";

  return (
    <header className={wrapperClass}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-white">
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <Cross size={18} strokeWidth={2.5} />
          </span>
          <span className="font-display font-extrabold text-lg tracking-tight leading-none">
            IHOPS
            <div className="text-[10px] font-body font-normal text-white/60 leading-none mt-0.5">
              Hospital Operations
            </div>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/80">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`hover:text-white ${pathname === l.to ? "text-white" : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
            <Search size={16} />
          </button>
          <Link
            to="/login"
            className="text-sm font-medium text-white/80 hover:text-white"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="bg-brand-mint hover:bg-brand-mint-dark text-brand-forest text-sm font-semibold rounded-full px-5 py-2.5 transition"
          >
            Book a Demo
          </Link>
        </div>

        <button
          className="md:hidden text-white"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-brand-forest-light px-4 py-4 space-y-3 mx-4 rounded-2xl mb-2">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="block text-sm font-medium text-white/80"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Link
              to="/login"
              className="flex-1 text-center text-sm font-medium text-white/80 border border-white/20 rounded-full py-2"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="flex-1 text-center text-sm font-semibold bg-brand-mint text-brand-forest rounded-full py-2"
            >
              Register
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
