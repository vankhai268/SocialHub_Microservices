import { createContext, useContext, useState, useEffect, Children } from "react";

import api from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Kiểm tra phiên đăng nhập khi khởi chạy ứng dụng (F5 trang)
    useEffect(() => {

        const checkAuth = async () => {
            const token = localStorage.getItem("accessToken");
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                // Giải mã hoặc lấy thông tin profile của chính mình
                // Vì API Gateway đính token, ta có thể tạo 1 API lấy profile chính mình (ví dụ /users/search nhưng lọc theo chính mình, hoặc GET /api/users/:id)
                // Tạm thời để lấy dữ liệu test, ta giải mã JWT thủ công hoặc gọi API profile
                const payload = JSON.parse(atob(token.split(".")[1]));

                // Gọi API lấy thông tin đầy đủ của user
                const res = await api.get(`/users/${payload.id}`);
                if (res.data && res.data.success) {
                    setUser(res.data.user);
                    setIsAuthenticated(true);
                }

            } catch (err) {
                console.error("Xác thực thất bại khi tải trang:", err);
                logout();
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    // Hàm xử lý Đăng nhập
    const login = async (email, password) => {
        try {
            const res = await api.post("/auth/login", { email, password });
            if (res.data && res.data.success) {
                const { accessToken, refreshToken } = res.data.tokens;
                localStorage.setItem("accessToken", accessToken);
                localStorage.setItem("refreshToken", refreshToken);
                setUser(res.data.user);
                setIsAuthenticated(true);
                return { success: true };
            }
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || "Đăng nhập thất bại!",
            };
        }
    };

    // Hàm xử lý Đăng ký
    const register = async (email, password, displayName) => {
        try {
            const res = await api.post("/auth/register", { email, password, displayName });
            if (res.data && res.data.success) {

                const { accessToken, refreshToken } = res.data.tokens;
                localStorage.setItem("accessToken", accessToken);
                localStorage.setItem("refreshToken", refreshToken);
                setUser(res.data.user);
                setIsAuthenticated(true);
                return { success: true };
            }
        } catch (err) {
            return {
                success: false,
                message: err.response?.data?.message || "Đăng ký thất bại!",
            };
        }
    };

    // Hàm xử lý Đăng xuất
    const logout = async () => {

        try {
            await api.post("/auth/logout");

        } catch (err) {
            console.error("Lỗi khi gọi API đăng xuất:", err);

        } finally {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setUser(null);
            setIsAuthenticated(false);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);