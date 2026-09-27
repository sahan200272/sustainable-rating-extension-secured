import Blog from '../models/blog.js';
import mongoose from 'mongoose';
import { moderateBlogContent } from './blog-ai.service.js';

/**
 * Safely escapes special regex characters in user input to prevent ReDoS and regex injection.
 */
export function escapeRegex(string) {
    if (typeof string !== 'string') return '';
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Service function to create a new blog
export async function createBlogService(blogData) {
    const { title, content, category, tags, author, imageUrl, imageUrls, isFeatured } = blogData;

    // Validate category
    const validCategories = ["Responsible Consumption", "Greenwashing", "Sustainable Brands"];
    if (!validCategories.includes(category)) {
        throw new Error("Invalid category. Must be one of: " + validCategories.join(", "));
    }

    // Create new blog
    const blog = new Blog({
        title,
        content,
        category,
        tags: tags || [],
        author,
        imageUrl: imageUrl || imageUrls?.[0] || "",
        imageUrls: imageUrls || (imageUrl ? [imageUrl] : []),
        isFeatured: isFeatured || false
    });

    await blog.save();

    // Populate author details before returning
    await blog.populate('author', 'firstName lastName email');

    return blog;
}

// New workflow functions

// 1) Create blog with workflow
export async function createBlog(data, userId) {
    const { title, content, category, tags, imageUrl, imageUrls } = data;

    // Validate category
    const validCategories = ["Responsible Consumption", "Greenwashing", "Sustainable Brands"];
    if (!validCategories.includes(category)) {
        const error = new Error("Invalid category. Must be one of: " + validCategories.join(", "));
        error.status = 400;
        throw error;
    }

    // Check for duplicate posts (same title by same author)
    const escapedTitle = escapeRegex(title.trim());
    const existingBlog = await Blog.findOne({
        title: { $regex: `^${escapedTitle}$`, $options: 'i' }, // Case-insensitive exact match
        author: userId
    });

    if (existingBlog) {
        const error = new Error("You have already submitted a blog with this title. Please choose a different title.");
        error.status = 409; // Conflict status code
        throw error;
    }

    // Perform AI moderation on content
    const moderationResult = await moderateBlogContent(title, content);

    // Create new blog with PENDING status and moderation results
    const blog = new Blog({
        title,
        content,
        category,
        tags: tags || [],
        author: userId,
        imageUrl: imageUrl || imageUrls?.[0] || "",
        imageUrls: imageUrls || (imageUrl ? [imageUrl] : []),
        status: "PENDING",
        moderationFlagged: moderationResult.flagged,
        moderationScore: moderationResult.score,
        moderationReasons: moderationResult.reasons
    });

    await blog.save();
    await blog.populate('author', 'firstName lastName email');

    return blog;
}

// 2) Get published blogs for public view
export async function getPublishedBlogs({ page = 1, limit = 10, category, search }) {
    const filter = { status: "PUBLISHED" };
    
    if (category) {
        filter.category = category;
    }
    
    if (search) {
        filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const blogs = await Blog.find(filter)
        .populate('author', 'firstName lastName')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        currentPage: page,
        totalPages,
        blogs
    };
}

// Get blogs submitted by a specific user (all statuses)
export async function getBlogsByAuthor(userId, { page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const filter = { author: userId };

    const blogs = await Blog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        currentPage: page,
        totalPages,
        blogs,
    };
}

// 3) Get blog by ID
export async function getBlogById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid blog ID");
        error.status = 400;
        throw error;
    }

    const blog = await Blog.findById(id)
        .populate('author', 'firstName lastName email profilePicture')
        .populate('approvedBy', 'firstName lastName');

    if (!blog) {
        const error = new Error("Blog not found");
        error.status = 404;
        throw error;
    }

    return blog;
}

