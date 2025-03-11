import express from 'express';
import * as userController from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadAvatar, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * 用户相关路由
 * 所有路由都需要用户认证中间件保护
 */

// 获取当前用户信息
router.get('/me', protect, userController.getCurrentUser);

// 更新用户资料
router.put('/profile', protect, userController.updateProfile);

// 更新用户密码
router.put('/password', protect, userController.updatePassword);

// 上传头像
router.post('/avatar', protect, uploadAvatar, handleUploadError, userController.uploadAvatar);

// 删除账号
router.delete('/account', protect, userController.deleteAccount);

// 阅读历史相关路由
router.get('/reading-history', protect, userController.getReadingHistory);
router.post('/reading-history', protect, userController.addReadingHistory);
router.put('/reading-progress/:novelId', protect, userController.updateReadingProgress);
router.delete('/reading-history/:id', protect, userController.deleteReadingHistory);

// 收藏相关路由
router.get('/favorites', protect, userController.getFavorites);
router.get('/favorites/:id/check', protect, userController.checkFavoriteStatus);
router.post('/favorites', protect, userController.addFavorite);
router.put('/favorites/:id', protect, userController.updateFavorite);
router.delete('/favorites/:id', protect, userController.deleteFavorite);

// 阅读统计
router.get('/reading-stats', protect, userController.getReadingStats);

// 以下是通配符路由，必须放在特定路由之后
// 获取指定用户信息（公开接口，不需要认证）
router.get('/:userId/profile', userController.getUserProfileById);

// 获取指定用户的收藏（公开接口，不需要认证）
router.get('/:userId/favorites', userController.getUserFavoritesById);

export default router;