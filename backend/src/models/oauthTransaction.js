import mongoose from "mongoose";

// Server-side half of a Google sign-in attempt. The browser only holds transactionId (in a cookie).
const OAuthTransactionSchema = new mongoose.Schema({
    transactionId: {
        type: String,
        required: true,
        unique: true
    },

    state: {
        type: String,
        required: true
    },

    nonce: {
        type: String,
        required: true
    },

    codeVerifier: {
        type: String,
        required: true
    },

    expiresAt: {
        type: Date,
        required: true
    }
});

// Cleanup only; expiry is also checked when the transaction is loaded
OAuthTransactionSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

const OAuthTransaction = mongoose.model("OAuthTransaction", OAuthTransactionSchema);

export default OAuthTransaction;
