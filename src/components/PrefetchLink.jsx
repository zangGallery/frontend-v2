import { Link } from "react-router-dom";
import { prefetchNFT } from "../common/prefetch";
import { prefetchProfile, prefetchAuthor, prefetchUserHistory } from "../common/prefetch";

/**
 * PrefetchLink - A Link component that automatically prefetches data on hover
 * based on the destination route.
 *
 * Prefetching strategy:
 *
 * WORTH IT:
 * - /profile?address=X → prefetches profile, author, and history
 *   Reason: author endpoint is slow (~500-2000ms), high user intent on profile cards
 *
 * - /nft?id=X → prefetches NFT data
 *   Reason: NFT pages have multiple data requirements, hover intent is high
 *
 * NOT WORTH IT:
 * - /gallery → paginated list with fast API, users often scroll without clicking
 * - /mint → form page, no data to prefetch
 * - / (home) → entry point, data loads on page init anyway
 * - External links → can't prefetch cross-origin
 * - /events → list page, fast API
 */
export default function PrefetchLink({ to, children, ...props }) {
    const handleMouseEnter = () => {
        if (typeof to !== "string") return;

        // Profile pages: /profile?address=0x...
        if (to.startsWith("/profile?address=")) {
            const address = to.split("address=")[1]?.split("&")[0];
            if (address) {
                prefetchProfile(address);
                prefetchAuthor(address);
                prefetchUserHistory(address);
            }
            return;
        }

        // NFT pages: /nft?id=123
        if (to.startsWith("/nft?id=")) {
            const id = to.split("id=")[1]?.split("&")[0];
            if (id) {
                prefetchNFT(id);
            }
            return;
        }

        // Routes where prefetching is NOT worth it:
        // - /gallery: paginated, fast API, low click-through rate from hover
        // - /mint: no data to prefetch (it's a form)
        // - /: home page, entry point
        // - /events: list page, fast API
    };

    return (
        <Link to={to} onMouseEnter={handleMouseEnter} {...props}>
            {children}
        </Link>
    );
}
