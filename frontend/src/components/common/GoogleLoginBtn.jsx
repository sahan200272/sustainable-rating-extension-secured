import { FcGoogle } from "react-icons/fc";
import { useLocation } from "react-router-dom";
import { BACKEND_URL } from "../../config/env";
import { saveReturnTo } from "../../utils/returnTo";

export default function GoogleLoginBtn() {
    const location = useLocation();

    const redirectTarget = location.state?.from?.pathname
        ? `${location.state.from.pathname}${location.state.from.search || ""}`
        : location.state?.redirectTo;

    const handleClick = () => {
        saveReturnTo(redirectTarget);
        // Full page navigation: the backend starts the flow and redirects to Google
        window.location.assign(`${BACKEND_URL}/api/auth/google`);
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="w-full flex items-center justify-center gap-3 py-3 lg:py-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-sm lg:text-base shadow-sm transition-colors duration-200"
        >
            <FcGoogle className="w-5 h-5" aria-hidden="true" />
            Continue with Google
        </button>
    );
}
