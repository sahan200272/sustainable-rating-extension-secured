import express from 'express';
import {
	startGoogleLogin,
	googleCallback,
	exchangeGoogleTicket
} from '../controllers/oauth.controller.js';
import {
	googleStartRateLimiter,
	googleCallbackRateLimiter,
	googleExchangeRateLimiter
} from '../middlewares/oauthRateLimiter.js';

const authRouter = express.Router();

// Google sign-in: OpenID Connect authorization code flow with PKCE
authRouter.get('/google', googleStartRateLimiter, startGoogleLogin);
authRouter.get('/google/callback', googleCallbackRateLimiter, googleCallback);
authRouter.post('/google/exchange', googleExchangeRateLimiter, exchangeGoogleTicket);

export default authRouter;
