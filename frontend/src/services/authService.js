import api from "./api";

/**
 * Send an OTP to the authenticated user's email.
 * Reuses the existing /api/users/send-otp endpoint.
 * @returns {Promise} Response from the API.
 */
export const sendOtp = async () => {
    const response = await api.post("/api/users/send-otp");
    return response.data;
};

/**
 * Verify an OTP code for the authenticated user.
 * Reuses the existing /api/users/verify-otp endpoint.
 * @param {string|number} code - 6-digit OTP code
 * @returns {Promise} Response from the API.
 */
export const verifyOtp = async (code) => {
    const response = await api.post("/api/users/verify-otp", { code });
    return response.data;
};

/**
 * Swap the one-time ticket from the Google sign-in redirect for a Greeny session.
 * @param {string} ticket - Ticket from the /oauth/callback URL fragment
 * @returns {Promise} Response from the API — contains { message, token, user }.
 */
export const exchangeGoogleTicket = async (ticket) => {
    const response = await api.post("/api/auth/google/exchange", { ticket });
    return response.data;
};
