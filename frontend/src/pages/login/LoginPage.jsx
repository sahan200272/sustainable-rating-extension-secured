import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { loginUser } from "../../services/userService";
import { sendOtp } from "../../services/authService";
import { useAuth } from "../../hooks/useAuth";
import { useForm } from "../../hooks/useForm";
import FormField from "../../components/common/FormField";
import GoogleLoginBtn from "../../components/common/GoogleLoginBtn";
import { GREENVY_LOGO_URL, GREENVY_LOGO_ALT } from "../../config/env";
import bgImage from "../../assets/images/backGround_image.png";

const INITIAL_VALUES = { email: "", password: "" };

const STATS = [
    { value: "10K+", label: "Products rated" },
    { value: "98%", label: "Eco accuracy" },
    { value: "4.8★", label: "Avg rating" },
];

const TRUST_ICONS = ["🌿", "🌍", "♻️"];

// Codes the backend sends back as ?oauth_error= after a failed Google sign-in
const OAUTH_ERROR_MESSAGES = {
    access_denied: "Google sign-in was cancelled.",
    account_blocked: "Your Account is blocked. Please contact support.",
    account_not_verified: "An account with this email already exists but isn't verified yet. Log in with your password and verify your email first, then you can use Google sign-in.",
    account_conflict: "This email is already linked to a different Google account.",
    email_not_verified: "Your Google email address isn't verified.",
    session_expired: "Your Google sign-in session expired. Please try again.",
    rate_limited: "Too many sign-in attempts. Please try again later.",
};

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { values, handleChange } = useForm(INITIAL_VALUES);

    const redirectTarget = location.state?.from?.pathname
        ? `${location.state.from.pathname}${location.state.from.search || ""}`
        : location.state?.redirectTo;

    const oauthError = searchParams.get("oauth_error");

    useEffect(() => {
        if (!oauthError) return;

        // hasOwn so a crafted ?oauth_error=constructor can't pull in Object.prototype members
        const message = Object.hasOwn(OAUTH_ERROR_MESSAGES, oauthError)
            ? OAUTH_ERROR_MESSAGES[oauthError]
            : "Google sign-in failed. Please try again.";

        // Fixed id so StrictMode's double effect doesn't stack two toasts
        toast.error(message, { id: "oauth-error", duration: 8000 });
        // Drop the param so a refresh doesn't show the error again
        setSearchParams({}, { replace: true });
    }, [oauthError, setSearchParams]);

    const handleOnSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await loginUser(values);
            login(response.user, response.token);
            
            if (!response.user.emailVerified) {
                try {
                    // Send OTP automatically when logging in unverified
                    console.log("Sending OTP...");
                    const otpResponse = await sendOtp();
                    console.log(otpResponse);
                    toast.success("Please verify your email. A new OTP has been sent.");
                } catch (otpError) {
                    console.error("OTP generation error:", otpError);
                    toast.error(otpError?.response?.data?.error || "Failed to automatically send OTP. Please click resend on the next page.");
                }
                navigate("/verify-otp", {
                    state: redirectTarget ? { from: location.state?.from, redirectTo: redirectTarget } : undefined,
                });
                return;
            }
            
            toast.success("Welcome back!");
            if (redirectTarget) {
                navigate(redirectTarget);
            } else {
                navigate(response.user.role === "Admin" ? "/admin/dashboard" : "/");
            }
        } catch (error) {
            toast.error(error?.response?.data?.error || "Login failed. Please check your credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex overflow-hidden">

            {/* LEFT PANEL */}
            <div
                className="hidden lg:flex lg:w-[55%] relative flex-col justify-between overflow-hidden"
                style={{ backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
            >
                <div className="absolute inset-0 bg-linear-to-br from-emerald-950/85 via-green-900/75 to-teal-800/65" />
                <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl" />
                <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-teal-400/10 blur-3xl" />

                {/* Brand */}
                <div className="relative z-10 px-10 py-8 flex items-center gap-3">
                    <img src={GREENVY_LOGO_URL} alt={GREENVY_LOGO_ALT} loading="lazy" className="w-11 h-11 lg:w-14 lg:h-14 object-contain drop-shadow-lg" />
                    <span className="text-white font-extrabold text-2xl lg:text-3xl tracking-tight drop-shadow-md">Greenvy</span>
                </div>

                {/* Headline + stats */}
                <div className="relative z-10 px-10 flex-1 flex flex-col justify-center gap-6 lg:gap-8">
                    <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-sm rounded-full px-4 py-2 w-fit">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-200 text-xs lg:text-sm font-semibold tracking-wide">
                            Responsible Consumption &amp; Production
                        </span>
                    </div>
                    <div>
                        <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.1] tracking-tight">
                            Welcome<br />
                            <span className="text-transparent bg-clip-text bg-linear-to-r from-emerald-300 to-teal-300">back.</span>
                        </h1>
                        <p className="mt-4 lg:mt-5 text-sm lg:text-base text-emerald-100/80 leading-relaxed max-w-sm lg:max-w-md">
                            Continue making sustainable choices that matter — for you and the planet.
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 lg:gap-4 max-w-sm lg:max-w-md">
                        {STATS.map(({ value, label }) => (
                            <div key={label} className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl px-3 py-4 lg:py-5 text-center">
                                <p className="text-xl lg:text-2xl font-black text-emerald-300">{value}</p>
                                <p className="text-[10px] lg:text-xs text-emerald-100/70 mt-1 leading-tight">{label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Trust row */}
                <div className="relative z-10 px-10 py-8 flex items-center gap-4">
                    <div className="flex -space-x-2">
                        {TRUST_ICONS.map((emoji, i) => (
                            <div key={i} className="w-9 h-9 rounded-full bg-emerald-700 border-2 border-emerald-400/30 flex items-center justify-center text-base">
                                {emoji}
                            </div>
                        ))}
                    </div>
                    <p className="text-emerald-200/70 text-xs lg:text-sm">Trusted by eco-conscious consumers worldwide</p>
                </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="flex-1 flex flex-col justify-center items-center bg-linear-to-b from-emerald-50 to-white px-6 lg:px-12 overflow-hidden">
                <div className="w-full max-w-md lg:max-w-lg">

                    {/* Mobile brand */}
                    <div className="flex lg:hidden items-center gap-2 mb-8">
                        <img src={GREENVY_LOGO_URL} alt={GREENVY_LOGO_ALT} loading="lazy" className="w-8 h-8 object-contain" />
                        <span className="font-extrabold text-emerald-800 text-lg tracking-tight">Greenvy</span>
                    </div>

                    <div className="mb-7 lg:mb-10">
                        <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 text-[11px] lg:text-xs font-bold px-3 py-1.5 rounded-full mb-3 uppercase tracking-widest">
                            <span>🌿</span> Sign in to your account
                        </div>
                        <h2 className="text-2xl lg:text-3xl xl:text-4xl font-black text-gray-900 leading-tight tracking-tight">
                            Good to see you <span className="text-emerald-600">again</span>
                        </h2>
                        <p className="text-sm lg:text-base text-gray-500 mt-1.5">
                            Don't have an account?{" "}
                            <Link to="/register" className="text-emerald-600 font-semibold hover:text-emerald-800 transition-colors">
                                Create one →
                            </Link>
                        </p>
                    </div>

                    <form onSubmit={handleOnSubmit} className="flex flex-col gap-4 lg:gap-5">
                        <FormField id="email" name="email" type="email" label="Email Address"
                            value={values.email} onChange={handleChange} required autoComplete="email" />

                        <FormField id="password" name="password" type="password" label="Password"
                            value={values.password} onChange={handleChange} required autoComplete="current-password" />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 lg:py-4 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm lg:text-base tracking-wide shadow-lg shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-1"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4 lg:h-5 lg:w-5" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Signing in…
                                </span>
                            ) : "Sign In →"}
                        </button>

                        <div className="relative flex items-center py-2">
                            <div className="grow border-t border-gray-200"></div>
                            <span className="shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">or</span>
                            <div className="grow border-t border-gray-200"></div>
                        </div>

                        <GoogleLoginBtn />

                        <p className="text-center text-xs lg:text-sm text-gray-400 mt-2">
                            🔒 Your data is safe. We never sell your information.
                        </p>
                    </form>
                </div>
            </div>
        </div>
    );
}
