import { OAuth2Client } from 'google-auth-library';

const REQUIRED_VARS = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'FRONTEND_URL'
];

let client = null;

// Read at call time: imports are evaluated before server.js runs dotenv.config()
export function getGoogleConfig() {
    const missing = REQUIRED_VARS.filter((name) => !process.env[name]);

    // Fail closed: without a client id, verifyIdToken would skip the audience check
    if (missing.length > 0) {
        throw new Error(`Google sign-in is not configured. Missing: ${missing.join(', ')}`);
    }

    return {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI,
        frontendUrl: process.env.FRONTEND_URL
    };
}

export function getGoogleClient() {
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();

    // Reuse one client so Google's signing certs stay cached between logins
    if (!client) {
        client = new OAuth2Client({ clientId, clientSecret, redirectUri });
    }

    return client;
}
