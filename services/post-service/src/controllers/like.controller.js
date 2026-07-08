import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { redisPublisher } from '../config/redis.js';

export const likePost = async (req, res) => {
  const { id: postId } = req.params;
  const userId = req.user.id;

  try {
    // Check if post exists
    const postQuery = `SELECT author_id, like_count FROM posts WHERE id = $1`;
    const postResult = await pool.query(postQuery, [postId]);
    
    if (postResult.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    const post = postResult.rows[0];

    // Try inserting like
    const likeQuery = `
      INSERT INTO likes (post_id, user_id) 
      VALUES ($1, $2)
      ON CONFLICT (post_id, user_id) DO NOTHING
      RETURNING id
    `;
    const likeResult = await pool.query(likeQuery, [postId, userId]);

    let currentLikeCount = post.like_count;
    
    // If inserted (was not liked before)
    if (likeResult.rows.length > 0) {
      const updatePostQuery = `
        UPDATE posts SET like_count = like_count + 1 WHERE id = $1 RETURNING like_count
      `;
      const updateResult = await pool.query(updatePostQuery, [postId]);
      currentLikeCount = updateResult.rows[0].like_count;

      // Publish event
      const eventPayload = {
        eventId: likeResult.rows[0].id,
        userId: userId,
        postId: postId,
        postAuthorId: post.author_id,
        occurredAt: new Date().toISOString()
      };
      await redisPublisher.publish('post.liked', JSON.stringify(eventPayload));
    }

    return successResponse(res, 200, { likeCount: currentLikeCount });
  } catch (error) {
    console.error('Like Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const unlikePost = async (req, res) => {
  const { id: postId } = req.params;
  const userId = req.user.id;

  try {
    // Check if post exists
    const postQuery = `SELECT like_count FROM posts WHERE id = $1`;
    const postResult = await pool.query(postQuery, [postId]);
    
    if (postResult.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    // Try deleting like
    const deleteLikeQuery = `
      DELETE FROM likes WHERE post_id = $1 AND user_id = $2 RETURNING id
    `;
    const deleteResult = await pool.query(deleteLikeQuery, [postId, userId]);

    let currentLikeCount = postResult.rows[0].like_count;

    // If deleted (was liked before)
    if (deleteResult.rows.length > 0) {
      const updatePostQuery = `
        UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1 RETURNING like_count
      `;
      const updateResult = await pool.query(updatePostQuery, [postId]);
      currentLikeCount = updateResult.rows[0].like_count;
    }

    return successResponse(res, 200, { likeCount: currentLikeCount });
  } catch (error) {
    console.error('Unlike Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};
