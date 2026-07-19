import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listConversations,
  createConversation,
  getMessages,
  getConversationById,
  deleteConversation,
  getIceServers
} from '../controllers/conversation.controller.js';

const router = express.Router();

router.get('/', requireAuth, listConversations);
router.post('/', requireAuth, createConversation);
router.get('/ice-servers', requireAuth, getIceServers);
router.get('/:id', requireAuth, getConversationById);
router.get('/:id/messages', requireAuth, getMessages);
router.delete('/:id', requireAuth, deleteConversation);

export default router;
