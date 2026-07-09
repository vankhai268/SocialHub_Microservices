import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn, Mail, Lock } from "lucide-react"; // Cần icon cho trực quan

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const result = await login(email, password);
        setIsLoading(false);

        if (result.success) {
            navigate("/"); // Đăng nhập xong, chuyển về Bảng tin
        } else {
            setError(result.message);
        }
    };

    return (
        <div className="relative min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-hidden">
            {/* Vòng sáng phát quang mờ ảo phía sau hộp đăng nhập */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[128px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-[128px] pointer-events-none"></div>

            {/* Hộp đăng nhập Glassmorphism */}
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 shadow-2xl z-10">
                <div className="text-center mb-8">
                    {/* Logo/Icon của mạng xã hội */}
                    <div className="inline-flex p-3 bg-gradient-to-tr from-violet-500 to-pink-500 rounded-2xl shadow-lg shadow-violet-500/30 mb-4 animate-pulse">
                        <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white tracking-tight">SocialHub</h2>
                    <p className="text-slate-400 mt-2 text-sm">Chào mừng bạn quay lại! Đăng nhập để kết nối.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm mb-6 text-center animate-shake">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Input */}
                    <div className="space-y-2">
                        <label className="text-slate-300 text-sm font-medium block">Địa chỉ Email</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                                <Mail className="w-5 h-5" />
                            </span>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@example.com"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Mật khẩu Input */}
                    <div className="space-y-2">
                        <label className="text-slate-300 text-sm font-medium block">Mật khẩu</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                                <Lock className="w-5 h-5" />
                            </span>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition duration-200"
                            />
                        </div>
                    </div>

                    {/* Nút đăng nhập Gradient */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-violet-500/20 transition duration-300 transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                        {isLoading ? "Đang xử lý..." : "Đăng Nhập"}
                    </button>
                </form>

                <div className="mt-8 text-center text-slate-400 text-sm">
                    Chưa có tài khoản?{" "}
                    <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium transition underline">
                        Đăng ký ngay
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
