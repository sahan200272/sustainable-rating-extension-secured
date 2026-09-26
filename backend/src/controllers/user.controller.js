import * as userService from '../services/user.service.js';
import jwt from 'jsonwebtoken';

// Controller function to register a new user
export async function registerUser(req, res) {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                error: "All fields are required" 
            });
        }

        // Call service
        const user = await userService.registerUser(req.body);

        res.status(201).json({ 
            message: "User registered successfully",
            user
        });

    } catch (error) {
        console.error("Registration error:", error);
        
        if (error.message === 'User already exists') {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ 
            error: "User registration failed"
        });
    }
}

// Controller function to login a user
export async function loginUser(req, res) {
    try {
        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({ 
                error: "Email and password are required" 
            });
        }

        // Call service to authenticate user
        const user = await userService.loginUser(req.body);

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
                phone: user.phone,
                emailVerified: user.emailVerified
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            message: "Login Successful!",
            token: token,
            user: user
        });

    } catch (error) {
        console.error("Login error:", error);

        if (error.message === 'User not found') {
            return res.status(404).json({ error: "User not found" });
        }

        if (error.message === 'Account is blocked') {
            return res.status(403).json({ 
                error: "Your Account is blocked. Please contact support." 
            });
        }

        if (error.message === 'Invalid credentials') {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        res.status(500).json({ 
            error: "Login failed"
        });
    }
}

// Controller function to get logged-in user's own data
export async function getUser(req, res) {
    try {
        // req.user is guaranteed to exist because of authenticate middleware
        const user = await userService.getUserByEmail(req.user.email);

        res.status(200).json(user);

    } catch (error) {
        console.error("Get user error:", error);

        if (error.message === 'User not found') {
            return res.status(404).json({ 
                error: "User not found" 
            });
        }

        res.status(500).json({ 
            error: "Failed to retrieve user data" 
        });
    }
}

// Controller function to update the logged-in user's profile
export async function updateProfile(req, res) {
    try {
        const { firstName, lastName, phone, address, profilePicture } = req.body;

        const allowedUpdates = {};
        if (firstName !== undefined) allowedUpdates.firstName = firstName.trim();
        if (lastName  !== undefined) allowedUpdates.lastName  = lastName.trim();
        if (phone     !== undefined) allowedUpdates.phone     = phone.trim();
        if (address   !== undefined) allowedUpdates.address   = address.trim();
        if (profilePicture !== undefined) allowedUpdates.profilePicture = profilePicture.trim();

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({ error: "No valid fields provided to update" });
        }

        const updatedUser = await userService.updateUserByEmail(req.user.email, allowedUpdates);

        return res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (error) {
        console.error("Update profile error:", error);

        if (error.message === 'User not found') {
            return res.status(404).json({ error: "User not found" });
        }

        return res.status(500).json({ error: "Failed to update profile" });
    }
}

// Controller function for admin to get any user by email
export async function getUserByEmailAdmin(req, res) {
    try {
        const { email } = req.body;

        // Validate email
        if (!email) {
            return res.status(400).json({ 
                error: "Email is required" 
            });
        }

        // Call service to get user
        const user = await userService.getUserByEmail(email);

        res.status(200).json(user);

    } catch (error) {
        console.error("Get user by email error:", error);

        if (error.message === 'User not found') {
            return res.status(404).json({ 
                error: "User not found" 
            });
        }

        res.status(500).json({ 
            error: "Failed to retrieve user data" 
        });
    }
}

// Controller function to get all users (Admin only)
export async function getAllUsers(req, res) {
    try {
        const users = await userService.getAllUsers();
        res.status(200).json(users);

    } catch (error) {
        console.error("Get all users error:", error);
        res.status(500).json({ 
            error: "Failed to retrieve users" 
        });
    }
}

