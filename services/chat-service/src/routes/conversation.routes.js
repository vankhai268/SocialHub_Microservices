import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  createConversation,
  getMessages,
  getConversationById
} from '../controllers/conversation.controller.js';

const router = express.Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, createConversation);
router.get('/:id', requireAuth, getConversationById);
router.get('/:id/messages', requireAuth, getMessages);

export default router;
