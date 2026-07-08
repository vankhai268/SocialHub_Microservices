import crypto from "crypto";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import { fetchUserProfiles } from "../utils/user-client.js";

export const sendRequest = async (req, res) => {

    const fromUserId = req.user.id;
    const { toUserId } = req.body;

    if (!toUserId) {
        return res.status(400).json({ success: false, message: "toUserId is required" });
    }
    if (fromUserId === toUserId) {
        return res.status(400).json({ success: false, message: "Cannot send friend request to self" });
    }

    try {
        // 1. Kiểm tra đã là bạn chưa
        const friendCheck = await pool.query(
            "SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2",
            [fromUserId, toUserId]
        );
        if (friendCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Already friends" });
        }

        // 2. Kiểm tra xem có lời mời nào đang chờ duyệt không (cả hai hướng)
        const requestCheck = await pool.query(
            "SELECT 1 FROM friend_requests WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)) AND status = 'pending'",
            [fromUserId, toUserId]
        );
        if (requestCheck.rows.length > 0) {
            return res.status(409).json({ success: false, message: "Friend request is already pending" });
        }
        // 3. Tạo lời mời kết bạn mới
        const insertQuery = `
            INSERT INTO friend_requests (from_user_id, to_user_id, status) 
            VALUES ($1, $2, 'pending') 
            RETURNING id, from_user_id as "fromUserId", to_user_id as "toUserId", status, created_at as "createdAt"
        `;
        const result = await pool.query(insertQuery, [fromUserId, toUserId]);
        const friendRequest = result.rows[0];

        // 4. Bắn sự kiện lên Redis Pub/Sub cho notification-service nhận
        const eventData = {
            eventId: crypto.randomUUID(),
            fromUserId,
            toUserId,
            requestId: friendRequest.id,
            occurredAt: new Date().toISOString()
        };
        await redis.publish("friend.request.sent", JSON.stringify(eventData));

        return res.status(201).json({ success: true, data: friendRequest });

    } catch (error) {
        console.error("❌ Lỗi gửi yêu cầu kết bạn:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }

}

export const acceptRequest = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const reqQuery = await pool.query("SELECT * FROM friend_requests WHERE id = $1", [id]);
        if (reqQuery.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Friend request not found" });
        }

        const request = reqQuery.rows[0];
        if (request.to_user_id !== userId) {
            return res.status(403).json({ success: false, message: "Only the recipient can accept this request" });
        }
        if (request.status !== "pending") {
            return res.status(400).json({ success: false, message: "Request is not pending" });
        }

        const fromUserId = request.from_user_id;

        // Bắt đầu Transaction
        await pool.query("BEGIN");

        // Cập nhật trạng thái
        await pool.query(
            "UPDATE friend_requests SET status = 'accepted', updated_at = NOW() WHERE id = $1",
            [id]
        );

        // Chèn 2 bản ghi quan hệ hai chiều
        await pool.query(
            "INSERT INTO friendships (user_id, friend_id) VALUES ($1, $2), ($2, $1) ON CONFLICT DO NOTHING",
            [fromUserId, userId]
        );

        await pool.query("COMMIT");

        // Xóa cache Redis của cả hai người
        await redis.del(`friends:${userId}`);
        await redis.del(`friends:${fromUserId}`);

        // Bắn sự kiện lên Redis Pub/Sub
        const eventData = {
            eventId: crypto.randomUUID(),
            fromUserId,
            toUserId: userId,
            occurredAt: new Date().toISOString()
        };

        await redis.publish("friend.request.accepted", JSON.stringify(eventData));
        return res.status(200).json({ success: true, message: "Friend request accepted" });

    } catch (error) {
        await pool.query("ROLLBACK");
        console.error("Error in accept friend request", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getPendingRequests = async (req, res) => {

    const userId = req.user.id;
    const { type, page = 1, limit = 20 } = req.query;

    if (!type || !["received", "sent"].includes(type)) {
        return res.status(400).json({ success: false, message: "Query type must be 'received' or 'sent'" });
    }

    try {
        const offset = (page - 1) * limit;
        let query, countQuery, targetField;

        if (type === "received") {
            query = `SELECT id, from_user_id as "fromUserId", to_user_id as "toUserId", status, created_at as "createdAt" 
                     FROM friend_requests WHERE to_user_id = $1 AND status = 'pending' LIMIT $2 OFFSET $3`;

            countQuery = `SELECT COUNT(*) FROM friend_requests WHERE to_user_id = $1 AND status = 'pending'`;
            targetField = "fromUserId"; // Cần lấy Profile của người gửi lời mời

        } else {
            query = `SELECT id, from_user_id as "fromUserId", to_user_id as "toUserId", status, created_at as "createdAt" 
                     FROM friend_requests WHERE from_user_id = $1 AND status = 'pending' LIMIT $2 OFFSET $3`;

            countQuery = `SELECT COUNT(*) FROM friend_requests WHERE from_user_id = $1 AND status = 'pending'`;
            targetField = "toUserId"; // Cần lấy Profile của người nhận lời mời
        }

        const countRes = await pool.query(countQuery, [userId]);
        const total = parseInt(countRes.rows[0].count);
        const dataRes = await pool.query(query, [userId, limit, offset]);
        const requests = dataRes.rows;

        // Thu gom IDs để gọi User Service
        const targetIds = requests.map(r => r[targetField]);
        const profiles = await fetchUserProfiles(targetIds);

        // Ghép profile thông tin người dùng tương ứng
        const data = requests.map(r => ({
            ...r,
            user: profiles[r[targetField]] || null
        }));

        return res.status(200).json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error("Error in get pending requests:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const listFriends = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;
    const cacheKey = `friends:${userId}`;

    try {
        let friendIds = [];

        // 1. Đọc từ Redis Cache (Sử dụng Set)
        const cachedIds = await redis.smembers(cacheKey);
        if (cachedIds && cachedIds.length > 0) {
            friendIds = cachedIds;
        } else {
            // Cache Miss: Query Database
            const result = await pool.query("SELECT friend_id FROM friendships WHERE user_id = $1", [userId]);
            friendIds = result.rows.map(row => row.friend_id);

            // Lưu danh sách vào Redis Cache dưới dạng Set và set TTL 15 phút
            if (friendIds.length > 0) {
                await redis.sadd(cacheKey, ...friendIds);
                await redis.expire(cacheKey, 900); // 15 phút = 900 giây
            }
        }

        const total = friendIds.length;
        const offset = (page - 1) * limit;

        // Phân trang danh sách ID trên Memory
        const paginatedIds = friendIds.slice(offset, offset + limit);

        // Gọi Batch User-Service lấy profile chi tiết
        const profiles = await fetchUserProfiles(paginatedIds);
        const data = paginatedIds.map(id => profiles[id] || { id, displayName: "Unknown User", avatarUrl: null });
        return res.status(200).json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / limit) }
        });

    } catch (error) {
        console.error("Error in get friend list", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const rejectRequest = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const reqQuery = await pool.query("SELECT * FROM friend_requests WHERE id = $1", [id]);

        if (reqQuery.rows.length === 0)
            return res.status(404).json({ success: false, message: "Request not found" });

        const request = reqQuery.rows[0];
        if (request.to_user_id !== userId)
            return res.status(403).json({ success: false, message: "Access forbidden" });

        if (request.status !== "pending")
            return res.status(400).json({ success: false, message: "Request is not pending" });

        await pool.query("UPDATE friend_requests SET status = 'rejected', updated_at = NOW() WHERE id = $1", [id]);
        return res.status(200).json({ success: true, message: "Friend request rejected" });

    } catch (error) {
        console.error("Error in reject friend request:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const removeFriend = async (req, res) => {
    const { friendId } = req.params;
    const userId = req.user.id;

    try {
        const check = await pool.query("SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2", [userId, friendId]);

        if (check.rows.length === 0)
            return res.status(404).json({ success: false, message: "Friendship not found" });

        await pool.query("BEGIN");
        await pool.query("DELETE FROM friendships WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)", [userId, friendId]);

        // Đồng thời xóa trạng thái request cũ nếu muốn họ gửi lại được sau này
        await pool.query("DELETE FROM friend_requests WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)", [userId, friendId]);
        await pool.query("COMMIT");
        await redis.del(`friends:${userId}`);
        await redis.del(`friends:${friendId}`);

        return res.status(200).json({ success: true, message: "Friend removed successfully" });
    } catch (error) {
        await pool.query("ROLLBACK");
        console.error("Error in remove friend:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Lấy danh sách ID bạn bè phục vụ nội bộ (Internal Endpoint cho post-service)
export const getInternalFriendIds = async (req, res) => {
    const { userId } = req.params;
    const cacheKey = `friends:${userId}`;

    try {
        // Kiểm tra trong Redis cache trước
        let friendIds = await redis.smembers(cacheKey);
        if (!friendIds || friendIds.length === 0) {
            const result = await pool.query("SELECT friend_id FROM friendships WHERE user_id = $1", [userId]);
            friendIds = result.rows.map(row => row.friend_id);
            if (friendIds.length > 0) {
                await redis.sadd(cacheKey, ...friendIds);
                await redis.expire(cacheKey, 900);
            }
        }

        return res.status(200).json({ success: true, friendIds });

    } catch (error) {
        console.error("Error in get internal friend IDs:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const checkFriendshipStatus = async (req, res) => {
    const userId = req.user.id;
    const { userId: targetUserId } = req.params;

    if (userId === targetUserId) {
        return res.status(200).json({ success: true, status: "none", requestId: null });
    }

    try {
        // 1. Kiểm tra trong bảng friendships xem đã là bạn bè chưa
        const friendCheck = await pool.query(
            "SELECT 1 FROM friendships WHERE user_id = $1 AND friend_id = $2",
            [userId, targetUserId]
        );

        if (friendCheck.rows.length > 0) {
            return res.status(200).json({ success: true, status: "friends", requestId: null });
        }

        // 2. Kiểm tra xem có lời mời nào đang chờ duyệt giữa hai người không
        const requestCheck = await pool.query(
            `SELECT id, from_user_id as "fromUserId" FROM friend_requests 
            WHERE ((from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)) 
            AND status = 'pending'`,
            [userId, targetUserId]
        );
        if (requestCheck.rows.length > 0) {
            const request = requestCheck.rows[0];
            const status = request.fromUserId === userId ? "pending_sent" : "pending_received";
            return res.status(200).json({ success: true, status, requestId: request.id });
        }

        // 3. Nếu chưa có gì, trả về none
        return res.status(200).json({ success: true, status: "none", requestId: null });

    } catch (error) {
        console.error("Error in check friendship status:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getMutualFriends = async (req, res) => {
    const userId = req.user.id;
    const { userId: targetUserId } = req.params;

    try {
        // Lấy danh sách ID bạn chung bằng cách giao tập hợp trong SQL (INTERSECT)
        const mutualQuery = `
            SELECT friend_id FROM friendships WHERE user_id = $1
            INTERSECT
            SELECT friend_id FROM friendships WHERE user_id = $2
        `;

        const result = await pool.query(mutualQuery, [userId, targetUserId]);
        const mutualIds = result.rows.map(row => row.friend_id);
        if (mutualIds.length === 0) {
            return res.status(200).json({ success: true, mutualFriends: [], count: 0 });
        }

        // Gọi Batch User-Service để lấy profile của các bạn chung này
        const profiles = await fetchUserProfiles(mutualIds);
        const mutualFriends = mutualIds.map(id => profiles[id] || { id, displayName: "Unknown User", avatarUrl: null });
        return res.status(200).json({
            success: true,
            mutualFriends,
            count: mutualFriends.length
        });

    } catch (error) {
        console.error("Error in get mutual friends:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getFriendSuggestions = async (req, res) => {
    const userId = req.user.id;
    const { limit = 10 } = req.query;
    const maxLimit = Math.min(parseInt(limit), 30);

    try {
        // Câu SQL tìm "Bạn của bạn" và sắp xếp theo số lượng bạn chung giảm dần
        const suggestionQuery = `
            SELECT f2.friend_id as "suggestedUserId", COUNT(f2.user_id) as "mutualFriendCount"
            FROM friendships f1
            JOIN friendships f2 ON f1.friend_id = f2.user_id
            WHERE f1.user_id = $1
              AND f2.friend_id != $1  -- Không gợi ý chính mình
              AND f2.friend_id NOT IN (
                  SELECT friend_id FROM friendships WHERE user_id = $1  -- Loại trừ người đã kết bạn
              )
              AND f2.friend_id NOT IN (
                  -- Loại trừ người đang có lời mời kết bạn chờ duyệt (cả hai hướng)
                  SELECT from_user_id FROM friend_requests WHERE to_user_id = $1 AND status = 'pending'
                  UNION
                  SELECT to_user_id FROM friend_requests WHERE from_user_id = $1 AND status = 'pending'
              )
            GROUP BY f2.friend_id
            ORDER BY "mutualFriendCount" DESC, RANDOM()  -- Ưu tiên bạn chung nhiều hơn, ngẫu nhiên hóa nếu bằng nhau
            LIMIT $2
        `;

        const result = await pool.query(suggestionQuery, [userId, maxLimit]);
        const suggestionRows = result.rows;
        if (suggestionRows.length === 0) {
            return res.status(200).json({ success: true, suggestions: [] });
        }

        if (suggestionRows.length === 0) {
            return res.status(200).json({ success: true, suggestions: [] });
        }
        // Lấy danh sách IDs gợi ý để gọi User Service lấy profile
        const suggestedIds = suggestionRows.map(row => row.suggestedUserId);
        const profiles = await fetchUserProfiles(suggestedIds);

        // Ghép thông tin profile cùng số lượng bạn chung
        const suggestions = suggestionRows.map(row => {
            const profile = profiles[row.suggestedUserId] || { id: row.suggestedUserId, displayName: "Unknown User", avatarUrl: null };
            return {
                ...profile,
                mutualFriendCount: parseInt(row.mutualFriendCount)
            };
        });

        return res.status(200).json({ success: true, suggestions });

    } catch (error) {
        console.error("Error in get friend suggestions:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}