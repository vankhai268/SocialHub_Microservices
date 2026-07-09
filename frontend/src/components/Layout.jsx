import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Home, Users, User, LogOut, Radio } from "lucide-react";

const Layout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* Sidebar bên trái */}
            <aside className="w-64 bg-slate-900/50 backdrop-blur-md border-r border-white/10 p-6 flex flex-col justify-between fixed h-screen">
                <div className="space-y-8">
                    {/* Brand Logo */}
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-tr from-violet-500 to-pink-500 rounded-xl">
                            <Radio className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">SocialHub</span>
                    </div>

                    {/* Navigation Links */}
                    <nav className="space-y-2">
                        <Link to="/" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/5 transition group">
                            <Home className="w-5 h-5 text-slate-400 group-hover:text-violet-400" />
                            <span>Bảng tin</span>
                        </Link>
                        <Link to="/friends" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/5 transition group">
                            <Users className="w-5 h-5 text-slate-400 group-hover:text-violet-400" />
                            <span>Bạn bè</span>
                        </Link>
                        <Link to={`/profile/${user?.id}`} className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/5 transition group">
                            <User className="w-5 h-5 text-slate-400 group-hover:text-violet-400" />
                            <span>Trang cá nhân</span>
                        </Link>
                    </nav>
                </div>

                {/* Phần thông tin user đăng nhập ở đáy Sidebar */}
                <div className="pt-6 border-t border-white/10 space-y-4">
                    <div className="flex items-center space-x-3">
                        <img
                            src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full border border-white/20"
                        />
                        <div className="truncate">
                            <p className="font-semibold text-sm text-white">{user?.displayName}</p>
                            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-2.5 rounded-xl transition cursor-pointer text-sm"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            {/* Nội dung chính bên phải */}
            <main className="flex-1 ml-64 p-8 min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <Outlet /> {/* Nơi các trang con (Feed, Friends, Profile) hiển thị */}
                </div>
            </main>
        </div>
    );
};

export default Layout;
