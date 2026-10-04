// Shared explicit dark-mode input styling for the Super Admin portal.
//
// The shared `.input` class (used throughout the tenant app) sets an
// explicit white background with no text color override — fine on the
// tenant app's light pages, but invisible white-on-white when dropped onto
// this portal's dark theme (only legible via the browser's text-selection
// highlight, which is exactly the bug this replaces). Every form field on
// the Super Admin side uses this instead of the shared light-mode class.
export const darkInput =
  "w-full bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40";

export const darkCard = "bg-[#111827] border border-white/10 rounded-xl";

export const amberButton =
  "bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold text-sm rounded-lg px-4 py-2.5 disabled:opacity-50 transition";

export const ghostButton =
  "bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-medium rounded-lg px-4 py-2.5 transition disabled:opacity-50";
