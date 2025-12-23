/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
        extend: {
            // Typography-focused color palette (dark-first for text art)
            colors: {
                // Primary: Deep charcoal to pure white spectrum
                ink: {
                    50: "#fafafa",
                    100: "#f4f4f5",
                    200: "#e4e4e7",
                    300: "#d4d4d8",
                    400: "#a1a1aa",
                    500: "#71717a",
                    600: "#52525b",
                    700: "#3f3f46",
                    800: "#27272a",
                    900: "#18181b",
                    950: "#09090b",
                },
                // Accent colors for creative energy
                accent: {
                    cyan: "#06b6d4",
                    magenta: "#d946ef",
                    lime: "#84cc16",
                    amber: "#f59e0b",
                },
                // Type-specific colors (for NFT content types)
                type: {
                    plain: "#3b82f6", // Blue for plaintext
                    markdown: "#8b5cf6", // Purple for markdown
                    html: "#f59e0b", // Amber for HTML
                },
            },
            // Typography scale for text-focused design
            fontFamily: {
                mono: [
                    "JetBrains Mono",
                    "Fira Code",
                    "ui-monospace",
                    "monospace",
                ],
                serif: ["Fraunces", "Georgia", "serif"],
                sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
                display: ["Space Grotesk", "sans-serif"],
            },
            fontSize: {
                "display-lg": [
                    "4.5rem",
                    { lineHeight: "1.1", letterSpacing: "-0.02em" },
                ],
                display: [
                    "3.5rem",
                    { lineHeight: "1.15", letterSpacing: "-0.02em" },
                ],
                "display-sm": [
                    "2.5rem",
                    { lineHeight: "1.2", letterSpacing: "-0.01em" },
                ],
                heading: ["2rem", { lineHeight: "1.25" }],
            },
            // Animation keyframes
            keyframes: {
                shimmer: {
                    "0%, 100%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                },
                float: {
                    "0%, 100%": { transform: "translateY(0)" },
                    "50%": { transform: "translateY(-10px)" },
                },
                "pulse-subtle": {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.7" },
                },
                "fade-up": {
                    "0%": { opacity: "0", transform: "translateY(20px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                typewriter: {
                    from: { width: "0" },
                    to: { width: "100%" },
                },
                blink: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0" },
                },
                "slide-up": {
                    "0%": { transform: "translateY(100%)", opacity: "0" },
                    "100%": { transform: "translateY(0)", opacity: "1" },
                },
                "scale-in": {
                    "0%": { transform: "scale(0.95)", opacity: "0" },
                    "100%": { transform: "scale(1)", opacity: "1" },
                },
            },
            // Animation utilities
            animation: {
                "text-shimmer": "shimmer 3s ease-in-out infinite",
                float: "float 6s ease-in-out infinite",
                "pulse-subtle": "pulse-subtle 4s ease-in-out infinite",
                "fade-up": "fade-up 0.6s ease-out forwards",
                "fade-in": "fade-in 0.4s ease-out forwards",
                typewriter: "typewriter 2s steps(40) forwards",
                "cursor-blink": "blink 1s step-end infinite",
                "slide-up": "slide-up 0.5s ease-out forwards",
                "scale-in": "scale-in 0.3s ease-out forwards",
            },
            // Extended spacing
            spacing: {
                18: "4.5rem",
                22: "5.5rem",
                30: "7.5rem",
            },
            // Background size for gradient animations
            backgroundSize: {
                "200%": "200% 200%",
            },
            // Backdrop blur extensions
            backdropBlur: {
                xs: "2px",
            },
        },
    },
    plugins: [
        require("@tailwindcss/typography"),
        require("@tailwindcss/forms"),
    ],
};
