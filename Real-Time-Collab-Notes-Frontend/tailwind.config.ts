import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        notion: {
          canvas: "#ffffff",
          sidebar: "#f7f6f3",
          ink: "#37352f",
          muted: "rgba(55, 53, 47, 0.65)",
          light: "rgba(55, 53, 47, 0.45)",
          border: "rgba(55, 53, 47, 0.09)",
          hover: "rgba(55, 53, 47, 0.08)",
          active: "rgba(55, 53, 47, 0.12)",
          callout: "#f7f7f5",
          blue: "#2383e2",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
