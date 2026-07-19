import { successResponse, errorResponse } from '../utils/response.js';
import { reelService } from '../services/reel.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error(error);
  return errorResponse(res, 500, defaultMessage);
};

export const createReel = async (req, res) => {
  try {
    const newReel = await reelService.createReel({
      authorId: req.user.id,
      caption: req.body.caption,
      mediaId: req.body.mediaId,
      token: req.headers.authorization
    });
    return successResponse(res, 201, newReel);
  } catch (error) {
    return handleError(res, error, 'Create Reel Error');
  }
};

export const getReelsFeed = async (req, res) => {
  try {
    const result = await reelService.getReelsFeed({
      currentUserId: req.user.id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      token: req.headers.authorization
    });
    return successResponse(res, 200, result.reels, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      total: result.total,
      totalPages: result.totalPages
    });
  } catch (error) {
    return handleError(res, error, 'Get Reels Feed Error');
  }
};

export const getUserReels = async (req, res) => {
  try {
    const result = await reelService.getUserReels({
      userId: req.params.userId,
      currentUserId: req.user.id,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      token: req.headers.authorization
    });
    return successResponse(res, 200, result.reels, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      total: result.total,
      totalPages: result.totalPages
    });
  } catch (error) {
    return handleError(res, error, 'Get User Reels Error');
  }
};

export const incrementViewCount = async (req, res) => {
  try {
    const updatedReel = await reelService.incrementViewCount(req.params.id);
    return successResponse(res, 200, updatedReel);
  } catch (error) {
    return handleError(res, error, 'Increment Reel View Error');
  }
};
