import { successResponse, errorResponse } from '../utils/response.js';
import * as groupService from '../services/group.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error('❌ Group Controller error:', error);
  return errorResponse(res, 500, defaultMessage);
};

/**
 * POST /groups
 */
export const createGroup = async (req, res) => {
  try {
    const { name, memberIds, avatarUrl } = req.body;
    const group = await groupService.createGroup(req.user.id, name, memberIds, avatarUrl);
    return successResponse(res, 201, group);
  } catch (error) {
    return handleError(res, error, 'Create Group Error');
  }
};

/**
 * GET /groups/:id
 */
export const getGroupInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await groupService.getGroupInfo(id);
    return successResponse(res, 200, group);
  } catch (error) {
    return handleError(res, error, 'Get Group Info Error');
  }
};

/**
 * PUT /groups/:id
 */
export const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, avatarUrl } = req.body;
    const group = await groupService.updateGroup(req.user.id, id, name, avatarUrl);
    return successResponse(res, 200, group);
  } catch (error) {
    return handleError(res, error, 'Update Group Error');
  }
};

/**
 * POST /groups/:id/members
 */
export const addMember = async (req, res) => {
  try {
    const { id } = req.params; // groupId
    const { userId } = req.body; // user to add
    if (!userId) {
      return errorResponse(res, 400, 'userId is required');
    }
    const group = await groupService.addMember(req.user.id, id, userId);
    return successResponse(res, 200, group);
  } catch (error) {
    return handleError(res, error, 'Add Member Error');
  }
};

/**
 * DELETE /groups/:id/members/:userId
 */
export const removeMember = async (req, res) => {
  try {
    const { id, userId } = req.params; // groupId, userId
    const result = await groupService.removeMember(req.user.id, id, userId);
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Remove Member Error');
  }
};

/**
 * POST /groups/:id/leave
 */
export const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await groupService.leaveGroup(req.user.id, id);
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Leave Group Error');
  }
};
