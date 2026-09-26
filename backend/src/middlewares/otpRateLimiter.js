import { rateLimit } from 'express-rate-limit';

// Limit OTP generation requests.
// 5 requests per 15 minutes per IP.
export const sendOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again later.'
    }
});

// Limit OTP verification requests.
// 10 requests per 15 minutes per IP.
export const verifyOtpRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many OTP verification attempts. Please try again later.'
    }
});