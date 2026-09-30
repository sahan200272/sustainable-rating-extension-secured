import { createContext, useContext } from "react";

// Kept apart from the provider so Vite fast refresh works on UserManagementProvider.jsx.
export const UserManagementContext = createContext(null);

export function useUserManagement() {
    const ctx = useContext(UserManagementContext);
    if (!ctx) throw new Error("useUserManagement must be used inside UserManagementProvider");
    return ctx;
}
