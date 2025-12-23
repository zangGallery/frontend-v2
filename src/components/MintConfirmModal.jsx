export default function MintConfirmModal({ isOpen, setIsOpen, onClose }) {
    const closeModal = (confirmed) => {
        setIsOpen(false);
        onClose(confirmed);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={() => closeModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-ink-900 border border-ink-700 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-5 border-b border-ink-800">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20">
                            <svg
                                className="w-5 h-5 text-amber-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                                />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white">
                                Some fields are empty
                            </h3>
                            <p className="text-sm text-ink-400">
                                Are you sure you want to mint anyway?
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-ink-900/50 flex items-center justify-end gap-3">
                    <button
                        className="px-4 py-2 text-ink-300 hover:text-white transition-colors"
                        onClick={() => closeModal(false)}
                    >
                        Cancel
                    </button>
                    <button
                        className="px-4 py-2 bg-white text-ink-950 font-medium rounded-lg hover:bg-ink-100 transition-colors"
                        onClick={() => closeModal(true)}
                    >
                        Mint Anyway
                    </button>
                </div>
            </div>
        </div>
    );
}
