import GroupChat from '../models/group.model.js';
import Conversation from '../models/conversation.model.js';
import { fetchUsersBatch } from '../utils/api.js';
import { redisPublisher } from '../config/redis.js';
import { BadRequestError, ForbiddenError, NotFoundError, ConflictError } from '../utils/error.js';
import { randomUUID } from 'crypto';

/**
 * Create a new group chat
 * @param {string} creatorId 
 * @param {string} name 
 * @param {Array<string>} memberIds 
 * @param {string|null} avatarUrl 
 * @returns {Promise<Object>}
 */
export const createGroup = async (creatorId, name, memberIds, avatarUrl = null) => {
  if (!name || name.trim() === '') {
    throw new BadRequestError('Group name is required');
  }
  if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
    throw new BadRequestError('Group must have at least one other member');
  }

  const allIds = Array.from(new Set([creatorId, ...memberIds]));

  // Batch query profile information from user-service
  const users = await fetchUsersBatch(allIds);
  const userMap = new Map(users.map(u => [u.id, u]));

  // Map user profiles to group schema structure
  const members = allIds.map(userId => {
    const u = userMap.get(userId) || { displayName: 'User', avatarUrl: null };
    return {
      userId,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      role: userId === creatorId ? 'admin' : 'member',
      joinedAt: new Date()
    };
  });

  // 1. Create matching conversation document
  const participants = allIds.map(userId => ({ userId, joinedAt: new Date() }));
  const conversation = await Conversation.create({
    type: 'group',
    participants
  });

  // 2. Create group document linked to conversation
  const group = await GroupChat.create({
    name,
    avatarUrl,
    members,
    conversationId: conversation._id
  });

  // 3. Update conversation with group reference
  conversation.groupRef = group._id;
  await conversation.save();

  // 4. Publish async event for each added member (excluding the creator)
  for (const memberId of memberIds) {
    const event = {
      eventId: randomUUID(),
      groupId: group._id.toString(),
      groupName: group.name,
      addedUserId: memberId,
      addedByUserId: creatorId,
      occurredAt: new Date().toISOString()
    };
    await redisPublisher.publish('group.member.added', JSON.stringify(event));
  }

  return group;
};

/**
 * Get group metadata by ID
 * @param {string} groupId 
 * @returns {Promise<Object>}
 */
export const getGroupInfo = async (groupId) => {
  const group = await GroupChat.findById(groupId);
  if (!group) {
    throw new NotFoundError('Group not found');
  }
  return group;
};

/**
 * Update group name/avatar (Admin only)
 * @param {string} userId - User requesting update
 * @param {string} groupId 
 * @param {string} name 
 * @param {string} avatarUrl 
 * @returns {Promise<Object>}
 */
export const updateGroup = async (userId, groupId, name, avatarUrl) => {
  const group = await GroupChat.findById(groupId);
  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const isAdmin = group.members.some(m => m.userId === userId && m.role === 'admin');
  if (!isAdmin) {
    throw new ForbiddenError('Only group admin can update group info');
  }

  if (name !== undefined) group.name = name;
  if (avatarUrl !== undefined) group.avatarUrl = avatarUrl;

  await group.save();
  return group;
};

/**
 * Add a new member to the group (Admin only)
 * @param {string} adminId 
 * @param {string} groupId 
 * @param {string} newMemberId 
 * @returns {Promise<Object>}
 */
export const addMember = async (adminId, groupId, newMemberId) => {
  const group = await GroupChat.findById(groupId);
  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const isAdmin = group.members.some(m => m.userId === adminId && m.role === 'admin');
  if (!isAdmin) {
    throw new ForbiddenError('Only group admin can add members');
  }

  const isMember = group.members.some(m => m.userId === newMemberId);
  if (isMember) {
    throw new ConflictError('User is already a member');
  }

  const users = await fetchUsersBatch([newMemberId]);
  if (users.length === 0) {
    throw new NotFoundError('User not found in system');
  }
  const user = users[0];

  // Add member
  group.members.push({
    userId: newMemberId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: 'member',
    joinedAt: new Date()
  });

  await group.save();

  // Add participant to the conversation
  await Conversation.findByIdAndUpdate(group.conversationId, {
    $push: { participants: { userId: newMemberId, joinedAt: new Date() } }
  });

  // Publish event
  const event = {
    eventId: randomUUID(),
    groupId: group._id.toString(),
    groupName: group.name,
    addedUserId: newMemberId,
    addedByUserId: adminId,
    occurredAt: new Date().toISOString()
  };
  await redisPublisher.publish('group.member.added', JSON.stringify(event));

  return group;
};

/**
 * Remove a member from the group (Admin or Self-leave)
 * @param {string} reqUserId 
 * @param {string} groupId 
 * @param {string} memberToRemoveId 
 * @returns {Promise<Object>}
 */
export const removeMember = async (reqUserId, groupId, memberToRemoveId) => {
  const group = await GroupChat.findById(groupId);
  if (!group) {
    throw new NotFoundError('Group not found');
  }

  const isAdmin = group.members.some(m => m.userId === reqUserId && m.role === 'admin');
  const isSelf = reqUserId === memberToRemoveId;

  if (!isAdmin && !isSelf) {
    throw new ForbiddenError('Not authorized to remove this member');
  }

  const memberIndex = group.members.findIndex(m => m.userId === memberToRemoveId);
  if (memberIndex === -1) {
    throw new NotFoundError('User is not a member of the group');
  }

  const removedMember = group.members[memberIndex];
  const wasAdmin = removedMember.role === 'admin';

  group.members.splice(memberIndex, 1);

  // If group is empty, delete group and conversation
  if (group.members.length === 0) {
    await Conversation.findByIdAndDelete(group.conversationId);
    await GroupChat.findByIdAndDelete(group._id);
    return { status: 'deleted' };
  }

  // If the admin left, promote the oldest member to admin
  if (wasAdmin && !group.members.some(m => m.role === 'admin')) {
    group.members.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    group.members[0].role = 'admin';
  }

  await group.save();

  // Remove participant from the conversation
  await Conversation.findByIdAndUpdate(group.conversationId, {
    $pull: { participants: { userId: memberToRemoveId } }
  });

  return { status: 'removed', group };
};

/**
 * Leave a group chat
 * @param {string} userId 
 * @param {string} groupId 
 * @returns {Promise<Object>}
 */
export const leaveGroup = async (userId, groupId) => {
  return removeMember(userId, groupId, userId);
};
