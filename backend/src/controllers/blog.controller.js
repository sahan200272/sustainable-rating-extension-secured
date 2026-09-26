import * as blogService from '../services/blog.service.js';
import { testGeminiConnection, generateEducationGuide } from '../services/blog-ai.service.js';
import { blogCloudinaryUpload } from '../utils/cloudinaryUpload.js';

// Public Routes

// Get all published blogs (Public access)
export async function getAllBlogs(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const category = req.query.category;
        const search = req.query.search;

        // Call service to get only published blogs
        const result = await blogService.getPublishedBlogs({ page, limit, category, search });

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching blogs:", error);
        next(error);
    }
}

// Get blog by ID with access control (Public/Auth based on status)
export async function getBlogById(req, res, next) {
    try {
        const { id } = req.params;

        // Get blog by ID
        const blog = await blogService.getBlogById(id);

        // Access control logic
        if (blog.status === "PUBLISHED") {
            // Published blogs are accessible to everyone
            return res.status(200).json({ blog });
        }

        // For non-published blogs, require authentication
        if (!req.user) {
            return res.status(403).json({ 
                error: "Access denied. This blog is not published." 
            });
        }

        // Allow access if user is the author or admin
        const blogAuthorId = blog.author?._id ? blog.author._id.toString() : null;
        const isAdmin = req.user.role === "Admin" || req.user.role === "ADMIN";
        if ((blogAuthorId && req.user.id === blogAuthorId) || isAdmin) {
            return res.status(200).json({ blog });
        }

        // Otherwise deny access
        return res.status(403).json({ 
            error: "Access denied. This blog is not published." 
        });

    } catch (error) {
        console.error("Error fetching blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Auth Required Routes

// Create blog (Authenticated users)
export async function createBlog(req, res, next) {
    try {
        const { title, content, category, tags, imageUrl } = req.body;

        // Validate required fields
        if (!title || !content || !category) {
            return res.status(400).json({
                error: "Title, content, and category are required"
            });
        }

        // Parse tags sent through multipart/form-data
        let parsedTags = [];
        if (Array.isArray(tags)) {
            parsedTags = tags;
        } else if (typeof tags === "string" && tags.trim()) {
            try {
                const maybeJson = JSON.parse(tags);
                parsedTags = Array.isArray(maybeJson)
                    ? maybeJson
                    : tags.split(',').map((tag) => tag.trim()).filter(Boolean);
            } catch {
                parsedTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
            }
        }

        let finalImageUrl = imageUrl || "";
        let finalImageUrls = imageUrl ? [imageUrl] : [];

        // If image files are provided, upload all and use returned URLs
        if (req.files && req.files.length > 0) {
            const uploaded = await blogCloudinaryUpload(req.files);
            finalImageUrls = uploaded?.map((file) => file.url).filter(Boolean) || [];
            finalImageUrl = finalImageUrls[0] || "";
        }

        // Create blog with PENDING status
        const blog = await blogService.createBlog({
            title,
            content,
            category,
            tags: parsedTags,
            imageUrl: finalImageUrl,
            imageUrls: finalImageUrls
        }, req.user.id);

        res.status(201).json({
            message: "Blog created successfully and is pending approval",
            blog
        });
    } catch (error) {
        console.error("Error creating blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 409) {
            return res.status(409).json({ error: error.message });
        }
        next(error);
    }
}

// Get current user's submitted blogs (Authenticated users)
export async function getMyBlogs(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await blogService.getBlogsByAuthor(req.user.id, { page, limit });

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching user blogs:", error);
        next(error);
    }
}

// Update current user's own blog
export async function updateMyBlog(req, res, next) {
    try {
        const { id } = req.params;
        const { title, content, category, tags, imageUrl, imageUrls } = req.body;

        let parsedTags = undefined;
        if (tags !== undefined) {
            if (Array.isArray(tags)) {
                parsedTags = tags;
            } else if (typeof tags === "string") {
                try {
                    const maybeJson = JSON.parse(tags);
                    parsedTags = Array.isArray(maybeJson)
                        ? maybeJson
                        : tags.split(',').map((tag) => tag.trim()).filter(Boolean);
                } catch {
                    parsedTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
                }
            }
        }

        let finalImageUrls = undefined;
        let finalImageUrl = imageUrl;

        if (imageUrls !== undefined) {
            if (Array.isArray(imageUrls)) {
                finalImageUrls = imageUrls;
            } else if (typeof imageUrls === "string") {
                try {
                    const maybeJson = JSON.parse(imageUrls);
                    finalImageUrls = Array.isArray(maybeJson)
                        ? maybeJson
                        : imageUrls.split(',').map((url) => url.trim()).filter(Boolean);
                } catch {
                    finalImageUrls = imageUrls.split(',').map((url) => url.trim()).filter(Boolean);
                }
            }
        }

        // If new image files are uploaded, replace image urls with uploaded URLs
        if (req.files && req.files.length > 0) {
            const uploaded = await blogCloudinaryUpload(req.files);
            finalImageUrls = uploaded?.map((file) => file.url).filter(Boolean) || [];
            finalImageUrl = finalImageUrls[0] || "";
        } else if (Array.isArray(finalImageUrls)) {
            finalImageUrl = finalImageUrls[0] || "";
        }

        const blog = await blogService.updateOwnBlogService(id, req.user.id, {
            title,
            content,
            category,
            tags: parsedTags,
            imageUrl: finalImageUrl,
            imageUrls: finalImageUrls,
        });

        return res.status(200).json({
            message: "Blog updated successfully and sent for re-approval",
            blog,
        });
    } catch (error) {
        console.error("Error updating own blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 403) {
            return res.status(403).json({ error: error.message });
        }
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Delete current user's own blog
export async function deleteMyBlog(req, res, next) {
    try {
        const { id } = req.params;
        const result = await blogService.deleteOwnBlogService(id, req.user.id);
        return res.status(200).json(result);
    } catch (error) {
        console.error("Error deleting own blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 403) {
            return res.status(403).json({ error: error.message });
        }
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Admin Routes

// Get all blogs for admin dashboard
export async function adminGetBlogs(req, res, next) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search;

        // Call service for admin blog listing
        const result = await blogService.getBlogsForAdmin({ page, limit, status, search });

        res.status(200).json(result);
    } catch (error) {
        console.error("Error fetching blogs for admin:", error);
        next(error);
    }
}

// Approve blog (Admin only)
export async function adminApproveBlog(req, res, next) {
    try {
        const { id } = req.params;

        // Approve the blog
        const blog = await blogService.approveBlog(id, req.user.id);

        res.status(200).json({
            message: "Blog approved and published successfully",
            blog
        });
    } catch (error) {
        console.error("Error approving blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Reject blog (Admin only)
export async function adminRejectBlog(req, res, next) {
    try {
        const { id } = req.params;
        const { rejectionReason } = req.body;

        // Validate rejection reason
        if (!rejectionReason || rejectionReason.trim() === "") {
            return res.status(400).json({
                error: "Rejection reason is required"
            });
        }

        // Reject the blog
        const result = await blogService.rejectBlog(id, req.user.id, rejectionReason);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error rejecting blog:", error);
        if (error.status === 400) {
            return res.status(400).json({ error: error.message });
        }
        if (error.status === 404) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Legacy/Backward Compatibility Routes

// Create a new blog (Admin only) - Original method
export async function createBlogLegacy(req, res, next) {
    try {
        const { title, content, category, tags, imageUrl, isFeatured } = req.body;

        // Validate required fields
        if (!title || !content || !category) {
            return res.status(400).json({
                error: "Title, content, and category are required"
            });
        }

        // Call service
        const blog = await blogService.createBlogService({
            title,
            content,
            category,
            tags,
            author: req.user.id,
            imageUrl,
            isFeatured
        });

        res.status(201).json({
            message: "Blog created successfully",
            blog
        });
    } catch (error) {
        console.error("Error creating blog:", error);
        if (error.message.includes("Invalid category")) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
}

// Get all blogs (Legacy - reuses published blog listing)
export async function getAllBlogsLegacy(req, res, next) {
    return getAllBlogs(req, res, next);
}

// Get blog by ID (Legacy - reuses status-based access control)
export async function getBlogByIdLegacy(req, res, next) {
    return getBlogById(req, res, next);
}

// Update blog (Admin only)
export async function updateBlog(req, res, next) {
    try {
        const { id } = req.params;
        const { title, content, category, tags, imageUrl, isFeatured } = req.body;

        // Call service
        const blog = await blogService.updateBlogService(id, {
            title, content, category, tags, imageUrl, isFeatured
        });

        res.status(200).json({
            message: "Blog updated successfully",
            blog
        });
    } catch (error) {
        console.error("Error updating blog:", error);
        if (error.message === "Invalid blog ID" || error.message.includes("Invalid category")) {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === "Blog not found") {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Delete blog (Admin only)
export async function deleteBlog(req, res, next) {
    try {
        const { id } = req.params;

        // Call service
        const result = await blogService.deleteBlogService(id);

        res.status(200).json(result);
    } catch (error) {
        console.error("Error deleting blog:", error);
        if (error.message === "Invalid blog ID") {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === "Blog not found") {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Like blog (Authenticated users only)
export async function likeBlog(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Call service
        const blog = await blogService.likeBlogService(id, userId);

        res.status(200).json({
            message: "Blog liked successfully",
            blog
        });
    } catch (error) {
        console.error("Error liking blog:", error);
        if (
            error.message === "Invalid blog ID" ||
            error.message === "You have already liked this blog" ||
            error.message === "Only published blogs can be liked"
        ) {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === "Blog not found") {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Unlike blog (Authenticated users only)
export async function unlikeBlog(req, res, next) {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // Call service
        const blog = await blogService.unlikeBlogService(id, userId);

        res.status(200).json({
            message: "Blog unliked successfully",
            blog
        });
    } catch (error) {
        console.error("Error unliking blog:", error);
        if (
            error.message === "Invalid blog ID" ||
            error.message === "You have not liked this blog" ||
            error.message === "Only published blogs can be unliked"
        ) {
            return res.status(400).json({ error: error.message });
        }
        if (error.message === "Blog not found") {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
}

// Test AI API connection
export async function testAI(req, res, next) {
    try {
        const result = await testGeminiConnection();
        
        res.status(200).json({
            message: "AI API is working!",
            response: result
        });
    } catch (error) {
        console.error("Error testing AI API:", error);
        next(error);
    }
}

// Generate Education Guide from Blog Content (SDG-12 Only)
export async function generateBlogEducationGuide(req, res, next) {
    try {
        const { title, content } = req.body;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                error: "Title and content are required"
            });
        }

        // Generate education guide using AI service (includes SDG-12 validation)
        const educationGuide = await generateEducationGuide(title, content);

        res.status(200).json({
            message: "SDG-12 Education guide generated successfully",
            educationGuide,
            sdg12Focus: "This education guide focuses exclusively on UN SDG-12: Responsible Consumption and Production"
        });
    } catch (error) {
        console.error("Error generating education guide:", error);
        
        // Handle SDG-12 relevance rejection
        if (error.code === 'NOT_SDG12_RELEVANT') {
            return res.status(400).json({ 
                error: "Content Not Relevant to SDG-12",
                message: error.message,
                allowedTopics: [
                    "Responsible consumption patterns",
                    "Sustainable production practices",
                    "Circular economy and waste reduction",
                    "Eco-friendly products and materials",
                    "Resource efficiency",
                    "Sustainable supply chains",
                    "Green purchasing decisions"
                ],
                sdg12Info: "Education Hub only covers UN SDG-12: Responsible Consumption and Production topics"
            });
        }
        
        // Handle other validation errors
        if (error.message.includes('Title is required') || error.message.includes('Content is required')) {
            return res.status(400).json({ error: error.message });
        }
        
        if (error.message.includes('Invalid JSON response') || error.message.includes('Invalid response structure')) {
            return res.status(502).json({ 
                error: "AI service returned invalid response",
                details: error.message
            });
        }

        next(error);
    }
}