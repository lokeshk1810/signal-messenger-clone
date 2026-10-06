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
        canvas: "#121212",
        sidebar: "#1E1E1E",
        borderDark: "#2A2A2A",
        signalBlue: "#2C6BED",
        incomingBubble: "#262626",
        iconMuted: "#868686",
        iconActive: "#FFFFFF",
      },
    },
  },
  plugins: [],
};
export default config;
