import { FiUserPlus, FiRefreshCw, FiUsers } from "react-icons/fi";
import AdminPageHeader from "../AdminPageHeader";
import { UserManagementProvider } from "../../../context/UserManagementProvider";
import { useUserManagement } from "../../../context/UserManagementContext";
import UserTableFilters from "./UserTableFilters";
import DataTable from "./DataTable";
import BulkActionBar from "./BulkActionBar";
import UserDetailModal from "./UserDetailModal";
import EditUserModal from "./EditUserModal";
import DeleteConfirmModal from "./DeleteConfirmModal";
import AddUserModal from "./AddUserModal";

/**
 * Stats bar at the top of the section.
 */
function UserStats() {
    const { users, loading } = useUserManagement();

    const activeUsers = users.filter((u) => !u.isBlocked).length;
    const adminCount = users.filter((u) => u.role === "Admin").length;
    const blockedCount = users.filter((u) => u.isBlocked).length;

    const stats = [
        {
            label: "Total Users",
            value: users.length,
            color: "bg-slate-800 text-white",
            icon: "👥",
        },
        {
            label: "Active Users",
            value: activeUsers,
            color: "bg-emerald-600 text-white",
            icon: "✅",
        },
        {
            label: "Admins",
            value: adminCount,
            color: "bg-violet-600 text-white",
            icon: "🛡️",
        },
        {
            label: "Blocked",
            value: blockedCount,
            color: "bg-red-500 text-white",
            icon: "🚫",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
                <div
                    key={s.label}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-4 shadow-sm ${s.color}`}
                >
                    <span className="text-2xl">{s.icon}</span>
                    <div>
                        {loading ? (
                            <div className="mb-1 h-6 w-10 animate-pulse rounded bg-white/30" />
                        ) : (
                            <p className="text-2xl font-black">{s.value}</p>
                        )}
                        <p className="text-xs font-semibold opacity-80">{s.label}</p>
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * Inner content — needs to be inside the Provider to use the context.
 */
function UserManagementContent() {
    const { setShowAddModal, fetchUsers, loading, isRefreshing, selectedUsers } = useUserManagement();

    return (
        <div className="space-y-5">
            {/* Page header */}
            <AdminPageHeader
                title="User Management"
                subtitle="Manage platform users, roles, and account status."
                breadcrumbs={[
                    { label: "Dashboard", path: "/admin/dashboard" },
                    { label: "Users" }
                ]}
                actionButton={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => fetchUsers(true)}
                            disabled={loading || isRefreshing}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
                            title="Refresh"
                        >
                            <FiRefreshCw className={`h-4 w-4 ${loading || isRefreshing ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md"
                        >
                            <FiUserPlus className="h-4 w-4" />
                            Add User
                        </button>
                    </div>
                }
            />

            {/* Stats */}
            <UserStats />

            {/* Filters */}
            <UserTableFilters />

            {/* Bulk selection hint */}
            {selectedUsers.size > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">
                    <span className="font-bold">{selectedUsers.size}</span>{" "}
                    {selectedUsers.size === 1 ? "user" : "users"} selected — use the action bar below.
                </div>
            )}

            {/* Main table */}
            <DataTable />

            {/* Floating bulk action bar */}
            <BulkActionBar />

            {/* Modals */}
            <UserDetailModal />
            <EditUserModal />
            <DeleteConfirmModal />
            <AddUserModal />
        </div>
    );
}

/**
 * UserManagementSection — top-level export.
 * Wraps everything in the context provider.
 */
export default function UserManagementSection() {
    return (
        <UserManagementProvider>
            <UserManagementContent />
        </UserManagementProvider>
    );
}