// 4) Get blogs for admin with all statuses
export async function getBlogsForAdmin({ page = 1, limit = 10, status, search }) {
    const filter = {};
    
    if (status) {
        filter.status = status;
    }
    
    if (search) {
        filter.title = { $regex: escapeRegex(search), $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const blogs = await Blog.find(filter)
        .populate('author', 'firstName lastName email')
        .populate('approvedBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        currentPage: page,
        totalPages,
        blogs
    };
}

// 5) Approve blog
export async function approveBlog(id, adminId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid blog ID");
        error.status = 400;
        throw error;
    }

    const blog = await Blog.findById(id);

    if (!blog) {
        const error = new Error("Blog not found");
        error.status = 404;
        throw error;
    }

    if (blog.status === "PUBLISHED") {
        const error = new Error("Blog is already published");
        error.status = 400;
        throw error;
    }

    const now = new Date();
    blog.status = "PUBLISHED";
    blog.approvedBy = adminId;
    blog.approvedAt = now;
    blog.publishedAt = now;
    blog.rejectionReason = null;

    await blog.save();
    await blog.populate([
        { path: 'author', select: 'firstName lastName email' },
        { path: 'approvedBy', select: 'firstName lastName' }
    ]);

    return blog;
}

// 6) Reject blog
export async function rejectBlog(id, adminId, rejectionReason) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid blog ID");
        error.status = 400;
        throw error;
    }

    if (!rejectionReason || rejectionReason.trim() === "") {
        const error = new Error("Rejection reason is required");
        error.status = 400;
        throw error;
    }

    const blog = await Blog.findById(id).populate('author', 'firstName lastName email');

    if (!blog) {
        const error = new Error("Blog not found");
        error.status = 404;
        throw error;
    }

    if (blog.status === "REJECTED") {
        const error = new Error("Blog is already rejected");
        error.status = 400;
        throw error;
    }

    // Get admin details for the rejection notification
    const admin = await mongoose.model('User').findById(adminId).select('firstName lastName');

    // Create rejection notification data for the user
    const authorName = `${blog.author?.firstName || 'Unknown'} ${blog.author?.lastName || ''}`.trim();
    const authorEmail = blog.author?.email || null;

    const rejectionData = {
        blogTitle: blog.title,
        authorName,
        authorEmail,
        adminName: admin ? `${admin.firstName} ${admin.lastName}` : 'Admin',
        rejectionReason: rejectionReason.trim(),
        rejectedAt: new Date()
    };

    // TODO: Here you can add notification logic such as:
    // - Send email to author
    // - Create in-app notification
    // - Log to notification service
    console.log('Blog Rejection Notification:', {
        message: `Your blog post "${rejectionData.blogTitle}" has been rejected`,
        reason: rejectionData.rejectionReason,
        author: rejectionData.authorEmail,
        rejectedBy: rejectionData.adminName,
        date: rejectionData.rejectedAt
    });

    // Keep the blog and mark as rejected so user can view rejection reason
    blog.status = "REJECTED";
    blog.rejectionReason = rejectionReason.trim();
    blog.approvedBy = adminId;
    blog.approvedAt = new Date();
    blog.publishedAt = null;
    await blog.save();

    return {
        message: "Blog rejected successfully",
        rejectionData: {
            blogTitle: rejectionData.blogTitle,
            authorEmail: rejectionData.authorEmail,
            rejectionReason: rejectionData.rejectionReason,
            rejectedBy: rejectionData.adminName,
            rejectedAt: rejectionData.rejectedAt
        }
    };
}

// Service function to get all blogs with filters and pagination
export async function getAllBlogsService({ page = 1, limit = 10, category, search }) {
    // Build query filters
    const filter = {};
    
    if (category) {
        filter.category = category;
    }
    
    if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
            { title: { $regex: escapedSearch, $options: 'i' } },
            { content: { $regex: escapedSearch, $options: 'i' } }
        ];
    }

    const skip = (page - 1) * limit;

    // Get blogs with pagination
    const blogs = await Blog.find(filter)
        .populate('author', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // Get total count for pagination
    const total = await Blog.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    return {
        total,
        currentPage: page,
        totalPages,
        blogs
    };
}

// Service function to get blog by ID
export async function getBlogByIdService(id) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid blog ID");
    }

    // Find blog and increment views
    const blog = await Blog.findByIdAndUpdate(
        id,
        { $inc: { views: 1 } },
        { new: true }
    ).populate('author', 'firstName lastName email profilePicture');

    if (!blog) {
        throw new Error("Blog not found");
    }

    return blog;
}

