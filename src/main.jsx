import React, { useEffect, Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { RecoilRoot } from "recoil";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { config } from "./common/wagmi";
import Wrapper from "./Wrapper";

// Scroll to top on route change
function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}

// Loading fallback for lazy-loaded pages
function PageLoader() {
    return (
        <div className="min-h-screen bg-ink-950 flex items-center justify-center">
            <div className="flex items-center gap-3 text-ink-400">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Loading...</span>
            </div>
        </div>
    );
}

import "@rainbow-me/rainbowkit/styles.css";
import "./styles/tailwind.css";
import "./styles/globals.css";

// Home page loads synchronously for fastest initial render
import HomePage from "./pages/index";

// Non-critical pages are lazy-loaded (code splitting)
const NFTPage = lazy(() => import("./pages/nft"));
const MintPage = lazy(() => import("./pages/mint"));
const GalleryPage = lazy(() => import("./pages/gallery"));
const ActivityPage = lazy(() => import("./pages/activity"));
const ProfilePage = lazy(() => import("./pages/profile"));
const BridgePage = lazy(() => import("./pages/bridge"));
const NotFoundPage = lazy(() => import("./pages/404"));

const queryClient = new QueryClient();

function App() {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: "#22d3ee",
                        accentColorForeground: "#0a0a0a",
                        borderRadius: "medium",
                    })}
                >
                    <RecoilRoot>
                        <ScrollToTop />
                        <Wrapper>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    <Route path="/" element={<HomePage />} />
                                    <Route path="/nft" element={<NFTPage />} />
                                    <Route path="/mint" element={<MintPage />} />
                                    <Route path="/gallery" element={<GalleryPage />} />
                                    <Route path="/activity" element={<ActivityPage />} />
                                    <Route path="/profile" element={<ProfilePage />} />
                                    <Route path="/bridge" element={<BridgePage />} />
                                    <Route path="*" element={<NotFoundPage />} />
                                </Routes>
                            </Suspense>
                        </Wrapper>
                    </RecoilRoot>
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
