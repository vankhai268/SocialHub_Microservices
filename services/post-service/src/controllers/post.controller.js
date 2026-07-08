import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { validateMediaIds, getUserProfile } from '../utils/api.js';

export const createPost = async (req, res) => {
  const { content, mediaIds, visibility } = req.body;
  const authorId = req.user.id; // From auth middleware via gateway
  const token = req.headers.authorization;

  if (!content && (!mediaIds || mediaIds.length === 0)) {
    return errorResponse(res, 400, 'Post cannot be empty (no content and no media)');
  }

  try {
    // Validate mediaIds via internal call to media-service
    if (mediaIds && mediaIds.length > 0) {
      const isValid = await validateMediaIds(mediaIds, token);
      if (!isValid) {
        return errorResponse(res, 400, 'One or more media items are invalid or not found');
      }
    }

    const query = `
      INSERT INTO posts (author_id, content, media_ids, visibility)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [authorId, content || '', mediaIds || [], visibility || 'friends'];
    
    const result = await pool.query(query, values);
    const newPost = result.rows[0];

    // TODO: Invalidate feed cache for author's friends in Redis
    // We would fetch friends from friend-service, then DEL feed:{friendId}

    return successResponse(res, 201, newPost);
  } catch (error) {
    console.error('Create Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const getPostById = async (req, res) => {
  const { id } = req.params;
  const token = req.headers.authorization;
  const userId = req.user.id;

  try {
    const query = `SELECT * FROM posts WHERE id = $1`;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    const post = result.rows[0];

    // Fetch author info
    const author = await getUserProfile(post.author_id, token);

    // Check if liked by me
    const likeQuery = `SELECT id FROM likes WHERE post_id = $1 AND user_id = $2`;
    const likeResult = await pool.query(likeQuery, [id, userId]);
    const isLikedByMe = likeResult.rows.length > 0;

    const postWithAuthor = {
      ...post,
      author,
      isLikedByMe
    };

    return successResponse(res, 200, postWithAuthor);
  } catch (error) {
    console.error('Get Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const updatePost = async (req, res) => {
  const { id } = req.params;
  const { content, mediaIds } = req.body;
  const authorId = req.user.id;
  const token = req.headers.authorization;

  try {
    const checkQuery = `SELECT author_id FROM posts WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    if (checkResult.rows[0].author_id !== authorId) {
      return errorResponse(res, 403, 'Only the author can update this post');
    }

    if (mediaIds && mediaIds.length > 0) {
      const isValid = await validateMediaIds(mediaIds, token);
      if (!isValid) {
        return errorResponse(res, 400, 'One or more media items are invalid or not found');
      }
    }

    const updateQuery = `
      UPDATE posts 
      SET content = $1, media_ids = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [content || '', mediaIds || [], id]);

    return successResponse(res, 200, result.rows[0]);
  } catch (error) {
    console.error('Update Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const deletePost = async (req, res) => {
  const { id } = req.params;
  const authorId = req.user.id;

  try {
    const checkQuery = `SELECT author_id FROM posts WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return errorResponse(res, 404, 'Post not found');
    }

    if (checkResult.rows[0].author_id !== authorId) {
      return errorResponse(res, 403, 'Only the author can delete this post');
    }

    const deleteQuery = `DELETE FROM posts WHERE id = $1`;
    await pool.query(deleteQuery, [id]);

    return successResponse(res, 200, null);
  } catch (error) {
    console.error('Delete Post Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};

export const getUserPosts = async (req, res) => {
  const { userId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;
  const token = req.headers.authorization;
  const currentUserId = req.user.id;

  try {
    const countQuery = `SELECT COUNT(*) FROM posts WHERE author_id = $1`;
    const countResult = await pool.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT * FROM posts 
      WHERE author_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [userId, limit, offset]);

    const author = await getUserProfile(userId, token);

    // Fetch if liked by current user
    const postsWithDetails = await Promise.all(result.rows.map(async (post) => {
      const likeQuery = `SELECT id FROM likes WHERE post_id = $1 AND user_id = $2`;
      const likeResult = await pool.query(likeQuery, [post.id, currentUserId]);
      return {
        ...post,
        author,
        isLikedByMe: likeResult.rows.length > 0
      };
    }));

    const totalPages = Math.ceil(total / limit);

    return successResponse(res, 200, postsWithDetails, { page, limit, total, totalPages });
  } catch (error) {
    console.error('Get User Posts Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};
