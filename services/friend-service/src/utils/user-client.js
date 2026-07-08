import axios from "axios";

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:5001";

export const fetchUserProfiles = async (userIds) => {
    if (!userIds || userIds.length === 0) return {};

    try {
        const response = await axios.post(`${USER_SERVICE_URL}/api/users/batch`, { userIds });

        if (response.data && response.data.success) {

            // Chuyển mảng thành dạng Map/Object để tra cứu nhanh hơn (O(1))
            // key: userId, value: { displayName, avatarUrl }
            const profileMap = {};
            response.data.users.forEach(user => {
                profileMap[user.id] = {
                    id: user.id,
                    displayName: user.displayName,
                    avatarUrl: user.avatarUrl
                };
            });
            return profileMap;
        }
        return {};

    } catch (error) {
        console.error("Error in call Batch User Profile: ", error);
        return {};

    }
}