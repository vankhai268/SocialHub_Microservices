import { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // <-- Import thêm Link để điều hướng
import api from "../services/api";
import { Heart, MessageSquare, Share2, Trash2, Send, Loader } from "lucide-react";
import ShareModal from "./ShareModal";

const PostCard = ({ post, currentUserId, onPostShared }) => {
    const [isLiked, setIsLiked] = useState(post.isLikedByMe || false);
    const [likeCount, setLikeCount] = useState(post.like_count || 0);
    const [commentCount, setCommentCount] = useState(post.comment_count || 0);
    const [shareCount, setShareCount] = useState(post.share_count || 0);
    const [imageUrl, setImageUrl] = useState("");
    const [isLoadingImage, setIsLoadingImage] = useState(false);

    // Trạng thái cho bài đăng được chia sẻ
    const [originalPost, setOriginalPost] = useState(null);
    const [originalImageUrl, setOriginalImageUrl] = useState("");
    const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);

    // Trạng thái cho Bình luận
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    // Trạng thái cho Share Modal
    const [showShareModal, setShowShareModal] = useState(false);

    // 1. Lấy Presigned URL cho ảnh đính kèm của bài viết
    useEffect(() => {
        let localUrl = "";
        const fetchImageUrl = async () => {
            if (post.media_ids && post.media_ids.length > 0) {
                setIsLoadingImage(true);
                try {
                    const mediaId = post.media_ids[0];
                    const res = await api.get(`/media/${mediaId}/url`);
                    if (res.data && res.data.url) {
                        const url = res.data.url;
                        const fullUrl = url.startsWith("http") ? url : `${api.defaults.baseURL}${url}`;
                        
                        // Tải hình ảnh dưới dạng blob thông qua Axios để đính kèm header ngrok-skip-browser-warning
                        const imgRes = await api.get(fullUrl, { responseType: "blob" });
                        localUrl = URL.createObjectURL(imgRes.data);
                        setImageUrl(localUrl);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy link ảnh bài đăng:", error.message);
                } finally {
                    setIsLoadingImage(false);
                }
            }
        };
        fetchImageUrl();

        return () => {
            if (localUrl) {
                URL.revokeObjectURL(localUrl);
            }
        };
    }, [post.media_ids]);

    // 2. Lấy thông tin bài gốc nhúng nếu là bài được chia sẻ (is_shared = true)
    useEffect(() => {
        const fetchOriginalPost = async () => {
            if (post.is_shared && post.original_post_id) {
                setIsLoadingOriginal(true);
                try {
                    const res = await api.get(`/posts/${post.original_post_id}`);
                    if (res.data && res.data.success) {
                        const origPostObj = res.data.data;
                        setOriginalPost(origPostObj);

                        // Nếu bài gốc có ảnh đính kèm, tiếp tục phân giải link ảnh
                        if (origPostObj.media_ids && origPostObj.media_ids.length > 0) {
                            const imgRes = await api.get(`/media/${origPostObj.media_ids[0]}/url`);
                            if (imgRes.data && imgRes.data.url) {
                                setOriginalImageUrl(imgRes.data.url);
                            }
                        }
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy thông tin bài đăng gốc:", error.message);
                } finally {
                    setIsLoadingOriginal(false);
                }
            }
        };
        fetchOriginalPost();
    }, [post.is_shared, post.original_post_id]);

    // 3. Tải danh sách bình luận khi mở khung accordion
    useEffect(() => {
        if (showComments) {
            const fetchComments = async () => {
                setIsLoadingComments(true);
                try {
                    const res = await api.get(`/posts/${post.id}/comments`);
                    if (res.data && res.data.success) {
                        setComments(res.data.data || []);
                    }
                } catch (error) {
                    console.error("❌ Lỗi lấy danh sách bình luận:", error.message);
                } finally {
                    setIsLoadingComments(false);
                }
            };
            fetchComments();
        }
    }, [showComments, post.id]);

    // 4. Thích / Bỏ thích bài đăng
    const handleLike = async () => {
        try {
            const res = await api.post(`/posts/${post.id}/like`);
            if (res.data && res.data.success) {
                setIsLiked(!isLiked);
                setLikeCount(prev => (isLiked ? prev - 1 : prev + 1));
            }
        } catch (error) {
            console.error("❌ Lỗi thích bài viết:", error);
        }
    };

    // 5. Gửi bình luận mới
    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;

        setIsSubmittingComment(true);
        try {
            const res = await api.post(`/posts/${post.id}/comments`, {
                content: commentText.trim()
            });

            if (res.data && res.data.success) {
                // Thêm trực tiếp vào danh sách bình luận hiển thị
                setComments(prev => [...prev, res.data.data]);
                setCommentText("");
                setCommentCount(prev => prev + 1);
            }
        } catch (error) {
            console.error("❌ Lỗi bình luận:", error);
            alert("Không thể gửi bình luận!");
        } finally {
            setIsSubmittingComment(false);
        }
    };

    // 6. Xóa bình luận
    const handleDeleteComment = async (commentId) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa bình luận này?")) return;

        try {
            const res = await api.delete(`/posts/${post.id}/comments/${commentId}`);
            if (res.data && res.data.success) {
                setComments(prev => prev.filter(c => c.id !== commentId && c._id !== commentId));
                setCommentCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error("❌ Lỗi khi xóa bình luận:", error);
            alert("Lỗi khi xóa bình luận!");
        }
    };

    // 7. Xử lý chia sẻ thành công từ ShareModal
    const handleShareSuccess = (newPost) => {
        setShareCount(prev => prev + 1);
        if (onPostShared) {
            onPostShared(newPost); // Thêm bài chia sẻ lên đầu Feed
        }
    };

    return (
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-lg mb-6">
            {/* Header: Thông tin tác giả - Click để về trang cá nhân */}
            <div className="flex items-center space-x-3 mb-4">
                <Link to={`/profile/${post.author_id}`} className="block group">
                    <img
                        src={post.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                        alt="Author Avatar"
                        className="w-10 h-10 rounded-full border border-white/20 object-cover group-hover:opacity-85 transition"
                    />
                </Link>
                <div>
                    <Link to={`/profile/${post.author_id}`} className="font-semibold text-white text-sm hover:text-violet-400 transition">
                        {post.author?.displayName || "Người dùng SocialHub"}
                    </Link>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(post.created_at || post.createdAt).toLocaleString()}</p>
                </div>
            </div>

            {/* Nội dung chữ */}
            <p className="text-slate-200 text-base mb-4 leading-relaxed whitespace-pre-wrap">{post.content}</p>

            {/* Ảnh đính kèm */}
            {imageUrl && (
                <div className="rounded-xl overflow-hidden border border-white/10 mb-4 bg-slate-955/60 flex justify-center">
                    <img src={imageUrl} alt="Post Attachment" className="w-full max-h-[450px] object-contain" />
                </div>
            )}
            {isLoadingImage && (
                <div className="h-48 bg-white/5 animate-pulse rounded-xl flex items-center justify-center text-slate-500 mb-4">
                    Đang tải hình ảnh...
                </div>
            )}

            {/* Nếu là bài chia sẻ, hiển thị bài gốc nhúng lồng bên trong (Nested Card) */}
            {post.is_shared && post.original_post_id && (
                <div className="border border-white/10 rounded-2xl p-4 bg-slate-950/40 mb-4 space-y-3 hover:border-violet-500/30 transition">
                    {isLoadingOriginal ? (
                        <div className="flex justify-center py-4">
                            <Loader className="w-5 h-5 text-violet-500 animate-spin" />
                        </div>
                    ) : originalPost ? (
                        <>
                            {/* Header bài gốc - Click để dẫn về trang cá nhân của tác giả gốc */}
                            <div className="flex items-center space-x-2.5">
                                <Link to={`/profile/${originalPost.author_id}`} className="block group">
                                    <img
                                        src={originalPost.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                        className="w-7 h-7 rounded-full border border-white/10 object-cover group-hover:opacity-85 transition"
                                        alt="Original Author"
                                    />
                                </Link>
                                <div>
                                    <Link to={`/profile/${originalPost.author_id}`} className="font-semibold text-white text-xs hover:text-violet-400 transition">
                                        {originalPost.author?.displayName}
                                    </Link>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{new Date(originalPost.created_at || originalPost.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            {/* Nội dung chữ bài gốc */}
                            <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap">{originalPost.content}</p>
                            {/* Ảnh đính kèm bài gốc */}
                            {originalImageUrl && (
                                <div className="rounded-xl overflow-hidden border border-white/5 bg-slate-950/60 max-w-md flex justify-center mt-2">
                                    <img src={originalImageUrl} className="w-full max-h-48 object-contain" alt="Original Attachment" />
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-500 text-xs italic">Bài viết gốc đã bị xóa hoặc không thể truy cập.</p>
                    )}
                </div>
            )}

            {/* Footer tương tác */}
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
                <button
                    onClick={() => setShowComments(!showComments)}
                    className={`flex items-center space-x-2 hover:text-violet-400 transition cursor-pointer ${showComments ? "text-violet-400 font-bold" : ""}`}
                >
                    <MessageSquare className="w-5 h-5" />
                    <span>{commentCount} Bình luận</span>
                </button>

                {/* Nút Chia sẻ */}
                <button
                    onClick={() => setShowShareModal(true)}
                    className="flex items-center space-x-2 hover:text-sky-400 transition cursor-pointer"
                >
                    <Share2 className="w-5 h-5" />
                    <span>{shareCount} Chia sẻ</span>
                </button>
            </div>

            {/* BẢNG BÌNH LUẬN ACCORDION */}
            {showComments && (
                <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-fadeIn">
                    {/* Ô nhập bình luận */}
                    <form onSubmit={handleAddComment} className="flex items-center space-x-3">
                        <input
                            type="text"
                            value={commentText}
                            onChange={(e) => setCommentText(e.target.value)}
                            placeholder="Viết bình luận..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition"
                        />
                        <button
                            type="submit"
                            disabled={isSubmittingComment || !commentText.trim()}
                            className="p-2 bg-violet-600 disabled:opacity-50 hover:bg-violet-700 text-white rounded-xl cursor-pointer transition"
                        >
                            {isSubmittingComment ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                        </button>
                    </form>

                    {/* Danh sách bình luận */}
                    {isLoadingComments ? (
                        <div className="flex justify-center py-4">
                            <Loader className="w-6 h-6 text-violet-500 animate-spin" />
                        </div>
                    ) : comments.length > 0 ? (
                        <div className="space-y-3.5 max-h-60 overflow-y-auto pr-1">
                            {comments.map((comment) => {
                                const cId = comment.id || comment._id;
                                const isCommentAuthor = comment.author_id === currentUserId;
                                const isPostAuthor = post.author_id === currentUserId;
                                
                                return (
                                    <div key={cId} className="flex items-start justify-between bg-white/5 rounded-2xl p-3 border border-white/5 group">
                                        <div className="flex items-start space-x-3">
                                            <img
                                                src={comment.author?.avatarUrl || "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix"}
                                                className="w-8 h-8 rounded-full border border-white/10 object-cover"
                                                alt="Commenter Avatar"
                                            />
                                            <div>
                                                <div className="flex items-center space-x-2">
                                                    <span className="font-bold text-white text-xs">{comment.author?.displayName}</span>
                                                    <span className="text-[10px] text-slate-500">{new Date(comment.created_at || comment.createdAt).toLocaleString()}</span>
                                                </div>
                                                <p className="text-slate-300 text-xs mt-1 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
                                            </div>
                                        </div>

                                        {/* Nút xóa bình luận (Chỉ hiển thị cho chủ bình luận hoặc chủ bài viết) */}
                                        {(isCommentAuthor || isPostAuthor) && (
                                            <button
                                                onClick={() => handleDeleteComment(cId)}
                                                className="p-1 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition cursor-pointer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-slate-500 text-xs py-4">Chưa có bình luận nào. Hãy gửi lời bình luận đầu tiên!</p>
                    )}
                </div>
            )}

            {/* POP-UP MODAL CHIA SẺ BÀI VIẾT */}
            {showShareModal && (
                <ShareModal
                    post={post}
                    onClose={() => setShowShareModal(false)}
                    onShareSuccess={handleShareSuccess}
                />
            )}
        </div>
    );
};

export default PostCard;
