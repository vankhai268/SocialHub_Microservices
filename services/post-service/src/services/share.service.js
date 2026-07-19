import { postRepository } from '../repositories/post.repository.js';
import { redisPublisher } from '../config/redis.js';
import { getUserProfile } from '../utils/api.js';
import { NotFoundError } from '../utils/error.js';
import prisma from '../config/db.js';

export const shareService = {
  sharePost: async ({ originalPostId, authorId, content, token }) => {
    // 1. Thử tìm bài viết trong bảng posts trước
    let originalPost = await postRepository.findById(originalPostId);
    let originalReel = null;

    if (!originalPost) {
      // 2. Nếu không thấy, thử tìm trong bảng reels
      originalReel = await prisma.reel.findUnique({ where: { id: originalPostId } });
      if (!originalReel) {
        throw new NotFoundError('Original post or reel not found');
      }
    }

    let newPost;
    if (originalPost) {
      const rootOriginalId = originalPost.is_shared && originalPost.original_post_id 
        ? originalPost.original_post_id 
        : originalPostId;

      newPost = await postRepository.createShared({
        authorId,
        content,
        isShared: true,
        originalPostId: rootOriginalId,
        visibility: originalPost.visibility
      });

      await postRepository.incrementShareCount(rootOriginalId);

      // Publish event
      const eventPayload = {
        eventId: newPost.id,
        userId: authorId,
        postId: rootOriginalId,
        postAuthorId: originalPost.author_id,
        occurredAt: new Date().toISOString()
      };
      await redisPublisher.publish('post.shared', JSON.stringify(eventPayload));
    } else {
      // 3. Xử lý chia sẻ thước phim Reel
      newPost = await prisma.post.create({
        data: {
          author_id: authorId,
          content: content || '',
          is_shared: true,
          original_reel_id: originalPostId,
          visibility: 'public'
        }
      });

      // Tăng share_count của Reel
      await prisma.reel.update({
        where: { id: originalPostId },
        data: {
          share_count: { increment: 1 }
        }
      });

      // Publish event
      const eventPayload = {
        eventId: newPost.id,
        userId: authorId,
        postId: originalPostId,
        postAuthorId: originalReel.author_id,
        occurredAt: new Date().toISOString()
      };
      await redisPublisher.publish('post.shared', JSON.stringify(eventPayload));
    }

    const author = await getUserProfile(authorId, token);
    
    return {
      ...newPost,
      author
    };
  }
};
