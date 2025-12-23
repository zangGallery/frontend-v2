import React, { useEffect } from "react";
import { useTransactionStatus } from "../common/transaction_status";
import { Toaster, toast } from "sonner";
import ViewOnExplorer from "./ViewOnExplorer";

export default function TransactionNotifications() {
    const { register } = useTransactionStatus();

    const onTransaction = (transactionId, status) => {
        const viewOnExplorer = status.hash ? (
            <ViewOnExplorer hash={status.hash} />
        ) : null;

        if (status.status === "pending") {
            toast.loading(status.content || "Waiting for approval...", {
                id: transactionId,
                description: status.name,
            });
        } else if (status.status === "approved") {
            toast.loading(
                status.content || (
                    <div className="space-y-2">
                        <p>Transaction approved, confirming...</p>
                        {viewOnExplorer}
                    </div>
                ),
                {
                    id: transactionId,
                    description: status.name,
                },
            );
        } else if (status.status === "success") {
            toast.success(
                status.content || (
                    <div className="space-y-2">
                        <p>Transaction confirmed!</p>
                        {viewOnExplorer}
                    </div>
                ),
                {
                    id: transactionId,
                    description: status.name,
                    duration: 8000,
                },
            );
        } else if (status.status === "error") {
            toast.error(
                status.content || (
                    <div className="space-y-2">
                        <p>Transaction failed</p>
                        {status.errorMessage && (
                            <p className="text-xs text-ink-400 break-words">
                                {status.errorMessage}
                            </p>
                        )}
                        {viewOnExplorer}
                    </div>
                ),
                {
                    id: transactionId,
                    description: status.name,
                    duration: 10000,
                },
            );
        }
    };

    useEffect(() => {
        register(onTransaction);
    }, []);

    return (
        <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
                style: {
                    background: "#18181b",
                    border: "1px solid #27272a",
                    color: "#fafafa",
                },
                className: "sonner-toast",
            }}
            richColors
            closeButton
        />
    );
}
