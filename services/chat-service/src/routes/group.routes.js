import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createGroup,
  getGroupInfo,
  updateGroup,
  addMember,
  removeMember,
  leaveGroup
} from '../controllers/group.controller.js';

const router = express.Router();

router.post('/', requireAuth, createGroup);
router.get('/:id', requireAuth, getGroupInfo);
router.put('/:id', requireAuth, updateGroup);
router.post('/:id/members', requireAuth, addMember);
router.delete('/:id/members/:userId', requireAuth, removeMember);
router.post('/:id/leave', requireAuth, leaveGroup);

export default router;
