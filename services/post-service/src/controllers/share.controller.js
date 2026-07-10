import { successResponse, errorResponse } from '../utils/response.js';
import { shareService } from '../services/share.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const sharePost = async (req, res) => {
  try {
    const newSharedPost = await shareService.sharePost({
      originalPostId: req.params.id,
      authorId: req.user.id,
      content: req.body.content,
      token: req.headers.authorization
    });
    return successResponse(res, 201, newSharedPost);
  } catch (error) {
    return handleError(res, error, 'Share Post Error');
  }
};
