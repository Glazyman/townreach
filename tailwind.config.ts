import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#faf9fe",
        "surface-container": "#eeedf3",
        "surface-container-low": "#f4f3f8",
        "surface-container-lowest": "#ffffff",
        primary: "#0058bc",
        "primary-container": "#0070eb",
        secondary: "#4c4aca",
        "on-surface": "#1a1b1f",
        "on-surface-variant": "#414755",
        outline: "#717786",
        "outline-variant": "#c1c6d7",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        soft: "0 8px 30px rgb(0 0 0 / 0.04)",
        glass: "0 20px 60px rgb(15 23 42 / 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
