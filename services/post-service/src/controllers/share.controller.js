import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { redisPublisher } from '../config/redis.js';
import { getUserProfile } from '../utils/api.js';

export const sharePost = async (req, res) => {
  const { id: originalPostId } = req.params;
  const { content } = req.body;
  const authorId = req.user.id;
  const token = req.headers.authorization;

  try {
    // Check if original post exists
    const checkQuery = `SELECT author_id, visibility, is_shared, original_post_id FROM posts WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [originalPostId]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, 'Original post not found');
    }

    const originalPost = checkResult.rows[0];

    // Determine actual original post ID (if sharing a shared post, link to the root original)
    const rootOriginalId = originalPost.is_shared && originalPost.original_post_id 
      ? originalPost.original_post_id 
      : originalPostId;

    // Create shared post
    const insertQuery = `
      INSERT INTO posts (author_id, content, is_shared, original_post_id, visibility)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [
      authorId, 
      content || '', 
      true, 
      rootOriginalId, 
      originalPost.visibility // Inherit visibility from original
    ]);
    const newPost = insertResult.rows[0];

    // Update share count on the root original post
    const updateQuery = `UPDATE posts SET share_count = share_count + 1 WHERE id = $1`;
    await pool.query(updateQuery, [rootOriginalId]);

    // Publish event
    const eventPayload = {
      eventId: newPost.id,
      userId: authorId,
      postId: rootOriginalId,
      postAuthorId: originalPost.author_id, // Author of the post being immediately shared
      occurredAt: new Date().toISOString()
    };
    await redisPublisher.publish('post.shared', JSON.stringify(eventPayload));

    // Fetch author details
    const author = await getUserProfile(authorId, token);
    const newPostWithAuthor = { ...newPost, author };

    return successResponse(res, 201, newPostWithAuthor);
  } catch (error) {
    console.error('Share Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};
