import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { redisPublisher } from '../config/redis.js';
import { getUserProfile } from '../utils/api.js';

export const getPostComments = async (req, res) => {
  const { id: postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const token = req.headers.authorization;

  try {
    const countQuery = `SELECT COUNT(*) FROM comments WHERE post_id = $1`;
    const countResult = await pool.query(countQuery, [postId]);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT * FROM comments 
      WHERE post_id = $1 
      ORDER BY created_at ASC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [postId, limit, offset]);

    const commentsWithAuthor = await Promise.all(result.rows.map(async (comment) => {
      const author = await getUserProfile(comment.author_id, token);
      return {
        ...comment,
        author
      };
    }));

    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, commentsWithAuthor, { page, limit, total, totalPages });
  } catch (error) {
    console.error('Get Comments Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const createComment = async (req, res) => {
  const { id: postId } = req.params;
  const { content } = req.body;
  const authorId = req.user.id;
  const token = req.headers.authorization;

  if (!content) {
    return errorResponse(res, 400, 'Comment content cannot be empty');
  }

  try {
    // Check if post exists
    const postQuery = `SELECT author_id FROM posts WHERE id = $1`;
    const postResult = await pool.query(postQuery, [postId]);

    if (postResult.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    const postAuthorId = postResult.rows[0].author_id;

    // Create comment
    const insertQuery = `
      INSERT INTO comments (post_id, author_id, content) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const insertResult = await pool.query(insertQuery, [postId, authorId, content]);
    const newComment = insertResult.rows[0];

    // Update comment count on post
    const updatePostQuery = `
      UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1
    `;
    await pool.query(updatePostQuery, [postId]);

    // Fetch author details to return
    const author = await getUserProfile(authorId, token);
    const commentWithAuthor = { ...newComment, author };

    // Publish event
    const eventPayload = {
      eventId: newComment.id,
      userId: authorId,
      postId: postId,
      postAuthorId: postAuthorId,
      commentId: newComment.id,
      occurredAt: new Date().toISOString()
    };
    await redisPublisher.publish('post.commented', JSON.stringify(eventPayload));

    return successResponse(res, 201, commentWithAuthor);
  } catch (error) {
    console.error('Create Comment Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const deleteComment = async (req, res) => {
  const { postId, commentId } = req.params;
  const userId = req.user.id;

  try {
    // Check comment and post
    const query = `
      SELECT c.author_id AS comment_author_id, p.author_id AS post_author_id 
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = $1 AND c.post_id = $2
    `;
    const result = await pool.query(query, [commentId, postId]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Comment or Post not found');
    }

    const { comment_author_id, post_author_id } = result.rows[0];

    // Only comment author or post author can delete
    if (comment_author_id !== userId && post_author_id !== userId) {
      return errorResponse(res, 403, 'Not authorized to delete this comment');
    }

    // Delete comment
    const deleteQuery = `DELETE FROM comments WHERE id = $1`;
    await pool.query(deleteQuery, [commentId]);

    // Update comment count
    const updatePostQuery = `
      UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1
    `;
    await pool.query(updatePostQuery, [postId]);

    return successResponse(res, 200, null);
  } catch (error) {
    console.error('Delete Comment Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};
