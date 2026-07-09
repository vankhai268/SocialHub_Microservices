import { useState, useEffect } from "react";
import api from "../services/api";
import { Heart, MessageSquare, Share2, CornerUpRight } from "lucide-react";

const PostCard = ({ post, currentUserId }) => {
    const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
    const [likeCount, setLikeCount] = useState(post.like_count || 0);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    // 1. Lấy Presigned URL cho ảnh từ media-service thông qua Gateway
    useEffect(() => {
        const fetchImageUrl = async () => {
            if (post.media_ids && post.media_ids.length > 0) {
                setIsLoadingImage(true);
                try {
                    const mediaId = post.media_ids[0]; // Lấy ảnh đầu tiên
                    const res = await api.get(`/media/${mediaId}/url`);
                    if (res.data && res.data.url) {
                        setImageUrl(res.data.url);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy link ảnh:", error.message);
                } finally {
                    setIsLoadingImage(false);
                }
            }
        };
        fetchImageUrl();
    }, [post.media_ids]);

    // 2. Thao tác Thích / Bỏ Thích bài đăng
    const handleLike = async () => {
        try {
            // Gọi API toggle like sang post-service
            const res = await api.post(`/posts/${post.id}/like`);
            if (res.data && res.data.success) {
                setIsLiked(!isLiked);
                setLikeCount(prev => isLiked ? prev - 1 : prev + 1);
            }
        } catch (error) {
            console.error("❌ Lỗi Thích bài đăng:", error);
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg mb-6">
            {/* Header: Thông tin tác giả */}
            <div className="flex items-center space-x-3 mb-4">
                <img
                    src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                    alt="Author Avatar"
                    className="w-10 h-10 rounded-full border border-white/20"
                />
                <div>
                    <h4 className="font-semibold text-white text-sm">{post.author?.displayName || "Người dùng SocialHub"}</h4>
                    <p className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString()}</p>
                </div>
            </div>

            {/* Nội dung chữ */}
            <p className="text-slate-200 text-base mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Hình ảnh đính kèm */}
            {imageUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 mb-4 bg-slate-900/40">
                    <img src={imageUrl} alt="Post Attachment" className="w-full max-h-[450px] object-cover" />
                </div>
            )}
            {isLoadingImage && (
                <div className="h-48 bg-white/5 animate-pulse rounded-xl flex items-center justify-center text-slate-500 mb-4">
                    Đang tải hình ảnh...
                </div>
            )}

            {/* Footer hành động tương tác */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5 text-slate-400 text-sm">
                {/* Nút Thích */}
                <button
                    onClick={handleLike}
                    className={`flex items-center space-x-2 hover:text-rose-500 transition cursor-pointer ${isLiked ? "text-rose-500 font-bold" : ""}`}
                >
                    <Heart className={`w-5 h-5 ${isLiked ? "fill-rose-500" : ""}`} />
                    <span>{likeCount} Thích</span>
                </button>

                {/* Nút Bình luận */}
                <button className="flex items-center space-x-2 hover:text-violet-400 transition cursor-pointer">
                    <MessageSquare className="w-5 h-5" />
                    <span>{post.comment_count || 0} Bình luận</span>
                </button>

                {/* Nút Chia sẻ */}
                <button className="flex items-center space-x-2 hover:text-sky-400 transition cursor-pointer">
                    <Share2 className="w-5 h-5" />
                    <span>{post.share_count || 0} Chia sẻ</span>
                </button>
            </div>
        </div>
    );
};

export default PostCard;
