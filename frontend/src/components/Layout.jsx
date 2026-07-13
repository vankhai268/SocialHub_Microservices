import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ChatWidget from "./ChatWidget"; // <-- Import thêm ChatWidget
import { Home, Users, User, LogOut, Radio, Bell } from "lucide-react";

const Layout = () => {
    const { user, logout } = useAuth();
    const { unreadCount, toast } = useSocket();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex">
            {/* Toast thông báo nổi thời gian thực */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 flex items-center space-x-3 bg-slate-900/90 backdrop-blur-xl border border-white/15 px-5 py-4 rounded-2xl shadow-2xl animate-bounce-short max-w-sm pointer-events-none">
                    <img
                        src={toast.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-10 h-10 rounded-full border border-white/10"
                        alt="Avatar"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold">{toast.message}</p>
                        <p className="text-slate-400 text-xs mt-0.5">Thông báo thời gian thực</p>
                    </div>
                </div>
            )}

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
                        <Link to="/notifications" className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition group">
                            <div className="flex items-center space-x-3">
                                <Bell className="w-5 h-5 text-slate-400 group-hover:text-violet-400" />
                                <span>Thông báo</span>
                            </div>
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-lg shadow-red-500/30">
                                    {unreadCount}
                                </span>
                            )}
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

            {/* Nội dung chính bên phải - Thêm mr-64 để tránh đè Sidebar phải */}
            <main className="flex-1 ml-64 mr-64 p-8 min-h-screen">
                <div className="max-w-4xl mx-auto">
                    <Outlet /> {/* Nơi các trang con hiển thị */}
                </div>
            </main>

            {/* Thanh chat sidebar bên phải và các ô chat nổi */}
            <ChatWidget />
        </div>
    );
};

export default Layout;
