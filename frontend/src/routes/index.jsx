import { lazy } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import PageTransition from "../components/layouts/PageTransition";
import LoginPage from "../pages/login/LoginPage";
import RegisterPage from "../pages/register/RegisterPage";
import HomePage from "../pages/home/HomePage";
import CreateBlogPage from "../pages/blog/CreateBlogPage";
import EditMyBlogPage from "../pages/blog/EditMyBlogPage";
import PublicBlogFeedPage from "../pages/blog/PublicBlogFeedPage";
import BlogDetailsPage from "../pages/blog/BlogDetailsPage";
import EducationHubPage from "../pages/blog/EducationHubPage";
import ProtectedRoute from "./ProtectedRoute";
import ProductsListPage from "../pages/product/ProductsListPage";
import ProductDetailsPage from "../pages/product/ProductDetailsPage";
import VerifyOtpPage from "../pages/login/VerifyOtpPage";
import OAuthCallbackPage from "../pages/login/OAuthCallbackPage";
import ComparePage from "../pages/compare/ComparePage";
import ComparisonHistoryPage from "../pages/compare/ComparisonHistoryPage";
import ComparisonDetailPage from "../pages/compare/ComparisonDetailPage";
import MyProfilePage from "../pages/profile/MyProfilePage";
import MyReviewsPage from "../pages/profile/MyReviewsPage";
import MyBlogsPage from "../pages/profile/MyBlogsPage";

// Layouts
import MainLayout from "../components/layouts/MainLayout";
import AdminLayout from "../components/layouts/AdminLayout";

// Lazy-loaded Admin pages
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AdminUsersPage = lazy(() => import("../pages/admin/AdminUsersPage"));
const AdminReviewsPage = lazy(() => import("../pages/admin/AdminReviewsPage"));
const AdminProductsPage = lazy(() => import("../pages/admin/AdminProductsPage"));
const AdminBlogModerationPage = lazy(() => import("../pages/admin/AdminBlogModerationPage"));
const AddProductPage = lazy(() => import("../pages/product/AddProductPage"));
const EditProductPage = lazy(() => import("../pages/product/EditProductPage"));
const ComparisonStatsPage = lazy(() => import("../pages/compare/ComparisonStatsPage"));

export default function AppRoutes() {
    const location = useLocation();

    return (
        <PageTransition>
        <Routes location={location}>
            {/* ── Auth pages — no layout ── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/oauth/callback" element={<OAuthCallbackPage />} />

            {/* ── Admin routes — AdminLayout only, ProtectedRoute at layout level ── */}
            <Route
                path="/admin"
                element={
                    <ProtectedRoute element={<AdminLayout />} requiredRole="Admin" />
                }
            >
                {/* /admin → /admin/dashboard */}
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users"     element={<AdminUsersPage />} />
                <Route path="reviews"   element={<AdminReviewsPage />} />
                <Route path="products"  element={<AdminProductsPage />} />
                <Route path="products/:id" element={<ProductDetailsPage />} />
                <Route path="add-product" element={<AddProductPage />} />
                <Route path="edit-product/:id" element={<EditProductPage />} />
                <Route path="compare-stats" element={<ComparisonStatsPage />} />
                <Route path="moderation" element={<AdminBlogModerationPage />} />
                 <Route path="moderation/:id" element={<BlogDetailsPage />} />
            </Route>

            {/* ── Public & authenticated pages — MainLayout (Navbar + Footer) ── */}
            <Route path="/" element={<MainLayout><HomePage /></MainLayout>} />
            <Route path="/blogs" element={<MainLayout><PublicBlogFeedPage /></MainLayout>} />
            <Route
                path="/blogs/:id"
                element={<MainLayout><ProtectedRoute element={<BlogDetailsPage />} /></MainLayout>}
            />
            <Route
                path="/blogs/:id/education-hub"
                element={<MainLayout><ProtectedRoute element={<EducationHubPage />} /></MainLayout>}
            />
            <Route
                path="/blogs/create"
                element={<MainLayout><ProtectedRoute element={<CreateBlogPage />} /></MainLayout>}
            />
            <Route
                path="/my-blogs/:id/edit"
                element={<MainLayout><ProtectedRoute element={<EditMyBlogPage />} /></MainLayout>}
            />

            {/* Product routes */}
            <Route path="/products" element={<MainLayout><ProductsListPage /></MainLayout>} />
            <Route path="/products/:id" element={<MainLayout><ProductDetailsPage /></MainLayout>} />

            {/* Comparison routes */}
            <Route path="/compare" element={<MainLayout><ComparePage /></MainLayout>} />
            <Route
                path="/compare/history"
                element={<MainLayout><ProtectedRoute element={<ComparisonHistoryPage />} /></MainLayout>}
            />
            <Route
                path="/compare/:id"
                element={<MainLayout><ProtectedRoute element={<ComparisonDetailPage />} /></MainLayout>}
            />

            {/* User profile routes */}
            <Route
                path="/profile"
                element={<MainLayout><ProtectedRoute element={<MyProfilePage />} /></MainLayout>}
            />
            <Route
                path="/my-reviews"
                element={<MainLayout><ProtectedRoute element={<MyReviewsPage />} /></MainLayout>}
            />
            <Route
                path="/my-blogs"
                element={<MainLayout><ProtectedRoute element={<MyBlogsPage />} /></MainLayout>}
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        </PageTransition>
    );
}
