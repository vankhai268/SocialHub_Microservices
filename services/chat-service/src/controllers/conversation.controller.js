import { successResponse, errorResponse } from '../utils/response.js';
import * as conversationService from '../services/conversation.service.js';
import * as messageService from '../services/message.service.js';
import { CustomError } from '../utils/error.js';

const handleError = (res, error, defaultMessage = 'Internal Server Error') => {
  if (error instanceof CustomError) {
    return errorResponse(res, error.statusCode, error.message);
  }
  console.error('❌ Controller error:', error);
  return errorResponse(res, 500, defaultMessage);
};

/**
 * GET /conversations
 */
export const listConversations = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const result = await conversationService.listConversations(req.user.id, page, limit);
    return successResponse(res, 200, result.data, result.pagination);
  } catch (error) {
    return handleError(res, error, 'List Conversations Error');
  }
};

/**
 * POST /conversations
 */
export const createConversation = async (req, res) => {
  try {
    const { participantId } = req.body;
    if (!participantId) {
      return errorResponse(res, 400, 'participantId is required');
    }
    const { conversation, statusCode } = await conversationService.createConversation(req.user.id, participantId);
    return successResponse(res, statusCode, conversation);
  } catch (error) {
    return handleError(res, error, 'Create Conversation Error');
  }
};

/**
 * GET /conversations/:id/messages
 */
export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const { before, limit } = req.query;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const token = req.headers.authorization;
    
    const result = await messageService.getMessages(req.user.id, id, before, parsedLimit, token);
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Get Messages Error');
  }
};

/**
 * GET /conversations/:id
 */
export const getConversationById = async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await conversationService.getConversationById(req.user.id, id);
    return successResponse(res, 200, conversation);
  } catch (error) {
    return handleError(res, error, 'Get Conversation Error');
  }
};

/**
 * DELETE /conversations/:id
 */
export const deleteConversation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await conversationService.deleteConversation(req.user.id, id);
    return successResponse(res, 200, result);
  } catch (error) {
    return handleError(res, error, 'Delete Conversation Error');
  }
};

/**
 * GET /conversations/ice-servers
 */
export const getIceServers = async (req, res) => {
  try {
    return successResponse(res, 200, {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        {
          urls: process.env.TURN_URL || "turn:turn.yourdomain.com:3478",
          username: process.env.TURN_USERNAME || "socialhub_user",
          credential: process.env.TURN_CREDENTIAL || "socialhub_secret_pass"
        }
      ]
    });
  } catch (error) {
    return handleError(res, error, 'Get ICE Servers Error');
  }
};
