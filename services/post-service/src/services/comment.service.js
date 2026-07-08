import { commentRepository } from '../repositories/comment.repository.js';
import { postRepository } from '../repositories/post.repository.js';
import { getUserProfile } from '../utils/api.js';
import { redisPublisher } from '../config/redis.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../utils/error.js';

export const commentService = {
  getPostComments: async ({ postId, page, limit, token }) => {
    const offset = (page - 1) * limit;
    
    const total = await commentRepository.countByPostId(postId);
    const comments = await commentRepository.findByPostId(postId, limit, offset);

    const commentsWithAuthor = await Promise.all(comments.map(async (comment) => {
      const author = await getUserProfile(comment.author_id, token);
      return {
        ...comment,
        author
      };
    }));

    return {
      comments: commentsWithAuthor,
      total,
      totalPages: Math.ceil(total / limit)
    };
  },

  createComment: async ({ postId, authorId, content, token }) => {
    if (!content) {
      throw new BadRequestError('Comment content cannot be empty');
    }

    const post = await postRepository.findById(postId);
    if (!post) {
      throw new NotFoundError('Post not found');
    }

    const newComment = await commentRepository.create(postId, authorId, content);
    await postRepository.incrementCommentCount(postId);

    const author = await getUserProfile(authorId, token);
    const commentWithAuthor = { ...newComment, author };

    const eventPayload = {
      eventId: newComment.id,
      userId: authorId,
      postId: postId,
      postAuthorId: post.author_id,
      commentId: newComment.id,
      occurredAt: new Date().toISOString()
    };
    await redisPublisher.publish('post.commented', JSON.stringify(eventPayload));

    return commentWithAuthor;
  },

  deleteComment: async ({ commentId, postId, userId }) => {
    const record = await commentRepository.getCommentWithPostAuthor(commentId, postId);
    
    if (!record) {
      throw new NotFoundError('Comment or Post not found');
    }

    if (record.comment_author_id !== userId && record.post_author_id !== userId) {
      throw new ForbiddenError('Not authorized to delete this comment');
    }

    await commentRepository.delete(commentId);
    await postRepository.decrementCommentCount(postId);
  }
};
