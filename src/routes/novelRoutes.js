import express from 'express';
import * as novelController from '../controllers/novelController.js';
import { protect, optionalProtect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * 小说阅读相关路由
 * 部分路由需要用户认证，部分不需要
 */

// 公开路由 - 不需要登录
router.get('/list', novelController.getNovelList);
router.get('/popular', novelController.getPopularNovels);
router.get('/latest', novelController.getLatestNovels);
router.get('/category/:categoryId', novelController.getNovelsByCategory);
router.get('/search', novelController.searchNovels);

// 获取指定作者的小说
router.get('/author/:authorId', novelController.getNovelsByAuthor);

// 获取小说信息 - 可选认证（登录用户可以获取额外信息）
router.get('/:novelId', optionalProtect, novelController.getNovelDetail);
router.get('/:novelId/chapters', optionalProtect, novelController.getNovelChapters);

// 获取章节内容 - 可选认证（登录用户可以阅读会员章节）
router.get('/:novelId/chapter/:chapterNumber', optionalProtect, novelController.getChapterContent);

// 修复小说统计数据（仅管理员使用）
router.get('/admin/fix-stats', protect, novelController.fixNovelStats);
// 修复特定小说的统计数据（仅管理员使用）
router.get('/admin/fix-stats/:novelId', protect, novelController.fixNovelStats);

export default router; 