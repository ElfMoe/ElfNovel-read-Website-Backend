import express from 'express';
import * as folderController from '../controllers/folderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * 文件夹路由
 * 
 * 所有路由都需要用户登录
 */

// 获取用户的所有文件夹
router.get('/', protect, folderController.getFolders);

// 创建新文件夹
router.post('/', protect, folderController.createFolder);

// 更新文件夹
router.put('/:id', protect, folderController.updateFolder);

// 删除文件夹
router.delete('/:id', protect, folderController.deleteFolder);

// 获取文件夹中的收藏
router.get('/:id/favorites', protect, folderController.getFolderFavorites);

// 获取收藏所在的文件夹
router.get('/favorites/:id', protect, folderController.getFavoriteFolders);

// 添加收藏到文件夹
router.post('/add', protect, folderController.addToFolder);

// 从文件夹中移除收藏
router.delete('/:folderId/favorites/:favoriteId', protect, folderController.removeFromFolder);

// 更新收藏的文件夹
router.put('/favorites/:id', protect, folderController.updateFavoriteFolders);

export default router; 