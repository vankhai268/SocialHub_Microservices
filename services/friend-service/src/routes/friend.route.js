import express from "express";

import { sendRequest, getPendingRequests, acceptRequest, rejectRequest, listFriends, removeFriend, getInternalFriendIds, checkFriendshipStatus, getMutualFriends, getFriendSuggestions } from "../controllers/friend.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/request", protectRoute, sendRequest);
router.get("/requests", protectRoute, getPendingRequests);
router.put("/requests/:id/accept", protectRoute, acceptRequest);
router.put("/requests/:id/reject", protectRoute, rejectRequest);
router.get("/", protectRoute, listFriends);
router.get("/suggestions", protectRoute, getFriendSuggestions);
router.get("/check/:userId", protectRoute, checkFriendshipStatus);
router.get("/mutual/:userId", protectRoute, getMutualFriends);
router.delete("/:friendId", protectRoute, removeFriend);

router.get("/internal/:userId", getInternalFriendIds);

export default router;