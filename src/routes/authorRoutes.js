import express from 'express';
import * as authorController from '../controllers/authorController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadCover, handleUploadError } from '../middleware/uploadMiddleware.js';

const router = express.Router();

/**
 * 作者相关路由
 * 所有路由都需要用户认证中间件保护
 */

// 获取我的小说列表
router.get('/novels', protect, authorController.getMyNovels);

// 获取作者统计信息
router.get('/stats', protect, authorController.getAuthorStats);

// 小说管理
router.post('/novels', protect, authorController.createNovel);
router.get('/novels/:novelId', protect, authorController.getNovelDetail);
router.put('/novels/:novelId', protect, uploadCover, handleUploadError, authorController.updateNovel);
router.delete('/novels/:novelId', protect, authorController.deleteNovel);

// 添加小说状态更新路由
router.patch('/novels/:novelId/status', protect, authorController.updateNovelStatus);
// 同时支持PUT方法
router.put('/novels/:novelId/status', protect, authorController.updateNovelStatus);

// 封面管理
router.post('/novels/:novelId/cover', protect, uploadCover, handleUploadError, authorController.uploadNovelCover);
router.post('/novels/:novelId/cover-template', protect, authorController.setNovelCoverTemplate);

// 章节管理
router.get('/novels/:novelId/chapters', protect, authorController.getNovelChapters);
router.post('/novels/:novelId/chapters', protect, authorController.createChapter);
router.get('/novels/:novelId/chapters/:chapterId', protect, authorController.getChapterDetail);
router.put('/novels/:novelId/chapters/:chapterId', protect, authorController.updateChapter);
router.delete('/novels/:novelId/chapters/:chapterId', protect, authorController.deleteChapter);

export default router; 