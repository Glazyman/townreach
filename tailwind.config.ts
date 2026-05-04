import type { Config } from "tailwindcss";

/** CivicPulse-inspired tokens (stitch_civic_contact_portal / civicpulse_design_system) */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#f7f9fb",
        "surface-dim": "#d8dadc",
        "surface-bright": "#f7f9fb",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f4f6",
        "surface-container": "#eceef0",
        "surface-container-high": "#e6e8ea",
        "surface-container-highest": "#e0e3e5",
        "surface-variant": "#e0e3e5",
        brand: "#070235",
        "on-surface": "#191c1e",
        "on-surface-variant": "#47464f",
        outline: "#787680",
        "outline-variant": "#c8c5d0",
        /** Sapphire — primary actions (buttons, links, focus) */
        primary: "#0266ff",
        "primary-container": "#0050cc",
        "primary-fixed": "#e3dfff",
        "on-primary-fixed": "#181445",
        secondary: "#0050cc",
        "secondary-container": "#0266ff",
        "on-primary": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem"
      },
      boxShadow: {
        soft: "0 4px 20px rgba(30, 27, 75, 0.04)",
        glass: "0 8px 30px rgba(30, 27, 75, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
