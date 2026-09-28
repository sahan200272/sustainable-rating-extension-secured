// Where to send the user after Google sign-in. Kept in sessionStorage because the
// flow leaves the app (backend -> Google -> backend) before coming back.
const STORAGE_KEY = "oauth_return_to";

// Only used to resolve paths, never navigated to
const BASE_URL = "http://greeny.invalid";

// Returns a same-site path like "/products/1?tab=reviews", or null
export function toSafeReturnTo(value) {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
        return null;
    }

    try {
        // Normalise it the way the browser would: "\" becomes "/", tabs/newlines are dropped,
        // and "/.." is resolved, so "/\evil.com" or "/..//evil.com" can't slip through
        const url = new URL(value, BASE_URL);
        const path = `${url.pathname}${url.search}${url.hash}`;
        return url.origin === BASE_URL && !path.startsWith("//") ? path : null;
    } catch {
        return null;
    }
}

export function saveReturnTo(value) {
    try {
        const path = toSafeReturnTo(value);
        if (path) {
            sessionStorage.setItem(STORAGE_KEY, path);
        } else {
            sessionStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Storage can be blocked; the user just lands on the default page
    }
}

// One-shot read, checked again in case storage was tampered with
export function takeReturnTo() {
    try {
        const value = sessionStorage.getItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        return toSafeReturnTo(value);
    } catch {
        return null;
    }
}
