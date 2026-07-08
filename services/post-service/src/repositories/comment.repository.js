import prisma from '../config/db.js';

export const commentRepository = {
  create: async (postId, authorId, content) => {
    return await prisma.comment.create({
      data: {
        post_id: postId,
        author_id: authorId,
        content: content
      }
    });
  },

  findById: async (id) => {
    return await prisma.comment.findUnique({ where: { id } });
  },

  findByPostId: async (postId, limit, offset) => {
    return await prisma.comment.findMany({
      where: { post_id: postId },
      orderBy: { created_at: 'asc' },
      take: limit,
      skip: offset
    });
  },

  countByPostId: async (postId) => {
    return await prisma.comment.count({ where: { post_id: postId } });
  },

  delete: async (id) => {
    await prisma.comment.delete({ where: { id } });
  },
  
  getCommentWithPostAuthor: async (commentId, postId) => {
    const result = await prisma.$queryRaw`
      SELECT c.author_id AS comment_author_id, p.author_id AS post_author_id 
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = ${commentId}::uuid AND c.post_id = ${postId}::uuid
    `;
    return result[0];
  }
};
