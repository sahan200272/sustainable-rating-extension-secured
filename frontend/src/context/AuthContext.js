import { createContext } from "react";

// Kept apart from the provider so Vite fast refresh works on AuthProvider.jsx.
export const AuthContext = createContext(null);
