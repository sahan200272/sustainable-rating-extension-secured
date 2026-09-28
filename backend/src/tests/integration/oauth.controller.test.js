import { jest } from "@jest/globals";
import crypto from "crypto";

const mockGenerateAuthUrl = jest.fn();
const mockGetToken = jest.fn();
const mockVerifyIdToken = jest.fn();

// Stand-in for Google, so each test controls what the token endpoint and ID token verification return
jest.unstable_mockModule("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    generateAuthUrl: mockGenerateAuthUrl,
    getToken: mockGetToken,
    verifyIdToken: mockVerifyIdToken
  }))
}));

// Rate limits are covered in oauthRateLimiter.test.js
jest.unstable_mockModule("../../middlewares/oauthRateLimiter.js", () => ({
  googleStartRateLimiter: (req, res, next) => next(),
  googleCallbackRateLimiter: (req, res, next) => next(),
  googleExchangeRateLimiter: (req, res, next) => next()
}));

const { default: mongoose } = await import("mongoose");
const { default: request } = await import("supertest");
const { default: dotenv } = await import("dotenv");
const { default: jwt } = await import("jsonwebtoken");
const { default: bcrypt } = await import("bcrypt");
const { default: app } = await import("../../server.js");
const { default: User } = await import("../../models/user.js");
const { default: OAuthTransaction } = await import("../../models/oauthTransaction.js");
const { default: LoginTicket } = await import("../../models/loginTicket.js");

dotenv.config({ path: ".env.test" });

const CLIENT_ID = "test-client-id.apps.googleusercontent.com";
const FRONTEND_URL = "http://localhost:5173";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:5000/api/auth/google/callback";
process.env.FRONTEND_URL = FRONTEND_URL;
process.env.JWT_SECRET = "test-jwt-secret";

const emailFor = (name) => `${name}@oidc.test`;
const countTestUsers = () => User.countDocuments({ email: /@oidc\.test$/ });
const sha256Hex = (value) => crypto.createHash("sha256").update(value).digest("hex");

function googleClaims(overrides = {}) {
  return {
    iss: "https://accounts.google.com",
    aud: CLIENT_ID,
    sub: "google-sub-1",
    email: emailFor("new.user"),
    email_verified: true,
    given_name: "Oidc",
    family_name: "User",
    name: "Oidc User",
    picture: "https://example.com/avatar.png",
    ...overrides
  };
}

// GET /api/auth/google, returning what was sent to Google and the transaction cookie
async function startLogin() {
  const res = await request(app).get("/api/auth/google");
  const authParams = mockGenerateAuthUrl.mock.calls.at(-1)?.[0];
  const setCookie = res.headers["set-cookie"]?.find((c) => c.startsWith("greeny_oauth_tx="));
  const cookie = setCookie?.split(";")[0];
  return { res, authParams, cookie, transactionId: cookie?.split("=")[1] };
}

// Google's token endpoint answers with an ID token that verifies to these claims
function googleReturns(claims) {
  mockGetToken.mockResolvedValueOnce({
    tokens: { id_token: "google-id-token", access_token: "google-access-token" }
  });
  mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => claims });
}

function callback(query, cookie) {
  const req = request(app).get("/api/auth/google/callback").query(query);
  return cookie ? req.set("Cookie", cookie) : req;
}

// Full start -> Google -> callback round trip
async function signInWithGoogle(claimOverrides = {}) {
  const { authParams, cookie } = await startLogin();
  googleReturns(googleClaims({ nonce: authParams.nonce, ...claimOverrides }));
  return callback({ code: "auth-code", state: authParams.state }, cookie);
}

function exchange(body) {
  return request(app).post("/api/auth/google/exchange").send(body);
}

function oauthErrorFrom(res) {
  const location = new URL(res.headers.location);
  expect(`${location.origin}${location.pathname}`).toBe(`${FRONTEND_URL}/login`);
  return location.searchParams.get("oauth_error");
}

function ticketFrom(res) {
  const location = new URL(res.headers.location);
  expect(`${location.origin}${location.pathname}`).toBe(`${FRONTEND_URL}/oauth/callback`);
  return new URLSearchParams(location.hash.slice(1)).get("ticket");
}

