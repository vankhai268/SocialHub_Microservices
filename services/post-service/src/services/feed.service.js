import { feedRepository } from '../repositories/feed.repository.js';
import { likeRepository } from '../repositories/like.repository.js';
import { getUserProfile } from '../utils/api.js';

export const feedService = {
  getFeed: async ({ page, limit, cursor, currentUserId, token }) => {
    let posts = [];
    
    if (cursor) {
      posts = await feedRepository.getRecentPostsWithCursor(cursor, limit);
    } else {
      const offset = (page - 1) * limit;
      posts = await feedRepository.getRecentPostsWithOffset(limit, offset);
    }

    const postsWithDetails = await Promise.all(posts.map(async (post) => {
      const author = await getUserProfile(post.author_id, token);
      const isLikedByMe = await likeRepository.checkUserLike(post.id, currentUserId);
      
      return {
        ...post,
        author,
        isLikedByMe
      };
    }));

    const nextCursor = posts.length === limit ? posts[posts.length - 1].id : null;

    return {
      posts: postsWithDetails,
      nextCursor
    };
  }
};
