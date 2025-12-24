import React, { useEffect } from "react";
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

import "@rainbow-me/rainbowkit/styles.css";
import "./styles/tailwind.css";
import "./styles/globals.css";

// Pages
import HomePage from "./pages/index";
import NFTPage from "./pages/nft";
import MintPage from "./pages/mint";
import CollectionPage from "./pages/collection";
import ActivityPage from "./pages/activity";
import BridgePage from "./pages/bridge";
import NotFoundPage from "./pages/404";

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
                            <Routes>
                                <Route path="/" element={<HomePage />} />
                                <Route path="/nft" element={<NFTPage />} />
                                <Route path="/mint" element={<MintPage />} />
                                <Route path="/collection" element={<CollectionPage />} />
                                <Route path="/activity" element={<ActivityPage />} />
                                <Route path="/bridge" element={<BridgePage />} />
                                <Route path="*" element={<NotFoundPage />} />
                            </Routes>
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
