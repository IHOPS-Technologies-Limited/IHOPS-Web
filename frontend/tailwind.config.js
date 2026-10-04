/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0E1A19",
        teal: { DEFAULT: "#0B3D3E", 50: "#EAF3F2", 100: "#CFE4E2", 600: "#0B3D3E", 700: "#082C2D", 900: "#051A1B" },
        amber: { DEFAULT: "#E8A33D", 50: "#FDF3E3", 600: "#E8A33D", 700: "#C7862A" },
        alert: { DEFAULT: "#C0453A" },
        canvas: "#F7F8F6",
        // Marketing site palette (Home, About, Services, Contact, Pricing) —
        // additive, does not touch any class already used inside the
        // authenticated app, which keeps its own teal/amber tokens above.
        brand: {
          forest: "#1A312C",
          "forest-light": "#24443C",
          sage: "#428475",
          "sage-dark": "#336758",
          mint: "#89D7B7",
          "mint-dark": "#4FAE87",
          cream: "#FFF4E1",
        },
      },
      fontFamily: {
        display: ["'Manrope'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
