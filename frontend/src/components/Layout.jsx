import { Outlet, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import ChatWidget from "./ChatWidget"; // <-- Import thêm ChatWidget
import { Home, Users, User, LogOut, Radio, Bell, MessageSquare } from "lucide-react";

const Layout = () => {
    const { user, logout } = useAuth();
    const { unreadCount, toast } = useSocket();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate("/login");
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex">
            {/* Toast thông báo nổi thời gian thực */}
            {toast && (
                <div className="fixed top-6 right-6 z-50 flex items-center space-x-3 bg-white/90 backdrop-blur-xl border border-slate-200/80 px-5 py-4 rounded-2xl shadow-xl animate-bounce-short max-w-sm pointer-events-none">
                    <img
                        src={toast.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        className="w-10 h-10 rounded-full border border-slate-200"
                        alt="Avatar"
                    />
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-800 text-sm font-semibold">{toast.message}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Thông báo thời gian thực</p>
                    </div>
                </div>
            )}

            {/* Sidebar bên trái */}
            <aside className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col justify-between fixed h-screen">
                <div className="space-y-8">
                    {/* Brand Logo */}
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-gradient-to-tr from-violet-500 to-pink-500 rounded-xl">
                            <Radio className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-800">SocialHub</span>
                    </div>

                    {/* Navigation Links */}
                    <nav className="space-y-2">
                        <Link to="/" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-100 text-slate-700 transition group">
                            <Home className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
                            <span>Bảng tin</span>
                        </Link>
                        <Link to="/friends" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-100 text-slate-700 transition group">
                            <Users className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
                            <span>Bạn bè</span>
                        </Link>
                        <Link to="/messages" className="flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-100 text-slate-700 transition group">
                            <MessageSquare className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
                            <span>Tin nhắn</span>
                        </Link>
                        <Link to="/notifications" className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-100 text-slate-700 transition group">
                            <div className="flex items-center space-x-3">
                                <Bell className="w-5 h-5 text-slate-500 group-hover:text-violet-600" />
                                <span>Thông báo</span>
                            </div>
                            {unreadCount > 0 && (
                                <span className="bg-rose-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-md shadow-rose-500/20">
                                    {unreadCount}
                                </span>
                            )}
                        </Link>
                    </nav>
                </div>

                {/* Phần thông tin user đăng nhập ở đáy Sidebar */}
                <div className="pt-6 border-t border-slate-150 space-y-4">
                    <Link
                        to={`/profile/${user?.id}`}
                        className="flex items-center space-x-3 cursor-pointer group hover:bg-slate-100 p-2 rounded-xl transition"
                    >
                        <img
                            src={user?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                            alt="Avatar"
                            className="w-10 h-10 rounded-full border border-slate-200 object-cover"
                        />
                        <div className="truncate">
                            <p className="font-semibold text-sm text-slate-800 group-hover:text-violet-600 transition">{user?.displayName}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                    </Link>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center space-x-2 bg-rose-50 hover:bg-rose-100 text-rose-600 py-2.5 rounded-xl transition cursor-pointer text-sm border border-rose-200/50"
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
