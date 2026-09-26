import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./config/db.js";
import errorHandler from "./middlewares/errorHandler.js";
import userRoutes from "./routes/user.routes.js";
import blogRoutes from "./routes/blog.routes.js";
import productRoutes from "./routes/product.routes.js";
import comparisonRoutes from './routes/comparison.routes.js';
import reviewRoutes from "./routes/review.routes.js";

// Load environment variables first
dotenv.config();

// server connect wih mongoDB when node environment not in test environment
if(process.env.NODE_ENV !== "test"){
    connectDB();
};

const PORT = process.env.PORT;

const app = express();

// Middleware
//app.use(cors());
//app.use(express.json()); // IMPORTANT: Parse JSON bodies

// Security Middleware 
// Build an allow-list of trusted frontend origins
const allowedOrigins = [
    process.env.CLIENT_URL,
    process.env.FRONTEND_URL,
    process.env.ADDITIONAL_FRONTEND_URL
].filter(Boolean);

// Configure CORS to allow only trusted origins
const corsOptions = {
    origin: function (origin, callback) {

        // Allow requests without an Origin header
        // (e.g. Postman, curl, server-to-server requests).
        // These requests must still pass authentication.
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Reject untrusted browser origins
        callback(null, false);
    },

    // Enable only if your app uses cookies or
    // other credentialed cross-origin requests.
    credentials: false,

    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

    allowedHeaders: ["Content-Type", "Authorization"]
};

// Apply CORS configuration
app.use(cors(corsOptions));

// Add security-related HTTP headers
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"]
            }
        },

        // Prevent the application from being embedded
        // in frames or iframes.
        frameguard: {
            action: "deny"
        }
    })
);

// Parse JSON request bodies
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/products", productRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/comparisons", comparisonRoutes);

app.use("/", (req, res) => {
    res.send("backend is working");
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start the server
if (process.env.NODE_ENV !== "test") {
    app.listen(PORT, () => {
        console.log(`app is running on http://localhost:${PORT}`);
    });
}

export default app;