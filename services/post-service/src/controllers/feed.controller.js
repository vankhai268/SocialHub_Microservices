import { successResponse, errorResponse } from '../utils/response.js';
import { feedService } from '../services/feed.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const getFeed = async (req, res) => {
  try {
    const result = await feedService.getFeed({
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      cursor: req.query.cursor,
      currentUserId: req.user.id,
      token: req.headers.authorization
    });
    
    return successResponse(res, 200, result.posts, { 
      page: parseInt(req.query.page) || 1, 
      limit: parseInt(req.query.limit) || 20 
    });
  } catch (error) {
    return handleError(res, error, 'Get Feed Error');
  }
};
