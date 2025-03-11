import mongoose from 'mongoose';
import { Novel, Chapter, User } from '../models/index.js';
import Comment from '../models/comment.js';

/**
 * 留言控制器
 * 
 * 处理用户对小说或章节的留言操作
 */

// 发布留言（小说或章节）
export const createComment = async (req, res) => {
    try {
        const { content, novelId, chapterId } = req.body;
        const userId = req.user.id;
        
        // 验证输入
        if (!content || !novelId) {
            return res.status(400).json({
                success: false,
                message: '留言内容和小说ID不能为空'
            });
        }
        
        // 验证小说是否存在
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '小说不存在'
            });
        }
        
        // 准备留言数据
        const commentData = {
            content,
            user: userId,
            novel: novelId
        };
        
        // 如果是章节留言，验证章节是否存在并添加章节信息
        if (chapterId) {
            const chapter = await Chapter.findById(chapterId);
            if (!chapter) {
                return res.status(404).json({
                    success: false,
                    message: '章节不存在'
                });
            }
            
            // 验证章节是否属于指定的小说
            if (chapter.novel.toString() !== novelId) {
                return res.status(400).json({
                    success: false,
                    message: '章节不属于指定的小说'
                });
            }
            
            commentData.chapter = chapterId;
            commentData.chapterNumber = chapter.chapterNumber;
        }
        
        // 创建留言
        const comment = await Comment.create(commentData);
        
        // 填充用户信息后返回
        await comment.populate('user', 'username avatar penName');
        
        if (chapterId) {
            await comment.populate('chapter', 'title chapterNumber');
        }
        
        res.status(201).json({
            success: true,
            message: '留言发布成功',
            data: comment
        });
    } catch (error) {
        console.error('发布留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取小说的所有留言（包括章节留言）
export const getNovelComments = async (req, res) => {
    try {
        const { novelId } = req.params;
        const { limit = 20, page = 1 } = req.query;
        
        // 验证小说是否存在
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '小说不存在'
            });
        }
        
        // 计算分页
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取留言
        const comments = await Comment.getNovelComments(novelId, {
            limit: parseInt(limit),
            skip
        });
        
        // 获取总数
        const total = await Comment.countDocuments({
            novel: novelId,
            isDeleted: false
        });
        
        res.status(200).json({
            success: true,
            data: {
                comments,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('获取小说留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取章节的留言
export const getChapterComments = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const { limit = 20, page = 1 } = req.query;
        
        // 验证章节是否存在
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '章节不存在'
            });
        }
        
        // 计算分页
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取留言
        const comments = await Comment.getChapterComments(chapterId, {
            limit: parseInt(limit),
            skip
        });
        
        // 获取总数
        const total = await Comment.countDocuments({
            chapter: chapterId,
            isDeleted: false
        });
        
        res.status(200).json({
            success: true,
            data: {
                comments,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('获取章节留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取用户的留言历史
export const getUserComments = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1 } = req.query;
        
        // 计算分页
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取留言
        const comments = await Comment.getUserComments(userId, {
            limit: parseInt(limit),
            skip
        });
        
        // 获取总数
        const total = await Comment.countDocuments({
            user: userId,
            isDeleted: false
        });
        
        res.status(200).json({
            success: true,
            data: {
                comments,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('获取用户留言历史失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除留言
export const deleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        
        // 查找留言
        const comment = await Comment.findById(commentId).populate('novel', 'author');
        
        // 验证留言是否存在
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: '留言不存在'
            });
        }
        
        // 检查权限：1.评论作者可以删除自己的评论 2.小说作者可以删除自己作品下的评论 3.管理员可以删除任何评论
        const isCommentAuthor = comment.user.toString() === userId;
        const isNovelAuthor = comment.novel && comment.novel.author && comment.novel.author.toString() === userId;
        const isAdmin = req.user.role === 'admin';
        
        if (!isCommentAuthor && !isNovelAuthor && !isAdmin) {
            return res.status(403).json({
                success: false,
                message: '您没有权限删除此留言'
            });
        }
        
        // 软删除留言
        comment.isDeleted = true;
        await comment.save();
        
        res.status(200).json({
            success: true,
            message: '留言已删除'
        });
    } catch (error) {
        console.error('删除留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 点赞留言
export const likeComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        
        // 查找留言
        const comment = await Comment.findById(commentId);
        
        // 验证留言是否存在
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: '留言不存在'
            });
        }
        
        // 点赞留言
        await comment.addLike(userId);
        
        res.status(200).json({
            success: true,
            message: '点赞成功',
            data: {
                likes: comment.likes
            }
        });
    } catch (error) {
        console.error('点赞留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 取消点赞
export const unlikeComment = async (req, res) => {
    try {
        const { commentId } = req.params;
        const userId = req.user.id;
        
        // 查找留言
        const comment = await Comment.findById(commentId);
        
        // 验证留言是否存在
        if (!comment) {
            return res.status(404).json({
                success: false,
                message: '留言不存在'
            });
        }
        
        // 取消点赞
        await comment.removeLike(userId);
        
        res.status(200).json({
            success: true,
            message: '取消点赞成功',
            data: {
                likes: comment.likes
            }
        });
    } catch (error) {
        console.error('取消点赞失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 回复留言
export const replyToComment = async (req, res) => {
    try {
        const { content, novelId, commentId, replyToUserId } = req.body;
        const userId = req.user.id;
        
        // 验证输入
        if (!content || !novelId || !commentId) {
            return res.status(400).json({
                success: false,
                message: '留言内容、小说ID和被回复的留言ID不能为空'
            });
        }
        
        // 验证被回复的留言是否存在
        const parentComment = await Comment.findById(commentId);
        if (!parentComment) {
            return res.status(404).json({
                success: false,
                message: '被回复的留言不存在'
            });
        }
        
        // 创建回复留言
        const replyData = {
            content,
            user: userId,
            novel: novelId,
            replyTo: commentId
        };
        
        // 如果指定了回复用户ID，添加到数据中
        if (replyToUserId) {
            replyData.replyToUser = replyToUserId;
        }
        
        // 如果是章节留言，添加章节信息
        if (parentComment.chapter) {
            replyData.chapter = parentComment.chapter;
            replyData.chapterNumber = parentComment.chapterNumber;
        }
        
        // 创建留言
        const reply = await Comment.create(replyData);
        
        // 填充用户信息后返回
        await reply.populate('user', 'username avatar penName');
        await reply.populate('replyTo', 'content user');
        await reply.populate('replyTo.user', 'username penName');
        
        // 如果有回复用户，填充回复用户信息
        if (reply.replyToUser) {
            await reply.populate('replyToUser', 'username avatar penName');
        }
        
        res.status(201).json({
            success: true,
            message: '回复成功',
            data: reply
        });
    } catch (error) {
        console.error('回复留言失败:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
}; 