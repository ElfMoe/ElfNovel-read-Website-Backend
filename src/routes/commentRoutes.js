import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
    createComment,
    getNovelComments,
    getChapterComments,
    getUserComments,
    deleteComment,
    likeComment,
    unlikeComment,
    replyToComment
} from '../controllers/commentController.js';

const router = express.Router();

// 发布留言（小说或章节）
router.post('/', protect, createComment);

// 获取小说的所有留言（包括章节留言）
router.get('/novel/:novelId', getNovelComments);

// 获取章节的留言
router.get('/chapter/:chapterId', getChapterComments);

// 获取用户的留言历史
router.get('/user/history', protect, getUserComments);

// 删除留言
router.delete('/:commentId', protect, deleteComment);

// 点赞留言
router.post('/:commentId/like', protect, likeComment);

// 取消点赞
router.delete('/:commentId/like', protect, unlikeComment);

// 回复留言
router.post('/reply', protect, replyToComment);

export default router; 