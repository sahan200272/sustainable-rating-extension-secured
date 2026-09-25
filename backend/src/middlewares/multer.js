import multer from "multer";

const storage = multer.memoryStorage();

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

// Allowed file extensions
const ALLOWED_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
];

const fileFilter = (req, file, cb) => {
  const extension = file.originalname
    .toLowerCase()
    .substring(file.originalname.lastIndexOf("."));

  const isMimeTypeAllowed = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isExtensionAllowed = ALLOWED_EXTENSIONS.includes(extension);

  if (isMimeTypeAllowed && isExtensionAllowed) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, JPEG, PNG, and WEBP image files are allowed."));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: fileFilter
});

export default upload;