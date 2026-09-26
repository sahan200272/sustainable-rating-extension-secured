import { jest } from "@jest/globals";

// Mock Blog model
const mockBlogModel = jest.fn();
mockBlogModel.findOne = jest.fn();
mockBlogModel.find = jest.fn();
mockBlogModel.countDocuments = jest.fn();
mockBlogModel.findById = jest.fn();

jest.unstable_mockModule("../../models/blog.js", () => ({
  default: mockBlogModel
}));

// Mock blog AI moderation service
const mockModerateBlogContent = jest.fn();
jest.unstable_mockModule("../../services/blog-ai.service.js", () => ({
  moderateBlogContent: mockModerateBlogContent
}));

const blogService = await import("../../services/blog.service.js");

// Reset mocks before each test case.
describe("Blog Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test blog creation behavior.
  describe("createBlog", () => {
    test("should create a pending blog with moderation results", async () => {
      const userId = "507f1f77bcf86cd799439011";

      mockBlogModel.findOne.mockResolvedValue(null);
      mockModerateBlogContent.mockResolvedValue({
        flagged: false,
        score: 0,
        reasons: []
      });

      const saveMock = jest.fn().mockResolvedValue(true);
      const populateMock = jest.fn().mockResolvedValue(true);

      mockBlogModel.mockImplementation((payload) => ({
        ...payload,
        save: saveMock,
        populate: populateMock
      }));

      const result = await blogService.createBlog(
        {
          title: "Sustainable Living Tips",
          content: "Use reusable products every day.",
          category: "Responsible Consumption",
          tags: ["eco", "daily"],
          imageUrls: ["https://img.test/a.jpg"]
        },
        userId
      );

      expect(mockBlogModel.findOne).toHaveBeenCalled();
      expect(mockModerateBlogContent).toHaveBeenCalledWith(
        "Sustainable Living Tips",
        "Use reusable products every day."
      );
      expect(saveMock).toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalledWith("author", "firstName lastName email");
      expect(result.status).toBe("PENDING");
      expect(result.author).toBe(userId);
      expect(result.imageUrl).toBe("https://img.test/a.jpg");
      expect(result.imageUrls).toEqual(["https://img.test/a.jpg"]);
    });

    test("should throw conflict error when duplicate title exists for same author", async () => {
      mockBlogModel.findOne.mockResolvedValue({ _id: "existingBlogId" });

      await expect(
        blogService.createBlog(
          {
            title: "Duplicate Title",
            content: "same title",
            category: "Greenwashing"
          },
          "507f1f77bcf86cd799439012"
        )
      ).rejects.toThrow("You have already submitted a blog with this title");

      expect(mockModerateBlogContent).not.toHaveBeenCalled();
    });

    test("should safely handle regex metacharacters and ReDoS patterns without hanging", async () => {
      const userId = "507f1f77bcf86cd799439015";
      const redosPayload = "((((((((((a+)+)+)+)+)+)+)+)+)+)$";

      mockBlogModel.findOne.mockResolvedValue(null);
      mockModerateBlogContent.mockResolvedValue({
        flagged: false,
        score: 0,
        reasons: []
      });

      const saveMock = jest.fn().mockResolvedValue(true);
      const populateMock = jest.fn().mockResolvedValue(true);

      mockBlogModel.mockImplementation((payload) => ({
        ...payload,
        save: saveMock,
        populate: populateMock
      }));

      const startTime = Date.now();
      const result = await blogService.createBlog(
        {
          title: redosPayload,
          content: "Valid blog content for testing",
          category: "Responsible Consumption"
        },
        userId
      );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
      expect(mockBlogModel.findOne).toHaveBeenCalledWith({
        title: {
          $regex: `^\\(\\(\\(\\(\\(\\(\\(\\(\\(\\(a\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\+\\)\\$$`,
          $options: "i"
        },
        author: userId
      });
      expect(result.status).toBe("PENDING");
    }, 3000);
  });

  // Test published blog listing with filters.
  describe("getPublishedBlogs", () => {
    test("should return paginated published blogs", async () => {
      const mockBlogs = [{ title: "A" }, { title: "B" }];

      const queryChain = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockBlogs)
      };

      mockBlogModel.find.mockReturnValue(queryChain);
      mockBlogModel.countDocuments.mockResolvedValue(2);

      const result = await blogService.getPublishedBlogs({
        page: 1,
        limit: 10,
        category: "Responsible Consumption",
        search: "eco"
      });

      expect(mockBlogModel.find).toHaveBeenCalledWith({
        status: "PUBLISHED",
        category: "Responsible Consumption",
        title: { $regex: "eco", $options: "i" }
      });
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
      expect(result.blogs).toEqual(mockBlogs);
    });
  });

  // Test admin approval flow for blogs.
  describe("approveBlog", () => {
    test("should approve and publish a pending blog", async () => {
      const saveMock = jest.fn().mockResolvedValue(true);
      const populateMock = jest.fn().mockResolvedValue(true);

      const pendingBlog = {
        _id: "507f1f77bcf86cd799439013",
        status: "PENDING",
        save: saveMock,
        populate: populateMock
      };

      mockBlogModel.findById.mockResolvedValue(pendingBlog);

      const result = await blogService.approveBlog(
        "507f1f77bcf86cd799439013",
        "507f1f77bcf86cd799439014"
      );

      expect(mockBlogModel.findById).toHaveBeenCalledWith("507f1f77bcf86cd799439013");
      expect(result.status).toBe("PUBLISHED");
      expect(result.approvedBy).toBe("507f1f77bcf86cd799439014");
      expect(saveMock).toHaveBeenCalled();
      expect(populateMock).toHaveBeenCalled();
    });

    test("should throw for invalid blog id", async () => {
      await expect(blogService.approveBlog("invalid-id", "admin")).rejects.toThrow("Invalid blog ID");
      expect(mockBlogModel.findById).not.toHaveBeenCalled();
    });
  });
});