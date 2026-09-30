import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { exchangeGoogleTicket, sendOtp } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { takeReturnTo } from "../../utils/returnTo";
import { GREENVY_LOGO_URL, GREENVY_LOGO_ALT } from "../../config/env";

function readTicketFromFragment() {
    return new URLSearchParams(window.location.hash.slice(1)).get("ticket");
}

export default function OAuthCallbackPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [ticket] = useState(readTicketFromFragment);
    const started = useRef(false);

    useEffect(() => {
        // StrictMode runs effects twice in development, and a ticket only works once
        if (started.current) return;
        started.current = true;

        // Remove the ticket from the address bar and browser history
        window.history.replaceState(window.history.state, "", window.location.pathname);

        const redirectTarget = takeReturnTo();

        const finishSignIn = async () => {
            if (!ticket) {
                toast.error("Google sign-in failed. Please try again.");
                navigate("/login", { replace: true });
                return;
            }

            try {
                const response = await exchangeGoogleTicket(ticket);
                login(response.user, response.token);

                if (!response.user.emailVerified) {
                    try {
                        await sendOtp();
                        toast.success("Please verify your email. A new OTP has been sent.");
                    } catch (otpError) {
                        console.error("OTP generation error:", otpError);
                        toast.error(otpError?.response?.data?.error || "Failed to automatically send OTP. Please click resend on the next page.");
                    }
                    navigate("/verify-otp", {
                        replace: true,
                        state: redirectTarget ? { redirectTo: redirectTarget } : undefined,
                    });
                    return;
                }

                toast.success("Welcome back!");
                if (redirectTarget) {
                    navigate(redirectTarget, { replace: true });
                } else {
                    navigate(response.user.role === "Admin" ? "/admin/dashboard" : "/", { replace: true });
                }
            } catch (error) {
                toast.error(error?.response?.data?.error || "Google sign-in failed. Please try again.");
                navigate("/login", { replace: true });
            }
        };

        finishSignIn();
    }, [ticket, login, navigate]);

    return (
        <div className="h-screen flex flex-col items-center justify-center gap-5 bg-linear-to-b from-emerald-50 to-white px-6">
            <img src={GREENVY_LOGO_URL} alt={GREENVY_LOGO_ALT} className="w-12 h-12 object-contain" />
            <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm lg:text-base text-gray-500">Signing you in with Google…</p>
        </div>
    );
}
