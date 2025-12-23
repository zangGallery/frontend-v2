import config from "../config";
import { useEns } from "../common/ens";
import { shortenAddress } from "../common/utils";

export default function Address({ address, shorten, nChar, disableLink }) {
    const { lookupEns } = useEns();
    const displayText =
        lookupEns(address) ||
        (shorten ? shortenAddress(address, nChar) : address);

    return (
        <span className="font-mono text-ink-300">
            {!disableLink ? (
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={config.blockExplorer.url + "/address/" + address}
                    className="hover:text-accent-cyan transition-colors underline decoration-ink-600 hover:decoration-accent-cyan"
                >
                    {displayText}
                </a>
            ) : (
                displayText
            )}
        </span>
    );
}
