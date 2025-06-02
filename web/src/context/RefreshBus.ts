let callback: (() => void) | null = null;

export const registerRefreshCallback = (cb: () => void) => {
    callback = cb;
};
export const triggerRefresh = () => {
    if (!callback) {
        console.warn("triggerRefresh called but no callback registered!");
    } else {
        callback();
    }
};

