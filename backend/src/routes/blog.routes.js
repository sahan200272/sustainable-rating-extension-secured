import express from 'express';
import { 
    createBlog, 
    getMyBlogs,
    updateMyBlog,
    deleteMyBlog,
    getAllBlogs, 
    getBlogById, 
    updateBlog, 
    deleteBlog, 
    likeBlog,
    unlikeBlog,
    adminGetBlogs,
    adminApproveBlog,
    adminRejectBlog,
    createBlogLegacy,
    getAllBlogsLegacy,
    getBlogByIdLegacy,
    testAI,
    generateBlogEducationGuide
} from '../controllers/blog.controller.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middlewares/authMiddleware.js';
import upload from '../middlewares/multer.js';

const blogRouter = express.Router();

// Admin check middleware (inline implementation as backup)
const isAdmin = (req, res, next) => {
    if (req.user?.role === "ADMIN") {
        return next();
    }
    return res.status(403).json({ message: "Forbidden" });
};

// =================== APPROVAL WORKFLOW ROUTES ===================

// Test route (use different path to avoid conflict)
blogRouter.get('/admin/test-ai', authenticate, authorizeRoles('Admin'), testAI); // GET /api/blogs/admin/test-ai

// AI-powered features
blogRouter.post('/generate-education-guide', generateBlogEducationGuide); // POST /api/blogs/generate-education-guide

// User routes (authentication required)
blogRouter.post('/', authenticate, upload.array('images', 5), createBlog); // POST /api/blogs - creates with PENDING status
blogRouter.get('/my-blogs', authenticate, getMyBlogs); // GET /api/blogs/my-blogs - includes PENDING/REJECTED/PUBLISHED for current user
blogRouter.patch('/my-blogs/:id', authenticate, upload.array('images', 5), updateMyBlog); // PATCH /api/blogs/my-blogs/:id - update own blog
blogRouter.delete('/my-blogs/:id', authenticate, deleteMyBlog); // DELETE /api/blogs/my-blogs/:id - delete own blog

// Public routes (no authentication required)
blogRouter.get('/', getAllBlogs); // GET /api/blogs - only published blogs
blogRouter.get('/:id', optionalAuthenticate, getBlogById); // GET /api/blogs/:id - access control based on status

// Admin routes (authentication + admin role required)
blogRouter.get('/admin/list', authenticate, authorizeRoles('Admin'), adminGetBlogs); // GET /api/blogs/admin/list
blogRouter.patch('/admin/:id/approve', authenticate, authorizeRoles('Admin'), adminApproveBlog); // PATCH /api/blogs/admin/:id/approve
blogRouter.patch('/admin/:id/reject', authenticate, authorizeRoles('Admin'), adminRejectBlog); // PATCH /api/blogs/admin/:id/reject

// =================== LEGACY ROUTES (BACKWARD COMPATIBILITY) ===================

// Legacy admin-only routes (keeping for backward compatibility)
blogRouter.post('/legacy', authenticate, authorizeRoles('Admin'), createBlogLegacy); // POST /api/blogs/legacy
blogRouter.put('/:id', authenticate, authorizeRoles('Admin'), updateBlog); // PUT /api/blogs/:id
blogRouter.delete('/:id', authenticate, authorizeRoles('Admin'), deleteBlog); // DELETE /api/blogs/:id

// Legacy public routes
blogRouter.get('/legacy/all', getAllBlogsLegacy); // GET /api/blogs/legacy/all - reuses published blog listing
blogRouter.get('/legacy/:id', optionalAuthenticate, getBlogByIdLegacy); // GET /api/blogs/legacy/:id - reuses status access control

// =================== ENGAGEMENT ROUTES ===================

// Authenticated user routes for blog engagement
blogRouter.post('/:id/like', authenticate, likeBlog); // POST /api/blogs/:id/like
blogRouter.post('/:id/unlike', authenticate, unlikeBlog); // POST /api/blogs/:id/unlike

export default blogRouter;