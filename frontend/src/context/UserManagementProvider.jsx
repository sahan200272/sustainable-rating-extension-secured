import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
    adminCreateUser,
    adminDeleteUser,
    adminGetAllUsers,
    adminToggleBlockUser,
    adminUpdateUserRole,
} from "../services/userService";
import { UserManagementContext } from "./UserManagementContext";

export function UserManagementProvider({ children }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [sortField, setSortField] = useState("createdAt");
    const [sortDir, setSortDir] = useState("desc");

    // Modal state
    const [viewUser, setViewUser] = useState(null);
    const [editUser, setEditUser] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null); // single email or "bulk"
    const [showAddModal, setShowAddModal] = useState(false);

    const debounceTimer = useRef(null);

    // Debounce search input by 300ms
    const handleSearchChange = useCallback((val) => {
        setSearchQuery(val);
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setDebouncedSearch(val);
            setCurrentPage(1);
        }, 300);
    }, []);

    // ── API Calls ──────────────────────────────────────────────────────────

    const fetchUsers = useCallback(async (isRefresh = false) => {
        if (isRefresh) setIsRefreshing(true);
        else setLoading(true);
        try {
            const data = await adminGetAllUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to load users");
        } finally {
            if (isRefresh) setIsRefreshing(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers(false);
    }, [fetchUsers]);

    const toggleBlock = useCallback(async (email) => {
        const toastId = toast.loading("Updating user status...");
        try {
            const { user: updated } = await adminToggleBlockUser(email);
            setUsers((prev) =>
                prev.map((u) => (u.email === email ? { ...u, isBlocked: updated.isBlocked } : u))
            );
            toast.success(
                updated.isBlocked ? "User blocked successfully" : "User unblocked successfully",
                { id: toastId }
            );
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to update status", { id: toastId });
        }
    }, []);

    const deleteUser = useCallback(async (email) => {
        const toastId = toast.loading("Deleting user...");
        try {
            await adminDeleteUser(email);
            setUsers((prev) => prev.filter((u) => u.email !== email));
            setSelectedUsers((prev) => {
                const next = new Set(prev);
                next.delete(email);
                return next;
            });
            toast.success("User deleted successfully", { id: toastId });
            setDeleteTarget(null);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to delete user", { id: toastId });
        }
    }, []);

    const bulkDelete = useCallback(async () => {
        const emails = [...selectedUsers];
        const toastId = toast.loading(`Deleting ${emails.length} users...`);
        const results = await Promise.allSettled(emails.map((e) => adminDeleteUser(e)));
        const deleted = emails.filter((_, i) => results[i].status === "fulfilled");
        const failed = emails.length - deleted.length;
        setUsers((prev) => prev.filter((u) => !deleted.includes(u.email)));
        setSelectedUsers(new Set());
        if (failed === 0) {
            toast.success(`${deleted.length} users deleted`, { id: toastId });
        } else {
            toast.error(`${deleted.length} deleted, ${failed} failed`, { id: toastId });
        }
        setDeleteTarget(null);
    }, [selectedUsers]);

    const bulkBlock = useCallback(async () => {
        const emails = [...selectedUsers];
        const toastId = toast.loading(`Blocking ${emails.length} users...`);
        const results = await Promise.allSettled(emails.map((e) => adminToggleBlockUser(e)));
        let successCount = 0;
        results.forEach((r, i) => {
            if (r.status === "fulfilled") {
                const updated = r.value.user;
                setUsers((prev) =>
                    prev.map((u) => (u.email === emails[i] ? { ...u, isBlocked: updated.isBlocked } : u))
                );
                successCount++;
            }
        });
        toast.success(`${successCount} users updated`, { id: toastId });
        setSelectedUsers(new Set());
    }, [selectedUsers]);

    const updateRole = useCallback(async (email, role) => {
        const toastId = toast.loading("Updating role...");
        try {
            const { user: updated } = await adminUpdateUserRole(email, role);
            setUsers((prev) =>
                prev.map((u) =>
                    u.email === email ? { ...u, role: updated.role } : u
                )
            );
            toast.success(`Role updated to ${role}`, { id: toastId });
            setEditUser(null);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to update role", { id: toastId });
        }
    }, []);

    const createUser = useCallback(async (userData) => {
        const toastId = toast.loading("Creating user...");
        try {
            await adminCreateUser(userData);
            toast.success("User created successfully", { id: toastId });
            setShowAddModal(false);
            await fetchUsers(true);
        } catch (err) {
            toast.error(err?.response?.data?.error || "Failed to create user", { id: toastId });
            throw err;
        }
    }, [fetchUsers]);

    // ── Derived Data ───────────────────────────────────────────────────────

    const filteredUsers = useMemo(() => {
        let result = [...users];

        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            result = result.filter(
                (u) =>
                    `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
                    u.email.toLowerCase().includes(q)
            );
        }

        if (roleFilter !== "all") {
            result = result.filter((u) => u.role === roleFilter);
        }

        if (statusFilter !== "all") {
            result = result.filter((u) =>
                statusFilter === "blocked" ? u.isBlocked : !u.isBlocked
            );
        }

        // Sort
        result.sort((a, b) => {
            let valA = a[sortField] ?? "";
            let valB = b[sortField] ?? "";
            if (sortField === "createdAt") {
                valA = new Date(valA);
                valB = new Date(valB);
            } else if (typeof valA === "string") {
                valA = valA.toLowerCase();
                valB = valB.toLowerCase();
            }
            if (valA < valB) return sortDir === "asc" ? -1 : 1;
            if (valA > valB) return sortDir === "asc" ? 1 : -1;
            return 0;
        });

        return result;
    }, [users, debouncedSearch, roleFilter, statusFilter, sortField, sortDir]);

    const paginatedUsers = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredUsers.slice(start, start + pageSize);
    }, [filteredUsers, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredUsers.length / pageSize);

    // ── Selection helpers ──────────────────────────────────────────────────

    const toggleSelect = useCallback((email) => {
        setSelectedUsers((prev) => {
            const next = new Set(prev);
            next.has(email) ? next.delete(email) : next.add(email);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        const pageEmails = paginatedUsers.map((u) => u.email);
        const allSelected = pageEmails.every((e) => selectedUsers.has(e));
        setSelectedUsers((prev) => {
            const next = new Set(prev);
            if (allSelected) {
                pageEmails.forEach((e) => next.delete(e));
            } else {
                pageEmails.forEach((e) => next.add(e));
            }
            return next;
        });
    }, [paginatedUsers, selectedUsers]);

    const handleSort = useCallback((field) => {
        setSortField((prev) => {
            if (prev === field) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                return prev;
            }
            setSortDir("asc");
            return field;
        });
        setCurrentPage(1);
    }, []);

    // ── CSV Export ─────────────────────────────────────────────────────────

    const exportCSV = useCallback(() => {
        const headers = ["Name", "Email", "Role", "Status", "Phone", "Address", "Created At"];
        const rows = filteredUsers.map((u) => [
            `${u.firstName} ${u.lastName}`,
            u.email,
            u.role,
            u.isBlocked ? "Blocked" : "Active",
            u.phone || "",
            u.address || "",
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "",
        ]);
        const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `users_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("CSV exported successfully");
    }, [filteredUsers]);

    const value = {
        // Data
        users,
        loading,
        isRefreshing,
        filteredUsers,
        paginatedUsers,
        totalPages,
        // Filters / search
        searchQuery,
        debouncedSearch,
        handleSearchChange,
        roleFilter,
        setRoleFilter,
        statusFilter,
        setStatusFilter,
        // Pagination
        currentPage,
        setCurrentPage,
        pageSize,
        setPageSize,
        // Selection
        selectedUsers,
        toggleSelect,
        toggleSelectAll,
        // Sort
        sortField,
        sortDir,
        handleSort,
        // Actions
        fetchUsers,
        toggleBlock,
        deleteUser,
        bulkDelete,
        bulkBlock,
        updateRole,
        createUser,
        exportCSV,
        // Modals
        viewUser,
        setViewUser,
        editUser,
        setEditUser,
        deleteTarget,
        setDeleteTarget,
        showAddModal,
        setShowAddModal,
    };

    return (
        <UserManagementContext.Provider value={value}>
            {children}
        </UserManagementContext.Provider>
    );
}