async function seedUser(overrides = {}) {
  return User.create({
    firstName: "Local",
    lastName: "User",
    email: emailFor("local.user"),
    password: await bcrypt.hash("Password123!", 10),
    phone: "0771234567",
    address: "1 Test Street",
    emailVerified: true,
    ...overrides
  });
}

async function cleanup() {
  await User.deleteMany({ email: /@oidc\.test$/ });
  await OAuthTransaction.deleteMany({});
  await LoginTicket.deleteMany({});
}

describe("Google OIDC sign-in (authorization code + PKCE)", () => {
  beforeAll(async () => {
    // Own database: other integration suites wipe the shared users collection while running in parallel
    await mongoose.connect(process.env.MONGODB_URL_TEST, { dbName: "greeny_oauth_test" });
  });

  beforeEach(async () => {
    mockGenerateAuthUrl.mockReset().mockImplementation(
      (opts) => `${GOOGLE_AUTH_URL}?${new URLSearchParams({ ...opts, scope: opts.scope.join(" ") })}`
    );
    mockGetToken.mockReset();
    mockVerifyIdToken.mockReset();
    await cleanup();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await cleanup();
    }
    await mongoose.connection.close();
  });

  describe("GET /api/auth/google", () => {
    it("redirects to Google with a code request carrying state, nonce and an S256 PKCE challenge", async () => {
      const { res, authParams, cookie, transactionId } = await startLogin();

      expect(res.statusCode).toBe(302);
      expect(res.headers.location.startsWith(GOOGLE_AUTH_URL)).toBe(true);
      expect(authParams).toEqual(expect.objectContaining({
        response_type: "code",
        scope: ["openid", "email", "profile"],
        code_challenge_method: "S256",
        prompt: "select_account",
        access_type: "online"
      }));

      // state, nonce and verifier stay on the server; the verifier is never sent to Google here
      const transaction = await OAuthTransaction.findOne({ transactionId });
      expect(transaction.state).toBe(authParams.state);
      expect(transaction.nonce).toBe(authParams.nonce);
      expect(authParams.code_challenge).toBe(
        crypto.createHash("sha256").update(transaction.codeVerifier).digest("base64url")
      );
      expect(transaction.codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
      expect(authParams).not.toHaveProperty("code_verifier");

      const ttl = transaction.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(9 * 60 * 1000);
      expect(ttl).toBeLessThanOrEqual(10 * 60 * 1000);

      // The cookie holds only the transaction id
      expect([authParams.state, authParams.nonce, transaction.codeVerifier]).not.toContain(transactionId);
      const setCookie = res.headers["set-cookie"].join("; ");
      expect(setCookie).toMatch(/HttpOnly/);
      expect(setCookie).toMatch(/SameSite=Lax/);
      expect(setCookie).toMatch(/Path=\/api\/auth\/google/);
      expect(cookie).toBeDefined();
    });

    it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"])(
      "fails closed when %s is missing",
      async (name) => {
        const saved = process.env[name];
        delete process.env[name];

        try {
          const res = await request(app).get("/api/auth/google");

          expect(res.statusCode).toBe(503);
          expect(res.headers.location).toBeUndefined();
          expect(mockGenerateAuthUrl).not.toHaveBeenCalled();
        } finally {
          process.env[name] = saved;
        }
      }
    );
  });

  describe("GET /api/auth/google/callback", () => {
    it("creates the user and redirects to the frontend with a one-time ticket in the fragment", async () => {
      const { authParams, cookie, transactionId } = await startLogin();
      const { codeVerifier } = await OAuthTransaction.findOne({ transactionId });
      googleReturns(googleClaims({ nonce: authParams.nonce }));

      const res = await callback({ code: "auth-code", state: authParams.state }, cookie);

      expect(res.statusCode).toBe(302);
      const ticket = ticketFrom(res);
      expect(ticket).toBeTruthy();

      // Code redeemed with the PKCE verifier; ID token checked against our client id
      expect(mockGetToken).toHaveBeenCalledWith({ code: "auth-code", codeVerifier });
      expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: "google-id-token", audience: CLIENT_ID });

      const user = await User.findOne({ email: emailFor("new.user") });
      expect(user.googleSub).toBe("google-sub-1");
      expect(user.emailVerified).toBe(true);

      // Only the ticket's hash is stored
      const stored = await LoginTicket.findOne({ user: user._id });
      expect(stored.ticketHash).toBe(sha256Hex(ticket));

      // Transaction consumed, cookie cleared
      expect(await OAuthTransaction.countDocuments({ transactionId })).toBe(0);
      expect(res.headers["set-cookie"].join("; ")).toMatch(/greeny_oauth_tx=;.*Expires=Thu, 01 Jan 1970/);

      // Google's tokens never reach the browser
      expect(res.headers.location).not.toContain("google-id-token");
      expect(res.headers.location).not.toContain("google-access-token");
    });

    it("rejects a replayed callback because the transaction is single use", async () => {
      const { authParams, cookie } = await startLogin();
      googleReturns(googleClaims({ nonce: authParams.nonce }));
      const query = { code: "auth-code", state: authParams.state };

      await callback(query, cookie);
      const replay = await callback(query, cookie);

      expect(oauthErrorFrom(replay)).toBe("session_expired");
      expect(mockGetToken).toHaveBeenCalledTimes(1);
    });

    it("rejects a tampered state (login CSRF) and burns the transaction", async () => {
      const { cookie } = await startLogin();

      const res = await callback({ code: "attacker-code", state: "attacker-state" }, cookie);

      expect(oauthErrorFrom(res)).toBe("invalid_state");
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(await OAuthTransaction.countDocuments()).toBe(0);
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("rejects a callback without the transaction cookie", async () => {
      const { authParams } = await startLogin();

      const res = await callback({ code: "auth-code", state: authParams.state });

      expect(oauthErrorFrom(res)).toBe("session_expired");
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("rejects an ID token whose nonce belongs to a different sign-in (replay)", async () => {
      const res = await signInWithGoogle({ nonce: "nonce-from-another-login" });

      expect(oauthErrorFrom(res)).toBe("invalid_nonce");
      expect(await countTestUsers()).toBe(0);
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("rejects a Google account whose email is not verified", async () => {
      const res = await signInWithGoogle({ email_verified: false });

      expect(oauthErrorFrom(res)).toBe("email_not_verified");
      expect(await countTestUsers()).toBe(0);
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("VULN-2 regression: rejects a forged ID token that fails signature verification, without creating a user or ticket", async () => {
      const { authParams, cookie } = await startLogin();

      // Every claim looks right; only the signature is wrong. jwt.decode() would have accepted it.
      const forgedIdToken = jwt.sign(
        googleClaims({ nonce: authParams.nonce, email: emailFor("victim") }),
        "attacker-signing-key"
      );
      mockGetToken.mockResolvedValueOnce({ tokens: { id_token: forgedIdToken } });
      mockVerifyIdToken.mockRejectedValueOnce(new Error("Invalid token signature"));

      const res = await callback({ code: "auth-code", state: authParams.state }, cookie);

      expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: forgedIdToken, audience: CLIENT_ID });
      expect(oauthErrorFrom(res)).toBe("invalid_token");
      expect(await countTestUsers()).toBe(0);
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("rejects a blocked user", async () => {
      await seedUser({ email: emailFor("new.user"), googleSub: "google-sub-1", isBlocked: true });

      const res = await signInWithGoogle();

      expect(oauthErrorFrom(res)).toBe("account_blocked");
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("finds a linked user by sub even if their Google email has changed", async () => {
      const user = await seedUser({ email: emailFor("old.address"), googleSub: "google-sub-1" });

      const res = await signInWithGoogle({ email: emailFor("new.address") });

      const stored = await LoginTicket.findOne({ ticketHash: sha256Hex(ticketFrom(res)) });
      expect(stored.user.toString()).toBe(user._id.toString());
      expect(await countTestUsers()).toBe(1);
    });

    it("links an existing verified account by email", async () => {
      const user = await seedUser({ email: emailFor("new.user") });

      const res = await signInWithGoogle();

      expect(ticketFrom(res)).toBeTruthy();
      expect((await User.findById(user._id)).googleSub).toBe("google-sub-1");
      expect(await countTestUsers()).toBe(1);
    });

    it("refuses to link an existing account whose email hasn't been verified", async () => {
      const user = await seedUser({ email: emailFor("new.user"), emailVerified: false });

      const res = await signInWithGoogle();

      expect(oauthErrorFrom(res)).toBe("account_not_verified");
      expect((await User.findById(user._id)).googleSub).toBeUndefined();
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("refuses to link an email that is already linked to a different Google account", async () => {
      await seedUser({ email: emailFor("new.user"), googleSub: "another-google-sub" });

      const res = await signInWithGoogle();

      expect(oauthErrorFrom(res)).toBe("account_conflict");
      expect(await LoginTicket.countDocuments()).toBe(0);
    });

    it("rejects the sign-in when Google refuses the code exchange (e.g. wrong PKCE verifier)", async () => {
      const { authParams, cookie } = await startLogin();
      mockGetToken.mockRejectedValueOnce(new Error("invalid_grant"));

      const res = await callback({ code: "injected-code", state: authParams.state }, cookie);

      expect(oauthErrorFrom(res)).toBe("token_exchange_failed");
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    it.each([
      ["access_denied", "access_denied"],
      ["temporarily_unavailable", "google_error"]
    ])("maps Google's error=%s to oauth_error=%s without reflecting it", async (googleError, expected) => {
      const res = await callback({ error: googleError, state: "any-state" });

      expect(oauthErrorFrom(res)).toBe(expected);
      expect(mockGetToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/auth/google/exchange", () => {
    it("returns the same { message, token, user } response and JWT claims as password login", async () => {
      await seedUser({ email: emailFor("new.user") });
      const ticket = ticketFrom(await signInWithGoogle());

      const viaGoogle = await exchange({ ticket });
      const viaPassword = await request(app)
        .post("/api/users/login")
        .send({ email: emailFor("new.user"), password: "Password123!" });

      expect(viaGoogle.statusCode).toBe(200);
      expect(Object.keys(viaGoogle.body).sort()).toEqual(["message", "token", "user"]);
      expect(viaGoogle.body.message).toBe(viaPassword.body.message);
      expect(viaGoogle.body.user).toEqual(viaPassword.body.user);
      expect(viaGoogle.body.user).not.toHaveProperty("password");

      const { iat, exp, ...googleTokenClaims } = jwt.verify(viaGoogle.body.token, process.env.JWT_SECRET);
      const { iat: _iat, exp: _exp, ...passwordTokenClaims } = jwt.verify(viaPassword.body.token, process.env.JWT_SECRET);
      expect(googleTokenClaims).toEqual(passwordTokenClaims);
      expect(exp - iat).toBe(24 * 60 * 60);
    });

    it("accepts a ticket only once", async () => {
      const ticket = ticketFrom(await signInWithGoogle());

      const first = await exchange({ ticket });
      const second = await exchange({ ticket });

      expect(first.statusCode).toBe(200);
      expect(second.statusCode).toBe(401);
      expect(second.body).not.toHaveProperty("token");
    });

    it("rejects an expired ticket even before MongoDB's TTL cleanup removes it", async () => {
      const user = await seedUser();
      const ticket = "expired-ticket";
      await LoginTicket.create({
        ticketHash: sha256Hex(ticket),
        user: user._id,
        expiresAt: new Date(Date.now() - 1000)
      });

      const res = await exchange({ ticket });

      expect(res.statusCode).toBe(401);
      expect(res.body).not.toHaveProperty("token");
    });

    it("rejects a ticket for a user who was blocked after the callback", async () => {
      const ticket = ticketFrom(await signInWithGoogle());
      await User.updateOne({ email: emailFor("new.user") }, { isBlocked: true });

      const res = await exchange({ ticket });

      expect(res.statusCode).toBe(403);
      expect(res.body).not.toHaveProperty("token");
    });

    it.each([{}, { ticket: "" }, { ticket: { $ne: null } }])(
      "rejects a missing or non-string ticket: %j",
      async (body) => {
        const res = await exchange(body);

        expect(res.statusCode).toBe(400);
      }
    );
  });
});
