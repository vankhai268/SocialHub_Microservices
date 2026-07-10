/**
 * Register typing indicator event handlers
 */
export default (io, socket) => {
  // Client starts typing
  socket.on('typing:start', ({ conversationId }) => {
    if (!conversationId) return;

    socket.to(`conv:${conversationId}`).emit('typing:indicator', {
      conversationId,
      userId: socket.userId,
      displayName: socket.displayName,
      isTyping: true
    });
  });

  // Client stops typing
  socket.on('typing:stop', ({ conversationId }) => {
    if (!conversationId) return;

    socket.to(`conv:${conversationId}`).emit('typing:indicator', {
      conversationId,
      userId: socket.userId,
      displayName: socket.displayName,
      isTyping: false
    });
  });
};
