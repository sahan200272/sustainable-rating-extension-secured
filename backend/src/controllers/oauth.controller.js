import * as oauthService from '../services/oauth.service.js';
import { getGoogleConfig } from '../config/googleOAuth.js';
import { signAppToken } from '../utils/authToken.js';

const TRANSACTION_COOKIE = 'greeny_oauth_tx';

function readCookie(req, name) {
    const header = req.headers.cookie;
    if (!header) {
        return null;
    }

    for (const part of header.split(';')) {
        const separator = part.indexOf('=');
        if (separator !== -1 && part.slice(0, separator).trim() === name) {
            return part.slice(separator + 1).trim();
        }
    }

    return null;
}

function transactionCookieOptions(redirectUri) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        // Secure cookies need https, so follow the callback URL's scheme
        secure: redirectUri.startsWith('https://'),
        // Only sent to /google and /google/callback
        path: '/api/auth/google'
    };
}

function getConfigOrFail(res) {
    try {
        return getGoogleConfig();
    } catch (error) {
        console.error(error.message);
        res.status(503).json({ error: 'Google sign-in is not available' });
        return null;
    }
}

function redirectToLogin(res, frontendUrl, errorCode) {
    return res.redirect(302, `${frontendUrl}/login?oauth_error=${errorCode}`);
}

// Controller function to start Google sign-in (redirects the browser to Google)
export async function startGoogleLogin(req, res) {
    const config = getConfigOrFail(res);
    if (!config) return;

    try {
        const { transactionId, authUrl } = await oauthService.startGoogleLogin();

        res.cookie(TRANSACTION_COOKIE, transactionId, {
            ...transactionCookieOptions(config.redirectUri),
            maxAge: oauthService.TRANSACTION_TTL_MS
        });

        return res.redirect(302, authUrl);
    } catch (error) {
        console.error('Google sign-in start error:', error);
        return redirectToLogin(res, config.frontendUrl, 'login_failed');
    }
}

// Controller function for Google's redirect back after the user signs in
export async function googleCallback(req, res) {
    const config = getConfigOrFail(res);
    if (!config) return;

    const transactionId = readCookie(req, TRANSACTION_COOKIE);
    res.clearCookie(TRANSACTION_COOKIE, transactionCookieOptions(config.redirectUri));

    const { error, state, code } = req.query;

    if (error) {
        // Only known codes go back to the frontend, never Google's raw text
        const errorCode = error === 'access_denied' ? 'access_denied' : 'google_error';
        return redirectToLogin(res, config.frontendUrl, errorCode);
    }

    try {
        const ticket = await oauthService.completeGoogleLogin({
            transactionId,
            // Repeated query params arrive as arrays
            state: typeof state === 'string' ? state : null,
            code: typeof code === 'string' ? code : null
        });

        // In the fragment so it isn't sent to the frontend host or leaked in a Referer header
        return res.redirect(302, `${config.frontendUrl}/oauth/callback#ticket=${ticket}`);
    } catch (err) {
        if (err instanceof oauthService.OAuthError) {
            console.warn(`Google sign-in rejected: ${err.code}`);
            return redirectToLogin(res, config.frontendUrl, err.code);
        }

        console.error('Google callback error:', err);
        return redirectToLogin(res, config.frontendUrl, 'login_failed');
    }
}

// Controller function to swap a one-time login ticket for a Greeny JWT
export async function exchangeGoogleTicket(req, res) {
    const ticket = req.body?.ticket;

    if (typeof ticket !== 'string' || !ticket) {
        return res.status(400).json({ error: 'Login ticket is required' });
    }

    try {
        const user = await oauthService.redeemLoginTicket(ticket);
        const token = signAppToken(user);

        // Same response as POST /api/users/login
        return res.status(200).json({
            message: 'Login Successful!',
            token,
            user
        });
    } catch (error) {
        if (error instanceof oauthService.OAuthError && error.code === 'account_blocked') {
            return res.status(403).json({
                error: 'Your Account is blocked. Please contact support.'
            });
        }

        if (error instanceof oauthService.OAuthError) {
            return res.status(401).json({ error: 'Invalid or expired login ticket' });
        }

        console.error('Google ticket exchange error:', error);
        return res.status(500).json({ error: 'Login failed' });
    }
}
