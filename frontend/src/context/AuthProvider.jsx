import { useState, useCallback } from "react";
import { AuthContext } from "./AuthContext";

function getStoredUserSafely() {
    const stored = localStorage.getItem("user");
    if (!stored || stored === "undefined" || stored === "null") {
        return null;
    }

    try {
        return JSON.parse(stored);
    } catch {
        // Remove corrupted auth data so the app can recover gracefully.
        localStorage.removeItem("user");
        return null;
    }
}

function getStoredTokenSafely() {
    const storedToken = localStorage.getItem("token");
    if (!storedToken || storedToken === "undefined" || storedToken === "null") {
        return null;
    }

    return storedToken;
}

/**
 * Provides global auth state (user, token, login, logout, isAuthenticated).
 * Reads the initial state from localStorage so the user stays logged in on refresh.
 */
export function AuthProvider({ children }) {
    const [token, setToken] = useState(() => getStoredTokenSafely());
    const [user, setUser] = useState(() => getStoredUserSafely());

    const login = useCallback((userData, authToken) => {
        localStorage.setItem("token", authToken);
        localStorage.setItem("user", JSON.stringify(userData));
        setToken(authToken);
        setUser(userData);
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setToken(null);
        setUser(null);
    }, []);

    const verifyEmail = useCallback(() => {
        setUser(prevUser => {
            if (!prevUser) return prevUser;
            const updatedUser = { ...prevUser, emailVerified: true };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            return updatedUser;
        });
    }, []);

    const isAuthenticated = Boolean(token);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated, verifyEmail }}>
            {children}
        </AuthContext.Provider>
    );
}
