import pool from '../config/db.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getUserProfile } from '../utils/api.js';

export const getFeed = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const cursor = req.query.cursor; // Timestamp or UUID
  const token = req.headers.authorization;
  const currentUserId = req.user.id;

  try {
    let query = '';
    let values = [];
    
    // Simplified feed: Since friend-service is not ready, 
    // we fetch all recent posts (or public ones)
    if (cursor) {
      query = `
        SELECT * FROM posts 
        WHERE id < $1 
        ORDER BY created_at DESC 
        LIMIT $2
      `;
      values = [cursor, limit];
    } else {
      query = `
        SELECT * FROM posts 
        ORDER BY created_at DESC 
        LIMIT $1 OFFSET $2
      `;
      values = [limit, (page - 1) * limit];
    }

    const result = await pool.query(query, values);
    
    const postsWithDetails = await Promise.all(result.rows.map(async (post) => {
      const author = await getUserProfile(post.author_id, token);
      
      const likeQuery = `SELECT id FROM likes WHERE post_id = $1 AND user_id = $2`;
      const likeResult = await pool.query(likeQuery, [post.id, currentUserId]);
      
      return {
        ...post,
        author,
        isLikedByMe: likeResult.rows.length > 0
      };
    }));

    const nextCursor = result.rows.length === limit ? result.rows[result.rows.length - 1].id : null;

    return successResponse(res, 200, postsWithDetails, { page, limit });
  } catch (error) {
    console.error('Get Feed Error:', error);
    return errorResponse(res, 500, 'Internal Server Error');
  }
};
