import { successResponse, errorResponse } from '../utils/response.js';
import { commentService } from '../services/comment.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const getPostComments = async (req, res) => {
  try {
    const result = await commentService.getPostComments({
      postId: req.params.id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      token: req.headers.authorization
    });
    return successResponse(res, 200, result.comments, { 
      page: parseInt(req.query.page) || 1, 
      limit: parseInt(req.query.limit) || 20, 
      total: result.total, 
      totalPages: result.totalPages 
    });
  } catch (error) {
    return handleError(res, error, 'Get Comments Error');
  }
};

export const createComment = async (req, res) => {
  try {
    const comment = await commentService.createComment({
      postId: req.params.id,
      authorId: req.user.id,
      content: req.body.content,
      token: req.headers.authorization
    });
    return successResponse(res, 201, comment);
  } catch (error) {
    return handleError(res, error, 'Create Comment Error');
  }
};

export const deleteComment = async (req, res) => {
  try {
    await commentService.deleteComment({
      commentId: req.params.commentId,
      postId: req.params.postId,
      userId: req.user.id
    });
    return successResponse(res, 200, null);
  } catch (error) {
    return handleError(res, error, 'Delete Comment Error');
  }
};
