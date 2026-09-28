import crypto from 'crypto';
import bcrypt from 'bcrypt';
import User from '../models/user.js';
import OAuthTransaction from '../models/oauthTransaction.js';
import LoginTicket from '../models/loginTicket.js';
import { getGoogleClient, getGoogleConfig } from '../config/googleOAuth.js';
import { sanitizeUser } from './user.service.js';

export const TRANSACTION_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 60 * 1000;

// Expected sign-in failures. `code` is what the frontend receives as ?oauth_error=
export class OAuthError extends Error {
    constructor(code) {
        super(`Google sign-in failed: ${code}`);
        this.code = code;
    }
}

function randomToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest();
}

// Hashing first gives equal-length buffers, which timingSafeEqual requires
function safeEqual(a, b) {
    return crypto.timingSafeEqual(sha256(a), sha256(b));
}

function splitGoogleName(name = '') {
    const trimmed = name.trim();
    if (!trimmed) {
        return { firstName: 'Google', lastName: 'User' };
    }

    const [firstName, ...rest] = trimmed.split(' ');
    return {
        firstName,
        lastName: rest.join(' ') || 'User'
    };
}

// Service function to start Google sign-in: returns the URL to send the browser to
export async function startGoogleLogin() {
    const client = getGoogleClient();

    const transactionId = randomToken();
    const state = randomToken();
    const nonce = randomToken();
    // 32 random bytes = 43 base64url chars, the minimum length RFC 7636 allows
    const codeVerifier = randomToken();
    const codeChallenge = sha256(codeVerifier).toString('base64url');

    await OAuthTransaction.create({
        transactionId,
        state,
        nonce,
        codeVerifier,
        expiresAt: new Date(Date.now() + TRANSACTION_TTL_MS)
    });

    const authUrl = client.generateAuthUrl({
        response_type: 'code',
        scope: ['openid', 'email', 'profile'],
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
        access_type: 'online'
    });

    return { transactionId, authUrl };
}

// Service function to finish Google sign-in: returns a one-time login ticket
export async function completeGoogleLogin({ transactionId, state, code }) {
    if (!transactionId) {
        throw new OAuthError('session_expired');
    }

    // Single use: consume the transaction before checking anything else
    const transaction = await OAuthTransaction.findOneAndDelete({
        transactionId,
        expiresAt: { $gt: new Date() }
    });

    if (!transaction) {
        throw new OAuthError('session_expired');
    }

    if (!state || !safeEqual(state, transaction.state)) {
        throw new OAuthError('invalid_state');
    }

    if (!code) {
        throw new OAuthError('invalid_request');
    }

    const claims = await exchangeCodeForClaims(code, transaction.codeVerifier);

    // The ID token must have been issued for this sign-in attempt
    if (claims.nonce !== transaction.nonce) {
        throw new OAuthError('invalid_nonce');
    }

    if (claims.email_verified !== true) {
        throw new OAuthError('email_not_verified');
    }

    const user = await findOrCreateGoogleUser(claims);
    return issueLoginTicket(user._id);
}

// Google's tokens stay inside this function; only the verified claims leave it
async function exchangeCodeForClaims(code, codeVerifier) {
    const client = getGoogleClient();
    const { clientId } = getGoogleConfig();

    let tokens;
    try {
        ({ tokens } = await client.getToken({ code, codeVerifier }));
    } catch {
        // Google rejects reused or expired codes, and codes whose verifier doesn't match
        throw new OAuthError('token_exchange_failed');
    }

    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: tokens.id_token,
            audience: clientId
        });
        payload = ticket.getPayload();
    } catch {
        // Not rethrown as-is: the library's error messages can include the raw token
        throw new OAuthError('invalid_token');
    }

    if (!payload?.sub || !payload.email) {
        throw new OAuthError('invalid_token');
    }

    return payload;
}

// sub is Google's stable account id; email is only used once, to link an existing account
async function findOrCreateGoogleUser(claims) {
    const linkedUser = await User.findOne({ googleSub: claims.sub });

    if (linkedUser) {
        if (linkedUser.isBlocked) {
            throw new OAuthError('account_blocked');
        }
        return linkedUser;
    }

    const existingUser = await User.findOne({ email: claims.email });

    if (existingUser) {
        if (existingUser.isBlocked) {
            throw new OAuthError('account_blocked');
        }

        if (existingUser.googleSub) {
            throw new OAuthError('account_conflict');
        }

        // Could be a sign-up by someone else who knows its password; linking would let them keep access
        if (!existingUser.emailVerified) {
            throw new OAuthError('account_not_verified');
        }

        existingUser.googleSub = claims.sub;
        await existingUser.save();
        return existingUser;
    }

    const fallbackName = splitGoogleName(claims.name);
    const newUser = new User({
        firstName: claims.given_name || fallbackName.firstName,
        lastName: claims.family_name || fallbackName.lastName,
        email: claims.email,
        googleSub: claims.sub,
        // Unguessable; these accounts sign in through Google
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        profilePicture: claims.picture || undefined,
        address: 'Not Given',
        phone: 'Not Given',
        role: 'Customer',
        isBlocked: false,
        emailVerified: true
    });

    await newUser.save();
    return newUser;
}

async function issueLoginTicket(userId) {
    const ticket = randomToken();

    await LoginTicket.create({
        ticketHash: sha256(ticket).toString('hex'),
        user: userId,
        expiresAt: new Date(Date.now() + TICKET_TTL_MS)
    });

    return ticket;
}

// Service function to redeem a login ticket for the user it was issued to
export async function redeemLoginTicket(ticket) {
    // Atomic, and checks expiry itself since MongoDB's TTL cleanup runs only about once a minute
    const record = await LoginTicket.findOneAndDelete({
        ticketHash: sha256(ticket).toString('hex'),
        expiresAt: { $gt: new Date() }
    });

    if (!record) {
        throw new OAuthError('invalid_ticket');
    }

    const user = await User.findById(record.user);

    if (!user) {
        throw new OAuthError('invalid_ticket');
    }

    // May have been blocked since the callback
    if (user.isBlocked) {
        throw new OAuthError('account_blocked');
    }

    return sanitizeUser(user);
}
