const typeConfig = {
    "text/plain": {
        label: "TXT",
        bg: "bg-type-plain/10",
        border: "border-type-plain/30",
        text: "text-type-plain",
        icon: "¶",
    },
    "text/markdown": {
        label: "MD",
        bg: "bg-type-markdown/10",
        border: "border-type-markdown/30",
        text: "text-type-markdown",
        icon: "#",
    },
    "text/html": {
        label: "HTML",
        bg: "bg-type-html/10",
        border: "border-type-html/30",
        text: "text-type-html",
        icon: "<>",
    },
};

export default function TypeTag({ type, isUri }) {
    if (!type) {
        return null;
    }

    if (isUri) {
        type = type.split(",")[0].split(":")[1];
    }

    const config = typeConfig[type];

    if (!config) {
        return (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono bg-red-500/10 border-red-500/30 text-red-400 border">
                <span className="opacity-60">?</span>
                unknown
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${config.bg} ${config.border} ${config.text} border`}
        >
            <span className="opacity-60">{config.icon}</span>
            {config.label}
        </span>
    );
}
