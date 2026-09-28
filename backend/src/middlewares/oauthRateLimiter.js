import { rateLimit } from 'express-rate-limit';

// These are browser navigations, so send the user back to the login page instead of showing JSON
function redirectToLogin(req, res) {
    if (!process.env.FRONTEND_URL) {
        return res.status(429).json({
            success: false,
            message: 'Too many sign-in attempts. Please try again later.'
        });
    }

    return res.redirect(302, `${process.env.FRONTEND_URL}/login?oauth_error=rate_limited`);
}

// Limit Google sign-in starts.
// 20 requests per 15 minutes per IP.
export const googleStartRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: redirectToLogin
});

// Limit Google sign-in callbacks.
// 20 requests per 15 minutes per IP.
export const googleCallbackRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: redirectToLogin
});

// Limit login ticket exchanges.
// 20 requests per 15 minutes per IP.
export const googleExchangeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Too many sign-in attempts. Please try again later.'
    }
});
