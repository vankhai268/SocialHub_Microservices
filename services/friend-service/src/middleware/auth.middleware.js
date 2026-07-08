import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
    try {

        // Nếu có header x-user-id do API Gateway truyền xuống, sử dụng luôn
        const gatewayUserId = req.headers["x-user-id"];

        if (gatewayUserId) {
            req.user = { id: gatewayUserId };
            return next();
        }

        // Nếu chạy độc lập (Standalone), kiểm tra Authorization Header
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
            token = req.headers.authorization.split(" ")[1];
        }
        if (!token) {
            return res.status(401).json({ success: false, message: "Not authorized, token missing" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            id: decoded.id,
            jti: decoded.jti
        };

        next();

    } catch (error) {
        console.error("Error in middleware auth: ", error);
        return res.status(401).json({ success: false, message: "Not authorized, invalid token" });
    }
}