// Controller function for admin to block or unblock a user by email
export async function blockOrUnblockUser(req, res) {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({
                error: 'Email parameter is required'
            });
        }

        const result = await userService.toggleBlockUserByEmail(email);

        return res.status(200).json({
            message: `User has been ${result.isBlocked ? 'blocked' : 'unblocked'}`,
            user: result.user
        });
    } catch (error) {
        console.error('Block/unblock user error:', error);

        if (error.message === 'User not found') {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        return res.status(500).json({
            error: 'Failed to update user block status'
        });
    }
}

// Controller function to delete a user by email (Admin only)
export async function deleteUserByEmail(req, res) {
    try {
        const { email } = req.params;

        if (!email) {
            return res.status(400).json({ error: 'Email parameter is required' });
        }

        // Prevent admin from deleting themselves
        if (req.user.email === decodeURIComponent(email)) {
            return res.status(403).json({ error: 'You cannot delete your own account' });
        }

        const deletedUser = await userService.deleteUserByEmail(decodeURIComponent(email));

        return res.status(200).json({
            message: 'User deleted successfully',
            user: deletedUser
        });
    } catch (error) {
        console.error('Delete user error:', error);

        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(500).json({ error: 'Failed to delete user' });
    }
}

// Controller function to update a user's role (Admin only)
export async function updateUserRole(req, res) {
    try {
        const { email } = req.params;
        const { role } = req.body;

        if (!email || !role) {
            return res.status(400).json({ error: 'Email and role are required' });
        }

        const updatedUser = await userService.updateUserRoleByEmail(decodeURIComponent(email), role);

        return res.status(200).json({
            message: `User role updated to ${role}`,
            user: updatedUser
        });
    } catch (error) {
        console.error('Update role error:', error);

        if (error.message === 'User not found') {
            return res.status(404).json({ error: 'User not found' });
        }

        if (error.message === 'Invalid role') {
            return res.status(400).json({ error: 'Invalid role value' });
        }

        return res.status(500).json({ error: 'Failed to update user role' });
    }
}

// Controller function to login/register user via Google
export async function loginWithGoogle(req, res) {
    try {
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({
                error: 'Google access token is required'
            });
        }

        const { user, isNewUser } = await userService.loginWithGoogle(accessToken);

        const token = jwt.sign(
            {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                profilePicture: user.profilePicture,
                phone: user.phone,
                emailVerified: user.emailVerified
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        return res.status(200).json({
            message: isNewUser
                ? 'User registered and logged in successfully!'
                : 'Login Successful!',
            token,
            user
        });
    } catch (error) {
        console.error('Google login error:', error);

        if (error.message === 'Access token is required') {
            return res.status(400).json({ error: error.message });
        }

        if (error.message === 'Account is blocked') {
            return res.status(403).json({
                error: 'Your Account is blocked. Please contact support.'
            });
        }

        if (
            error.message === 'Google account email not available' ||
            error.message === 'Invalid Google ID token' ||
            error.response?.status === 401
        ) {
            return res.status(401).json({
                error: 'Invalid Google ID token'
            });
        }

        return res.status(500).json({
            error: 'Failed to Login with Google'
        });
    }
}

// Controller function to send OTP to authenticated user's email
export async function sendOTP(req, res) {
    try {
        await userService.sendOtpForUser(req.user.email);

        return res.status(200).json({
            message: 'OTP email sent successfully'
        });
    } catch (error) {
        console.error('Send OTP error:', error);

        if (error.message === 'Email service not configured') {
            return res.status(500).json({
                error: 'Email service is not configured on the server'
            });
        }

        return res.status(500).json({
            error: 'Failed to send OTP email'
        });
    }
}

// Controller function to verify OTP for authenticated user
export async function verifyOTP(req, res) {
    try {
        const { code } = req.body;

        await userService.verifyOtpForUser(req.user.email, code);

        return res.status(200).json({
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Verify OTP error:', error);

        if (error.message === 'Invalid OTP code') {
            return res.status(400).json({
                error: 'Invalid OTP. Please try again.'
            });
        }

        if (error.message === 'OTP not found') {
            return res.status(400).json({
                error: 'No OTP found. Please request a new one.'
            });
        }

        return res.status(500).json({
            error: 'Failed to verify OTP'
        });
    }
}
