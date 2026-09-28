import mongoose from "mongoose";

// One-time ticket the frontend swaps for a Greeny JWT after Google sign-in
const LoginTicketSchema = new mongoose.Schema({
    // SHA-256 of the ticket; the ticket itself is never stored
    ticketHash: {
        type: String,
        required: true,
        unique: true
    },

    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    expiresAt: {
        type: Date,
        required: true
    }
});

// Cleanup only; redeeming checks expiresAt itself
LoginTicketSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

const LoginTicket = mongoose.model("LoginTicket", LoginTicketSchema);

export default LoginTicket;
