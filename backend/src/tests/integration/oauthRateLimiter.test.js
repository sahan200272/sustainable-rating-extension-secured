import request from "supertest";
import app from "../../server.js";

const FRONTEND_URL = "http://localhost:5173";
const LIMIT = 20;

describe("Google sign-in rate limits", () => {
  beforeAll(() => {
    process.env.FRONTEND_URL = FRONTEND_URL;
    // Without Google config the routes answer 503 straight away, which still counts toward the limit
    delete process.env.GOOGLE_CLIENT_ID;
  });

  it.each(["/api/auth/google", "/api/auth/google/callback"])(
    `sends the browser back to the login page after ${LIMIT} requests to %s`,
    async (path) => {
      for (let i = 0; i < LIMIT; i++) {
        const res = await request(app).get(path);
        expect(res.statusCode).toBe(503);
      }

      const limited = await request(app).get(path);

      expect(limited.statusCode).toBe(302);
      expect(limited.headers.location).toBe(`${FRONTEND_URL}/login?oauth_error=rate_limited`);
    }
  );

  it("returns 429 after too many ticket exchanges", async () => {
    for (let i = 0; i < LIMIT; i++) {
      const res = await request(app).post("/api/auth/google/exchange").send({});
      expect(res.statusCode).toBe(400);
    }

    const limited = await request(app).post("/api/auth/google/exchange").send({});

    expect(limited.statusCode).toBe(429);
  });
});
