import { postRepository } from '../repositories/post.repository.js';
import { redisPublisher } from '../config/redis.js';
import { getUserProfile } from '../utils/api.js';
import { NotFoundError } from '../utils/error.js';

export const shareService = {
  sharePost: async ({ originalPostId, authorId, content, token }) => {
    const originalPost = await postRepository.findById(originalPostId);

    if (!originalPost) {
      throw new NotFoundError('Original post not found');
    }

    const rootOriginalId = originalPost.is_shared && originalPost.original_post_id 
      ? originalPost.original_post_id 
      : originalPostId;

    const newPost = await postRepository.createShared({
      authorId,
      content,
      isShared: true,
      originalPostId: rootOriginalId,
      visibility: originalPost.visibility
    });

    await postRepository.incrementShareCount(rootOriginalId);

    const eventPayload = {
      eventId: newPost.id,
      userId: authorId,
      postId: rootOriginalId,
      postAuthorId: originalPost.author_id,
      occurredAt: new Date().toISOString()
    };
    await redisPublisher.publish('post.shared', JSON.stringify(eventPayload));

    const author = await getUserProfile(authorId, token);
    
    return {
      ...newPost,
      author
    };
  }
};
