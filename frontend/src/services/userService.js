import api from "./api";

/**
 * Register a new user.
 * @param {Object} userData - User registration data.
 * @returns {Promise} Response from the API.
 */
export const registerUser = async (userData) => {
    const response = await api.post("/api/users/register", userData);
    return response.data;
};

/**
 * Login a user.
 * Token storage is handled by AuthContext (not here) to keep the service layer pure.
 * @param {Object} credentials - { email, password }
 * @returns {Promise} Response from the API — contains { user, token }.
 */
export const loginUser = async (credentials) => {
    const response = await api.post("/api/users/login", credentials);
    return response.data;
};

/**
 * Get the current authenticated user's data.
 * The auth token is automatically attached by the api.js interceptor.
 * @returns {Promise} User data.
 */
export const getUser = async () => {
    const response = await api.get("/api/users/getUser");
    return response.data;
};

/**
 * Semantic alias via the /api/users/me REST route.
 * Prefer this in components that display the logged-in user's profile.
 * @returns {Promise} User data.
 */
export const getMe = async () => {
    const response = await api.get("/api/users/me");
    return response.data;
};

/**
 * Update the logged-in user's own profile fields.
 * Only whitelisted fields are sent; the backend ignores the rest.
 * @param {{ firstName?, lastName?, phone?, address?, profilePicture? }} payload
 * @returns {Promise} Response from API — contains { message, user }
 */
export const updateProfile = async (payload) => {
    const response = await api.patch("/api/users/me", payload);
    return response.data;
};

// ─── Admin-only API functions ──────────────────────────────────────────────

/**
 * Fetch all users (Admin only).
 * @returns {Promise<Array>} Array of user objects.
 */
export const adminGetAllUsers = async () => {
    const response = await api.get("/api/users/admin/getAllUsers");
    return response.data;
};

/**
 * Toggle block/unblock a user by email (Admin only).
 * @param {string} email - Target user's email.
 * @returns {Promise} { message, user }
 */
export const adminToggleBlockUser = async (email) => {
    const response = await api.patch(`/api/users/admin/block-user/${encodeURIComponent(email)}`);
    return response.data;
};

/**
 * Permanently delete a user by email (Admin only).
 * @param {string} email - Target user's email.
 * @returns {Promise} { message, user }
 */
export const adminDeleteUser = async (email) => {
    const response = await api.delete(`/api/users/admin/delete-user/${encodeURIComponent(email)}`);
    return response.data;
};

/**
 * Update a user's role (Admin only).
 * @param {string} email - Target user's email.
 * @param {string} role  - New role: "Admin" | "Customer"
 * @returns {Promise} { message, user }
 */
export const adminUpdateUserRole = async (email, role) => {
    const response = await api.patch(`/api/users/admin/update-role/${encodeURIComponent(email)}`, { role });
    return response.data;
};

/**
 * Admin-created user registration.
 * Reuses the public register endpoint but called by an authenticated admin.
 * @param {Object} userData - { firstName, lastName, email, password, role, phone, address }
 * @returns {Promise} { message, user }
 */
export const adminCreateUser = async (userData) => {
    const response = await api.post("/api/users/register", {
        ...userData,
        phone: userData.phone || "Not provided",
        address: userData.address || "Not provided",
        emailVerified: true,
    });
    return response.data;
};
