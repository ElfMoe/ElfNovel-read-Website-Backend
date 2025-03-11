import express from 'express';
import * as authController from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// 注册路由
router.post('/register', authController.register);

// 登录路由
router.post('/login', authController.login);

// 验证邮箱路由
router.get('/verify-email/:token', authController.verifyEmail);

// 刷新Token路由
router.post('/refresh-token', authController.refreshToken);

export default router; 