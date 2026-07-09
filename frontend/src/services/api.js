import axios from "axios";

const api = axios.create({
    baseURL: "http://localhost:8080/api",
    headers: {
        "Content-Type": "application/json"
    }
})

// 1. Request Interceptor: Tự động đính Access Token vào Header nếu có
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("accessToken");
        if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 2. Response Interceptor: Tự động làm mới Token khi nhận lỗi 401
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Nếu mã lỗi 401 (Hết hạn token) và request chưa được thử lại lần nào
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {

                const refreshToken = localStorage.getItem("refreshToken");
                if (!refreshToken) throw new Error("No refresh token available");

                // Gọi API refresh token
                const res = await axios.post("http://localhost:8080/api/auth/refresh", {
                    refreshToken,
                });
                if (res.data && res.data.success) {
                    const { accessToken: newAccess, refreshToken: newRefresh } = res.data.tokens;

                    // Lưu token mới vào LocalStorage
                    localStorage.setItem("accessToken", newAccess);
                    localStorage.setItem("refreshToken", newRefresh);

                    // Cập nhật token mới vào request bị lỗi trước đó và chạy lại
                    originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
                    return api(originalRequest);
                }
            } catch (refreshError) {
                console.error("🔒 Hết hạn phiên đăng nhập (Refresh token expired):", refreshError);
                // Xóa token và buộc logout
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/login";
            }
        }
        return Promise.reject(error);
    }
);
export default api;
