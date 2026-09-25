import express from "express";
import * as productController from "../controllers/product.controller.js";
import upload from "../middlewares/multer.js";
import { authenticate, authorizeRoles } from "../middlewares/authMiddleware.js";

const productRoutes = express.Router();

productRoutes.post("/",
    authenticate,
    authorizeRoles("Admin"),
    upload.array("images", 5),
    verifyImageContent,
    productController.createProduct
);

productRoutes.get("/", productController.getAllProducts);
productRoutes.get("/search", productController.searchProducts);
productRoutes.get("/top", productController.getTopProducts);
productRoutes.get("/:id", productController.getSingleProduct);

productRoutes.put("/:id",
    authenticate, 
    authorizeRoles("Admin"), 
    upload.array("images", 5), productController.updateProduct
);

productRoutes.delete("/:id", 
    authenticate, 
    authorizeRoles("Admin"), 
    productController.deleteProduct
);

export default productRoutes;