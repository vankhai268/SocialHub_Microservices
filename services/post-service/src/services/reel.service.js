import { postRepository } from '../repositories/post.repository.js';
import { likeRepository } from '../repositories/like.repository.js';
import { validateMediaIds, getUserProfile } from '../utils/api.js';
import { BadRequestError, NotFoundError } from '../utils/error.js';

export const reelService = {
  createReel: async ({ authorId, caption, mediaId, token }) => {
    if (!mediaId) {
      throw new BadRequestError('Reel must contain a video file');
    }

    // Xác thực mediaId tồn tại thông qua media-service
    const isValid = await validateMediaIds([mediaId], token);
    if (!isValid) {
      throw new BadRequestError('Video media item is invalid or not found');
    }

    const newReel = await postRepository.createReel({ authorId, caption, mediaId });
    return newReel;
  },

  getReelsFeed: async ({ currentUserId, page, limit, token }) => {
    const offset = (page - 1) * limit;
    
    const total = await postRepository.countReelsFeed();
    const reels = await postRepository.findReelsFeed(limit, offset);

    // Ghép thông tin tác giả (author) và kiểm tra Like
    const reelsWithDetails = await Promise.all(reels.map(async (reel) => {
      let author = { displayName: 'Người dùng SocialHub', avatarUrl: null };
      try {
        author = await getUserProfile(reel.author_id, token);
      } catch (err) {
        console.error(`❌ Lỗi lấy profile tác giả ${reel.author_id}:`, err.message);
      }

      const isLikedByMe = await likeRepository.checkUserLike(reel.id, currentUserId);

      return {
        ...reel,
        author,
        isLikedByMe
      };
    }));

    return {
      reels: reelsWithDetails,
      total,
      totalPages: Math.ceil(total / limit)
    };
  },

  getUserReels: async ({ userId, currentUserId, page, limit, token }) => {
    const offset = (page - 1) * limit;
    
    const total = await postRepository.countReelsByAuthorId(userId);
    const reels = await postRepository.findReelsByAuthorId(userId, limit, offset);
    
    let author = { displayName: 'Người dùng SocialHub', avatarUrl: null };
    try {
      author = await getUserProfile(userId, token);
    } catch (err) {
      console.error(`❌ Lỗi lấy profile tác giả ${userId}:`, err.message);
    }

    const reelsWithDetails = await Promise.all(reels.map(async (reel) => {
      const isLikedByMe = await likeRepository.checkUserLike(reel.id, currentUserId);
      return {
        ...reel,
        author,
        isLikedByMe
      };
    }));

    return {
      reels: reelsWithDetails,
      total,
      totalPages: Math.ceil(total / limit)
    };
  },

  incrementViewCount: async (id) => {
    const reel = await postRepository.findById(id);
    if (!reel || reel.type !== 'reel') {
      throw new NotFoundError('Reel not found');
    }

    return await postRepository.incrementViewCount(id);
  }
};
