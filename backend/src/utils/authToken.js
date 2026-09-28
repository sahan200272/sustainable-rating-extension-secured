import jwt from 'jsonwebtoken';

// Used by both password login and Google login so they issue identical tokens
export function signAppToken(user) {
    return jwt.sign(
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
}
