import { Router } from "express";

import authRoutes from "../modules/auth/auth.routes.js";

const router = Router();

// Authentication routes
router.use("/auth", authRoutes);

// Future modules
// router.use("/users", userRoutes);
// router.use("/news", newsRoutes);
// router.use("/parties", partyRoutes);
// router.use("/candidates", candidateRoutes);
// router.use("/elections", electionRoutes);
// router.use("/polls", pollRoutes);
// router.use("/discussions", discussionRoutes);

export default router;
