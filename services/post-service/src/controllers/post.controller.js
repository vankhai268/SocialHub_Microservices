import { successResponse, errorResponse } from '../utils/response.js';
import { postService } from '../services/post.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const createPost = async (req, res) => {
  try {
    const newPost = await postService.createPost({
      content: req.body.content,
      mediaIds: req.body.mediaIds,
      visibility: req.body.visibility,
      authorId: req.user.id,
      token: req.headers.authorization
    });
    return successResponse(res, 201, newPost);
  } catch (error) {
    return handleError(res, error, 'Create Post Error');
  }
};

export const getPostById = async (req, res) => {
  try {
    const postWithAuthor = await postService.getPostById({
      id: req.params.id,
      userId: req.user.id,
      token: req.headers.authorization
    });
    return successResponse(res, 200, postWithAuthor);
  } catch (error) {
    return handleError(res, error, 'Get Post Error');
  }
};

export const updatePost = async (req, res) => {
  try {
    const updatedPost = await postService.updatePost({
      id: req.params.id,
      authorId: req.user.id,
      content: req.body.content,
      mediaIds: req.body.mediaIds,
      token: req.headers.authorization
    });
    return successResponse(res, 200, updatedPost);
  } catch (error) {
    return handleError(res, error, 'Update Post Error');
  }
};

export const deletePost = async (req, res) => {
  try {
    await postService.deletePost({
      id: req.params.id,
      authorId: req.user.id
    });
    return successResponse(res, 200, null);
  } catch (error) {
    return handleError(res, error, 'Delete Post Error');
  }
};

export const getUserPosts = async (req, res) => {
  try {
    const result = await postService.getUserPosts({
      userId: req.params.userId,
      currentUserId: req.user.id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      token: req.headers.authorization
    });
    return successResponse(res, 200, result.posts, { 
      page: parseInt(req.query.page) || 1, 
      limit: parseInt(req.query.limit) || 20, 
      total: result.total, 
      totalPages: result.totalPages 
    });
  } catch (error) {
    return handleError(res, error, 'Get User Posts Error');
  }
};
