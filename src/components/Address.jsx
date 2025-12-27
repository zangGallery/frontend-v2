import { useEns } from "../common/ens";
import { useProfiles } from "../common/profiles";
import { shortenAddress } from "../common/utils";
import PrefetchLink from "./PrefetchLink";

export default function Address({ address, shorten, nChar, disableLink }) {
    const { lookupEns } = useEns();
    const { lookupProfile } = useProfiles();

    // Priority: custom profile name > ENS/basename > shortened address
    const profileName = lookupProfile(address);
    const ensName = lookupEns(address);
    const displayText =
        profileName ||
        ensName ||
        (shorten ? shortenAddress(address, nChar) : address);

    // Use mono font only for addresses, not for names
    const fontClass = profileName || ensName ? "font-sans" : "font-mono";

    return (
        <span className={`${fontClass} text-ink-300`}>
            {!disableLink ? (
                <PrefetchLink
                    to={`/profile?address=${address}`}
                    className="hover:text-accent-cyan transition-colors underline decoration-ink-600 hover:decoration-accent-cyan"
                >
                    {displayText}
                </PrefetchLink>
            ) : (
                displayText
            )}
        </span>
    );
}
