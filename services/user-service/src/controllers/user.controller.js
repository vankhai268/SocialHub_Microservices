import pool from "../config/db.js";
import redis from "../config/redis.js";

export const getUserById = async (req, res) => {
    const { id } = req.params;

    try {
        const cacheKey = `user:${id}`;

        // Check if it is in Redis cache
        const cachedUser = await redis.get(cacheKey);

        if (cachedUser) {
            return res.status(200).json({
                success: true,
                user: JSON.parse(cachedUser)
            });
        }

        const userResult = await pool.query(
            'SELECT id, email, display_name as "displayName", bio, avatar_url as "avatarUrl", created_at as "createdAt" FROM users WHERE id = $1',
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const user = userResult.rows[0];

        // Save to Redis cache with TTL 30 mins
        await redis.setex(cacheKey, 1800, JSON.stringify(user));

        return res.status(200).json({
            success: true,
            user
        });

    } catch (error) {
        console.error("Error in get user controller: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export const updateProfile = async (req, res) => {
    const { id } = req.params;
    const { name, bio, avatarUrl } = req.body;

    if (req.user.id !== id) {
        return res.status(403).json({
            success: false,
            message: "You can only update your own profile"
        });
    }

    try {
        const updateQuery = `
            UPDATE users 
            SET display_name = COALESCE($1, display_name),
                bio = COALESCE($2, bio),
                avatar_url = COALESCE($3, avatar_url),
                updated_at = NOW()
            WHERE id = $4
            RETURNING id, email, display_name as "displayName", bio, avatar_url as "avatarUrl", created_at as "createdAt"
        `;

        const result = await pool.query(
            updateQuery,
            [
                name !== undefined ? name : null,
                bio !== undefined ? bio : null,
                avatarUrl !== undefined ? avatarUrl : null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const updatedUser = result.rows[0];

        await redis.del(`user:${id}`);

        return res.status(200).json({
            success: true,
            user: updatedUser
        });

    } catch (error) {
        console.error("Error in update profile: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export const searchUsers = async (req, res) => {
    const { q, page = 1, limit = 20 } = req.query;

    if (!q || q.length < 2) {
        return res.status(400).json({
            success: false,
            message: "Search query must be at least 2 characters long"
        });
    }

    try {

        const offset = (page - 1) * limit;

        const countQuery = `
            SELECT COUNT(*) FROM users 
            WHERE display_name ILIKE $1
        `;

        const countResult = await pool.query(countQuery, [`%${q}%`]);
        const total = parseInt(countResult.rows[0].count);

        // Query to get pagination data
        const searchCtx = `
            SELECT id, email, display_name as "displayName", bio, avatar_url as "avatarUrl"
            FROM users 
            WHERE email ILIKE $1 OR display_name ILIKE $1
            LIMIT $2 OFFSET $3
        `;

        const searchResult = await pool.query(searchCtx, [`%${q}%`, limit, offset]);

        return res.status(200).json({
            success: true,
            data: searchResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Error in search user: ", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
}

export const batchGetUsers = async (req, res) => {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ success: false, message: "userIds array is required" });
    }

    try {
        const query = `
            SELECT id, email, display_name as "displayName", avatar_url as "avatarUrl"
            FROM users 
            WHERE id = ANY($1)
        `;

        const result = await pool.query(query, [userIds]);

        return res.status(200).json({
            success: true,
            users: result.rows
        })
    } catch (error) {
        console.error("Error in batch get users: ", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}