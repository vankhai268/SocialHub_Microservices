import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import PostCard from "../components/PostCard";
import { useAuth } from "../context/AuthContext";
import { Loader, Calendar, Mail, FileText } from "lucide-react";

const Profile = () => {
    const { id } = useParams(); // Lấy ID người dùng từ thanh địa chỉ /profile/:id
    const { user: loggedInUser } = useAuth();

    const [profileUser, setProfileUser] = useState(null);
    const [userPosts, setUserPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const isOwnProfile = loggedInUser?.id === id;

    useEffect(() => {
        const fetchProfileData = async () => {
            setIsLoading(true);
            try {
                // A. Lấy thông tin cá nhân của User từ user-service
                const userRes = await api.get(`/users/${id}`);
                if (userRes.data && userRes.data.success) {
                    setProfileUser(userRes.data.user);
                }

                // B. Lấy danh sách bài viết của User này từ post-service
                const postsRes = await api.get(`/posts/user/${id}`);
                if (postsRes.data && postsRes.data.success) {
                    setUserPosts(postsRes.data.data || []);
                }
            } catch (error) {
                console.error("❌ Lỗi lấy thông tin trang cá nhân:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfileData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-24">
                <Loader className="w-8 h-8 text-violet-500 animate-spin" />
            </div>
        );
    }

    if (!profileUser) {
        return (
            <div className="text-center py-12 text-slate-400">
                Không tìm thấy người dùng này hoặc tài khoản đã bị xóa.
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Thẻ thông tin tài khoản Glassmorphism */}
            <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 overflow-hidden shadow-xl">
                {/* Background phát quang trang cá nhân */}
                <div className="absolute -top-12 -right-12 w-64 h-64 bg-pink-500/10 rounded-full blur-[96px] pointer-events-none"></div>

                <div className="flex flex-col md:flex-row items-center md:items-start space-y-6 md:space-y-0 md:space-x-8">
                    {/* Avatar */}
                    <img
                        src={profileUser.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Profile Avatar"
                        className="w-28 h-28 rounded-full border-4 border-white/10 shadow-lg object-cover"
                    />

                    {/* Meta Info */}
                    <div className="flex-1 text-center md:text-left space-y-4">
                        <div>
                            <h2 className="text-3xl font-extrabold text-white tracking-tight">{profileUser.displayName}</h2>
                            <p className="text-slate-400 text-sm mt-1">ID người dùng: {profileUser.id}</p>
                        </div>

                        <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-6 text-sm text-slate-300">
                            <span className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-violet-400" />
                                <span>{profileUser.email}</span>
                            </span>
                            <span className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-pink-400" />
                                <span>Đã tham gia: {new Date(profileUser.createdAt || Date.now()).toLocaleDateString()}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Khu vực danh sách bài đăng */}
            <div className="space-y-6">
                <div className="flex items-center space-x-2 text-white border-b border-white/10 pb-3">
                    <FileText className="w-5 h-5 text-violet-400" />
                    <h3 className="text-xl font-bold">Bài đăng của {isOwnProfile ? "bạn" : profileUser.displayName}</h3>
                    <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-xs font-semibold text-slate-300">{userPosts.length}</span>
                </div>

                {userPosts.length > 0 ? (
                    <div className="space-y-6">
                        {userPosts.map((post) => (
                            <PostCard key={post.id} post={post} currentUserId={loggedInUser?.id} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/5 border border-white/10 rounded-2xl text-slate-400">
                        Chưa đăng tải bài viết nào.
                    </div>
                )}
            </div>
        </div>
    );
};

export default Profile;
