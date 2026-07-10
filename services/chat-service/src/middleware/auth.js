import { errorResponse } from '../utils/response.js';

export const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return errorResponse(res, 401, 'Unauthorized: Missing user identity from Gateway');
  }
  
  req.user = {
    id: userId,
    token: req.headers.authorization // Keep original token for downstream service calls
  };
  
  next();
};
