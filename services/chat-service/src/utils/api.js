import axios from 'axios';
import config from '../config/index.js';

/**
 * Fetch a batch of users from user-service
 * @param {Array<string>} userIds 
 * @returns {Promise<Array<Object>>}
 */
export const fetchUsersBatch = async (userIds) => {
  try {
    if (!userIds || userIds.length === 0) return [];
    
    // Call user-service batch endpoint
    const response = await axios.post(`${config.USER_SERVICE_URL}/api/users/batch`, { userIds });
    
    if (response.data && response.data.success) {
      return response.data.users;
    }
    return [];
  } catch (error) {
    console.error('❌ Error fetching users batch from user-service:', error.message);
    return [];
  }
};

/**
 * Fetch user details by ID from user-service
 * @param {string} userId 
 * @returns {Promise<Object|null>}
 */
export const fetchUserById = async (userId) => {
  try {
    const response = await axios.get(`${config.USER_SERVICE_URL}/api/users/${userId}`);
    if (response.data && response.data.success) {
      return response.data.user;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error fetching user ${userId} from user-service:`, error.message);
    return null;
  }
};

/**
 * Fetch presigned media URL from media-service
 * @param {string} mediaId 
 * @param {string} token - User's authorization token (Bearer ...)
 * @returns {Promise<string|null>}
 */
export const fetchMediaUrl = async (mediaId, token) => {
  try {
    if (!mediaId) return null;
    
    const response = await axios.get(`${config.MEDIA_SERVICE_URL}/media/${mediaId}/url`, {
      headers: {
        Authorization: token
      }
    });
    
    if (response.data && response.data.url) {
      return response.data.url;
    }
    return null;
  } catch (error) {
    console.error(`❌ Error fetching media URL for ${mediaId}:`, error.message);
    return null;
  }
};
