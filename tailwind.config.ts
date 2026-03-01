import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { 50:"#f0f0f5",100:"#e0e0eb",200:"#c1c1d7",300:"#9292b8",400:"#6b6b96",500:"#4a4a7a",600:"#383866",700:"#2a2a52",800:"#1e1e40",900:"#14142e",950:"#0a0a1a" },
        brand: { 400:"#ff5590",500:"#ff1a6b",600:"#e60050" },
        ok: { 400:"#3cc287",500:"#18a867",700:"#096e41",950:"#030f07" },
        mint: { 50:"#f0fdf4",100:"#dcfce7",200:"#bbf7d0",300:"#86efac",400:"#4ade80",500:"#22c55e",600:"#16a34a",700:"#15803d",800:"#166534",900:"#14532d",950:"#052e16" },
        slate: { 50:"#f8fafc",100:"#f1f5f9",200:"#e2e8f0",300:"#cbd5e1",400:"#94a3b8",500:"#64748b",600:"#475569",700:"#334155",800:"#1e293b",900:"#0f172a",950:"#020617" },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
