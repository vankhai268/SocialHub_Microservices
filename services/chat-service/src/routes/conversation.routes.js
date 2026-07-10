import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  createConversation,
  getMessages
} from '../controllers/conversation.controller.js';

const router = express.Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, createConversation);
router.get('/:id/messages', requireAuth, getMessages);

export default router;
