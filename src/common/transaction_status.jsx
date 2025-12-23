import { atom, useRecoilState } from "recoil";
import { formatError } from "./error";
import { publicClient } from "./provider";

const transactionCountState = atom({
    key: "transactionCount",
    default: 0,
});

const transactionStatusState = atom({
    key: "transactionStatus",
    default: {},
});

const transactionListenersState = atom({
    key: "transactionListeners",
    default: [],
});

// Transaction status schema:
/*
{
    status: 'pending' | 'approved' | 'success' | 'error',
    name: string,
    content [optional]: any,
    url [optional]: string,
    hash: string,
    errorMessage [only if status == 'error']: string
}
*/
// Pending = not approved yet
// Approved = Approved, not inserted yet

const useTransactionStatus = () => {
    const [transactionsStatus, setTransactionsStatus] = useRecoilState(
        transactionStatusState,
    );

    const [transactionListeners, setTransactionListeners] = useRecoilState(
        transactionListenersState,
    );

    const register = (listener) => {
        setTransactionListeners((transactionListeners) => {
            if (transactionListeners.includes(listener)) {
                return transactionListeners;
            }
            return [...transactionListeners, listener];
        });
    };

    const updateTransactionStatus = async (transactionId, status) => {
        setTransactionsStatus((currentTransactionStatus) => ({
            ...currentTransactionStatus,
            [transactionId]: status,
        }));

        for (const listener of transactionListeners) {
            listener(transactionId, status);
        }
    };

    const getTransactionStatus = (transactionId) => {
        return transactionsStatus[transactionId];
    };

    const getTransactions = () => {
        return transactionsStatus;
    };

    return {
        getTransactionStatus,
        transactions: transactionsStatus,
        updateTransactionStatus,
        register,
    };
};

const useTransactionHelper = () => {
    const { updateTransactionStatus } = useTransactionStatus();
    const [transactionCount, setTransactionCount] = useRecoilState(
        transactionCountState,
    );

    const newId = () => {
        setTransactionCount((transactionCount) => transactionCount + 1);
        return transactionCount;
    };

    // handleTransaction now expects a function that returns a transaction hash (viem pattern)
    const handleTransaction = async (
        transactionFunction,
        transactionName,
        contentFunction,
        rethrow,
    ) => {
        const transactionId = newId();
        let hash;
        try {
            updateTransactionStatus(transactionId, {
                status: "pending",
                name: transactionName,
                content: contentFunction
                    ? await contentFunction("pending")
                    : null,
            });

            // transactionFunction should return a hash (from writeContract)
            hash = await transactionFunction();

            updateTransactionStatus(transactionId, {
                status: "approved",
                name: transactionName,
                hash,
                content: contentFunction
                    ? await contentFunction("approved", { hash })
                    : null,
            });

            // Wait for transaction receipt using viem's publicClient
            const receipt = await publicClient.waitForTransactionReceipt({
                hash,
                confirmations: 1,
            });

            updateTransactionStatus(transactionId, {
                status: "success",
                name: transactionName,
                hash,
                content: contentFunction
                    ? await contentFunction("success", { hash }, true, receipt)
                    : null,
            });

            return {
                hash,
                receipt,
                success: true,
            };
        } catch (e) {
            updateTransactionStatus(transactionId, {
                status: "error",
                name: transactionName,
                hash,
                errorMessage: formatError(e),
                content: contentFunction
                    ? await contentFunction("success", { hash }, false)
                    : null,
            });

            if (rethrow) {
                throw e;
            }

            return {
                error: e,
                success: false,
            };
        }
    };
    return handleTransaction;
};

export { useTransactionStatus, useTransactionHelper };
