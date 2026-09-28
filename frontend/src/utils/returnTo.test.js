import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveReturnTo, takeReturnTo, toSafeReturnTo } from "./returnTo";

describe("toSafeReturnTo", () => {
    it.each([
        "/",
        "/products/42",
        "/blogs?page=2#top",
        "/admin/dashboard",
    ])("keeps the same-site path %s", (path) => {
        expect(toSafeReturnTo(path)).toBe(path);
    });

    it.each([
        ["protocol-relative URL", "//evil.com"],
        ["backslash variant", "/\\evil.com"],
        ["tab inside the slashes", "/\t/evil.com"],
        ["dot-segment that resolves to //", "/..//evil.com"],
        ["absolute URL", "https://evil.com/login"],
        ["javascript: URL", "javascript:alert(1)"],
        ["path without a leading slash", "evil.com"],
        ["empty string", ""],
        ["non-string", { pathname: "/" }],
        ["missing value", undefined],
    ])("rejects a %s", (_label, value) => {
        expect(toSafeReturnTo(value)).toBeNull();
    });
});

describe("saveReturnTo / takeReturnTo", () => {
    beforeEach(() => {
        const store = new Map();
        vi.stubGlobal("sessionStorage", {
            getItem: (key) => (store.has(key) ? store.get(key) : null),
            setItem: (key, value) => store.set(key, String(value)),
            removeItem: (key) => store.delete(key),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns a saved path once", () => {
        saveReturnTo("/products/42");

        expect(takeReturnTo()).toBe("/products/42");
        expect(takeReturnTo()).toBeNull();
    });

    it("doesn't keep an unsafe path, and clears any earlier one", () => {
        saveReturnTo("/products/42");
        saveReturnTo("//evil.com");

        expect(takeReturnTo()).toBeNull();
    });
});