// Service function to update blog
export async function updateBlogService(id, updateData) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid blog ID");
    }

    // Validate category if provided
    if (updateData.category) {
        const validCategories = ["Responsible Consumption", "Greenwashing", "Sustainable Brands"];
        if (!validCategories.includes(updateData.category)) {
            throw new Error("Invalid category. Must be one of: " + validCategories.join(", "));
        }
    }

    // Build update object (only include fields that are provided)
    const updateFields = {};
    if (updateData.title !== undefined) updateFields.title = updateData.title;
    if (updateData.content !== undefined) updateFields.content = updateData.content;
    if (updateData.category !== undefined) updateFields.category = updateData.category;
    if (updateData.tags !== undefined) updateFields.tags = updateData.tags;
    if (updateData.imageUrl !== undefined) updateFields.imageUrl = updateData.imageUrl;
    if (updateData.imageUrls !== undefined) updateFields.imageUrls = updateData.imageUrls;
    if (updateData.isFeatured !== undefined) updateFields.isFeatured = updateData.isFeatured;

    const blog = await Blog.findByIdAndUpdate(
        id,
        updateFields,
        { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email');

    if (!blog) {
        throw new Error("Blog not found");
    }

    return blog;
}

// Service function to update own blog (author only)
export async function updateOwnBlogService(id, userId, updateData) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid blog ID");
        error.status = 400;
        throw error;
    }

    const blog = await Blog.findById(id);
    if (!blog) {
        const error = new Error("Blog not found");
        error.status = 404;
        throw error;
    }

    if (blog.author.toString() !== userId.toString()) {
        const error = new Error("You can only update your own blog");
        error.status = 403;
        throw error;
    }

    // Validate category if provided
    if (updateData.category) {
        const validCategories = ["Responsible Consumption", "Greenwashing", "Sustainable Brands"];
        if (!validCategories.includes(updateData.category)) {
            const error = new Error("Invalid category. Must be one of: " + validCategories.join(", "));
            error.status = 400;
            throw error;
        }
    }

    const updateFields = {};
    if (updateData.title !== undefined) updateFields.title = updateData.title;
    if (updateData.content !== undefined) updateFields.content = updateData.content;
    if (updateData.category !== undefined) updateFields.category = updateData.category;
    if (updateData.tags !== undefined) updateFields.tags = updateData.tags;
    if (updateData.imageUrl !== undefined) updateFields.imageUrl = updateData.imageUrl;
    if (updateData.imageUrls !== undefined) updateFields.imageUrls = updateData.imageUrls;

    // Re-send for moderation when owner updates content
    if (updateFields.title !== undefined || updateFields.content !== undefined) {
        const nextTitle = updateFields.title ?? blog.title;
        const nextContent = updateFields.content ?? blog.content;

        const moderationResult = await moderateBlogContent(nextTitle, nextContent);
        updateFields.moderationFlagged = moderationResult.flagged;
        updateFields.moderationScore = moderationResult.score;
        updateFields.moderationReasons = moderationResult.reasons;
        updateFields.status = "PENDING";
        updateFields.approvedBy = null;
        updateFields.approvedAt = null;
        updateFields.publishedAt = null;
        updateFields.rejectionReason = null;
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
        id,
        updateFields,
        { new: true, runValidators: true }
    ).populate('author', 'firstName lastName email');

    return updatedBlog;
}

// Service function to delete blog
export async function deleteBlogService(id) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error("Invalid blog ID");
    }

    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) {
        throw new Error("Blog not found");
    }

    return { message: "Blog deleted successfully" };
}

// Service function to delete own blog (author only)
export async function deleteOwnBlogService(id, userId) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        const error = new Error("Invalid blog ID");
        error.status = 400;
        throw error;
    }

    const blog = await Blog.findById(id);
    if (!blog) {
        const error = new Error("Blog not found");
        error.status = 404;
        throw error;
    }

    if (blog.author.toString() !== userId.toString()) {
        const error = new Error("You can only delete your own blog");
        error.status = 403;
        throw error;
    }

    await Blog.findByIdAndDelete(id);
    return { message: "Blog deleted successfully" };
}

// Service function to like blog
export async function likeBlogService(blogId, userId) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        throw new Error("Invalid blog ID");
    }

    const blog = await Blog.findById(blogId);

    if (!blog) {
        throw new Error("Blog not found");
    }

    if (blog.status !== "PUBLISHED") {
        throw new Error("Only published blogs can be liked");
    }

    // Check if user has already liked the blog
    const hasLiked = blog.likedUsers.some((user) => user.equals(userId));

    if (hasLiked) {
        throw new Error("You have already liked this blog");
    }

    // Add user to likedUsers array and increment likes count
    blog.likedUsers.push(userId);
    blog.likes += 1;
    await blog.save();

    // Populate author details
    await blog.populate('author', 'firstName lastName');

    return blog;
}

// Service function to unlike blog
export async function unlikeBlogService(blogId, userId) {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(blogId)) {
        throw new Error("Invalid blog ID");
    }

    const blog = await Blog.findById(blogId);

    if (!blog) {
        throw new Error("Blog not found");
    }

    if (blog.status !== "PUBLISHED") {
        throw new Error("Only published blogs can be unliked");
    }

    // Check if user has liked the blog
    const hasLiked = blog.likedUsers.some((user) => user.equals(userId));

    if (!hasLiked) {
        throw new Error("You have not liked this blog");
    }

    // Remove user from likedUsers array and decrement likes count
    blog.likedUsers = blog.likedUsers.filter(user => !user.equals(userId));
    blog.likes = Math.max(0, blog.likes - 1); // Ensure likes never go below 0
    await blog.save();

    // Populate author details
    await blog.populate('author', 'firstName lastName');

    return blog;
}