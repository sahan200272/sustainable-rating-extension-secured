import mongoose from "mongoose";

const OTPSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },

    otp: {
        type: Number,
        required: true
    },

    failedAttempts: {
        type: Number,
        default: 0
    },

    lockedUntil: {
        type: Date,
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    },

    expiresAt: {
        type: Date,
        required: true,
        index: true
    }
});

// Automatically delete OTP documents when expiresAt is reached.
OTPSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

const OTP = mongoose.model("OTP", OTPSchema);

export default OTP;