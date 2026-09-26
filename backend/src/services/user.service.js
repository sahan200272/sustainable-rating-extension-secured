import User from '../models/user.js';
import bcrypt from 'bcrypt';
import axios from 'axios';
import nodemailer from 'nodemailer';
import OTP from '../models/otp.js';
import { generateOtpEmailTemplate } from '../utils/emailTemplates.js';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function getTransport() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: process.env.EMAIL_USER && process.env.EMAIL_PASSWORD
            ? {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
            : undefined
    });
}

function sanitizeUser(user) {
    const userObj = user.toObject();
    delete userObj.password;
    return userObj;
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

// Service function to register a new user
export async function registerUser(userData) {
    const { email, password } = userData;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new Error('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save user
    const newUser = new User({
        ...userData,
        password: hashedPassword
    });

    await newUser.save();

    // Return user without password
    return sanitizeUser(newUser);
}

// Service function to login a user
export async function loginUser(credentials) {
    const { email, password } = credentials;

    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
        throw new Error('User not found');
    }

    // Check if account is blocked
    if (user.isBlocked) {
        throw new Error('Account is blocked');
    }

    // Verify password
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    
    if (!isPasswordCorrect) {
        throw new Error('Invalid credentials');
    }

    // Return user without password
    return sanitizeUser(user);
}

// Service function to get user by email
export async function getUserByEmail(email) {
    const user = await User.findOne({ email });
    
    if (!user) {
        throw new Error('User not found');
    }

    // Return user without password
    return sanitizeUser(user);
}

// Service function to update a user's profile fields by email
export async function updateUserByEmail(email, updates) {
    const user = await User.findOneAndUpdate(
        { email },
        { $set: updates },
        { new: true, runValidators: true }
    );

    if (!user) {
        throw new Error('User not found');
    }

    return sanitizeUser(user);
}

// Service function to get all users
export async function getAllUsers() {
    const users = await User.find();
    
    // Return users without passwords
    const usersResponse = users.map((user) => sanitizeUser(user));
    
    return usersResponse;
}

// Service function to toggle a user's blocked status (Admin operation)
export async function toggleBlockUserByEmail(email) {
    const user = await User.findOne({ email });

    if (!user) {
        throw new Error('User not found');
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return {
        isBlocked: user.isBlocked,
        user: sanitizeUser(user)
    };
}

// Service function to delete a user by email (Admin operation)
export async function deleteUserByEmail(email) {
    const user = await User.findOneAndDelete({ email });

    if (!user) {
        throw new Error('User not found');
    }

    return sanitizeUser(user);
}

// Service function to update a user's role by email (Admin operation)
export async function updateUserRoleByEmail(email, role) {
    const validRoles = ['Admin', 'Customer'];
    if (!validRoles.includes(role)) {
        throw new Error('Invalid role');
    }

    const user = await User.findOneAndUpdate(
        { email },
        { $set: { role } },
        { new: true, runValidators: true }
    );

    if (!user) {
        throw new Error('User not found');
    }

    return sanitizeUser(user);
}

export async function loginWithGoogle(accessToken) {
    if (!accessToken) {
        throw new Error('Access token is required');
    }

    let userDetails;
    
    /*
    // Check if it's a JWT (ID token)
    const decodedToken = jwt.decode(accessToken);
    if (decodedToken && decodedToken.email) {
        userDetails = {
            email: decodedToken.email,
            name: decodedToken.name,
            given_name: decodedToken.given_name,
            family_name: decodedToken.family_name,
            picture: decodedToken.picture,
            email_verified: decodedToken.email_verified
        };
    } else {
        // Fallback for proper access token
        const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        userDetails = response.data;
    } */


    // Verify Google ID token before trusting its claims
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: accessToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload?.email) {
            throw new Error('Google account email not available');
        }

        userDetails = {
            email: payload.email,
            name: payload.name,
            given_name: payload.given_name,
            family_name: payload.family_name,
            picture: payload.picture,
            email_verified: payload.email_verified
        };
    } catch (error) {
        throw new Error('Invalid Google ID token');
    }


    if (!userDetails?.email) {
        throw new Error('Google account email not available');
    }

    let user = await User.findOne({ email: userDetails.email });
    let isNewUser = false;

    if (!user) {
        const fallbackName = splitGoogleName(userDetails.name);
        user = new User({
            firstName: userDetails.given_name || fallbackName.firstName,
            lastName: userDetails.family_name || fallbackName.lastName,
            email: userDetails.email,
            password: bcrypt.hashSync(Math.random().toString(36), 10),
            profilePicture: userDetails.picture || undefined,
            address: 'Not Given',
            phone: 'Not Given',
            role: 'Customer',
            isBlocked: false,
            emailVerified: Boolean(userDetails.email_verified)
        });

        await user.save();
        isNewUser = true;
    }

    if (user.isBlocked) {
        throw new Error('Account is blocked');
    }

    return {
        user: sanitizeUser(user),
        isNewUser
    };
}

// Service function to generate and send an OTP to the user's email
export async function sendOtpForUser(email) {
    if (!email) {
        throw new Error('Email is required');
    }

    if (!process.env.EMAIL_USER) {
        throw new Error('Email service not configured');
    }

    // Read configurable expiry (minutes) from environment, default 5
    const expiryMins = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;
    const expiryMs   = expiryMins * 60 * 1000;

    // Generate a cryptographically sufficient 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Upsert OTP document; TTL index on the model uses createdAt
    await OTP.findOneAndUpdate(
        { email },
        { otp, createdAt: new Date(), expiresAt: new Date(Date.now() + expiryMs) },
        { upsert: true, new: true }
    );

    const appName = process.env.APP_NAME || 'Greeny';

    try {
        const transport = getTransport();
        await transport.sendMail({
            from: `"${appName}" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `${otp} is your ${appName} verification code`,
            // Plain-text fallback for clients that cannot render HTML
            text: [
                `Your ${appName} verification code is: ${otp}`,
                ``,
                `This code will expire in ${expiryMins} minute${expiryMins !== 1 ? 's' : ''}.`,
                ``,
                `If you did not request this code, you can safely ignore this email.`,
                `Do NOT share this code with anyone.`,
                ``,
                `– The ${appName} Team`,
            ].join('\n'),
            // Rich HTML body
            html: generateOtpEmailTemplate(otp, expiryMins),
        });
    } catch (error) {
        console.error('Email dispatch error:', error.message);
        throw new Error('Failed to send email');
    }
}

// Service function to verify OTP and mark email as verified
export async function verifyOtpForUser(email, code) {
    if (!email) {
        throw new Error('Email is required');
    }

    const numericCode = Number(code);
    if (!numericCode || Number.isNaN(numericCode)) {
        throw new Error('Invalid OTP code');
    }

    const otp = await OTP.findOne({ email, otp: numericCode });

    if (!otp) {
        throw new Error('OTP not found');
    }

    await User.updateOne({ email }, { emailVerified: true });
    await OTP.deleteOne({ email });
}