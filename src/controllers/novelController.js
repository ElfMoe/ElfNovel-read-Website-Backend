import { Novel } from '../models/novel.js';
import { Chapter } from '../models/chapter.js';
import mongoose from 'mongoose';
import { User, ReadingHistory, Favorite } from '../models/index.js';
import crypto from 'crypto';

/**
 * 小说控制器 - 处理小说阅读相关的API请求
 * 包括小说列表、小说详情、章节阅读等功能
 */

// 获取小说列表（支持分页、分类和排序）
export const getNovelList = async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            category, 
            status, 
            sort = 'updatedAt', 
            order = 'desc',
            search
        } = req.query;
        
        // 构建查询条件
        const query = {};
        if (category) query.categories = category;
        if (status) query.status = status;
        if (search) {
            // 支持按标题或作者名搜索
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { authorName: { $regex: search, $options: 'i' } }
            ];
        }
        
        // 计算跳过的文档数
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 构建排序条件
        const sortObj = {};
        sortObj[sort] = order === 'desc' ? -1 : 1;
        
        // 查询小说
        const novels = await Novel.find(query)
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit))
            .select('title authorName cover shortDescription status totalChapters readers collections updatedAt');
            
        // 计算总数
        const total = await Novel.countDocuments(query);
        
        return res.status(200).json({
            success: true,
            count: novels.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: novels
        });
    } catch (error) {
        console.error('获取小说列表失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取小说详情
export const getNovelDetail = async (req, res) => {
    try {
        const { novelId } = req.params;
        console.log(`获取小说详情 - novelId: ${novelId}, 用户登录状态:`, req.user ? '已登录' : '未登录');
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 查询小说详情
        const novel = await Novel.findById(novelId)
            .populate('latestChapter', 'title chapterNumber updatedAt')
            .populate('creator', '_id username penName avatar');
            
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说'
            });
        }
        
        // 获取章节列表
        let chapters = [];
        try {
            chapters = await Chapter.find({ novel: novelId })
                .select('title chapterNumber updatedAt isPremium')
                .sort({ chapterNumber: 1 });
            console.log(`找到${chapters.length}个章节`);
        } catch (chapterError) {
            console.error('获取章节列表失败:', chapterError);
            // 如果获取章节失败，返回空数组而不是报错
            chapters = [];
        }
        
        // 获取最新章节
        let latestChapters = [];
        try {
            latestChapters = await Chapter.find({ novel: novelId })
                .select('title chapterNumber updatedAt')
                .sort({ chapterNumber: -1 })
                .limit(5);
        } catch (latestChapterError) {
            console.error('获取最新章节失败:', latestChapterError);
            // 如果失败，返回空数组
            latestChapters = [];
        }
        
        // 对登录用户的特殊处理
        let isFavorited = false;
        let lastReadChapter = null;
        
        // 首先准备返回数据
        // 确保novel是一个普通对象，而不是Mongoose文档
        const novelObj = novel.toObject ? novel.toObject() : JSON.parse(JSON.stringify(novel));
        
        // 构建返回对象，确保所有属性都存在
        const novelData = {
            ...novelObj,
            chapters: chapters || [],
            latestChapters: latestChapters || [],
            isFavorited: false,
            lastReadChapter: null
        };
        
        // 如果用户已登录，异步处理用户相关数据
        if (req.user) {
            const userId = req.user.id;
            console.log(`登录用户处理 - userId: ${userId}`);
            
            // 使用Promise.resolve()包装用户相关操作，不阻塞主流程
            Promise.resolve().then(async () => {
                try {
                    // 检查是否已收藏
                    const favorite = await Favorite.findOne({ user: userId, novel: novelId });
                    console.log(`用户是否已收藏: ${!!favorite}`);
                    
                    // 获取上次阅读记录
                    const history = await ReadingHistory.findOne({ user: userId, novel: novelId })
                        .populate('lastChapter', 'title chapterNumber');
                        
                    if (history && history.lastChapter) {
                        console.log(`上次阅读章节: ${history.lastChapter.title}`);
                    }
                    
                    // 更新小说阅读人数（防止重复计算）
                    if (!history) {
                        await Novel.findByIdAndUpdate(novelId, { $inc: { readers: 1 } });
                        console.log('更新小说阅读人数');
                    }
                } catch (userError) {
                    // 如果用户相关操作出错，记录错误但不影响API返回
                    console.error('处理用户数据时出错:', userError);
                }
            });
        }
        
        console.log('小说详情API返回成功');
        return res.status(200).json({
            success: true,
            data: novelData
        });
    } catch (error) {
        console.error('获取小说详情失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取小说章节列表
export const getNovelChapters = async (req, res) => {
    try {
        const { novelId } = req.params;
        console.log(`获取小说章节列表 - novelId: ${novelId}, 用户登录状态:`, req.user ? '已登录' : '未登录');
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 确认小说存在
        const novel = await Novel.findById(novelId).select('title authorName');
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说'
            });
        }
        
        // 获取所有章节
        let chapters = [];
        try {
            chapters = await Chapter.find({ novel: novelId })
                .select('title chapterNumber updatedAt isPremium isExtra')
                .sort({ chapterNumber: 1 });
            console.log(`找到${chapters.length}个章节`);
        } catch (chapterError) {
            console.error('获取章节列表失败:', chapterError);
            // 如果获取章节失败，返回空数组而不是报错
            chapters = [];
        }
            
        console.log('章节列表API返回成功');
        return res.status(200).json({
            success: true,
            novel: {
                id: novel._id,
                title: novel.title,
                authorName: novel.authorName
            },
            count: chapters.length,
            data: chapters
        });
    } catch (error) {
        console.error('获取章节列表失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取章节内容
export const getChapterContent = async (req, res) => {
    try {
        const { novelId, chapterNumber } = req.params;
        console.log(`获取章节内容 - novelId: ${novelId}, chapterNumber: ${chapterNumber}, 用户登录状态:`, req.user ? '已登录' : '未登录');
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 确认小说存在并获取必要信息
        const novel = await Novel.findById(novelId).select('title authorName totalChapters');
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说'
            });
        }
        
        // 查询指定章节
        const chapter = await Chapter.findOne({ 
            novel: novelId, 
            chapterNumber: parseFloat(chapterNumber) 
        });
        
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '未找到章节'
            });
        }
        
        // 处理付费章节的访问逻辑
        if (chapter.isPremium) {
            if (req.user) {
                console.log('付费章节 - 用户已登录，检查权限');
                // TODO: 在此实现付费章节的检查逻辑
                // 例如：检查用户是否已购买该章节
                // 暂时允许所有登录用户访问付费章节
            } else {
                console.log('付费章节 - 用户未登录，拒绝访问');
                return res.status(403).json({
                    success: false,
                    message: '该章节需要登录后购买才能阅读'
                });
            }
        }
        
        // 更新章节浏览量 - 捕获可能的错误，但不影响主流程
        try {
            console.log(`开始更新章节 ${chapter._id} 的浏览量`);
            
            // 获取客户端标识信息
            const clientInfo = {
                // 如果用户已登录，使用用户ID
                userId: req.user ? req.user.id : null,
                
                // 未登录用户使用客户端标识
                clientId: req.cookies && req.cookies.clientId ? req.cookies.clientId : null,
                
                // 获取IP地址
                ipAddress: (
                    req.headers['x-forwarded-for'] || 
                    req.connection.remoteAddress || 
                    'unknown'
                ).split(',')[0].trim()
            };
            
            console.log(`阅读用户信息: ${JSON.stringify(clientInfo)}`);
            
            // 如果未登录用户没有客户端ID，设置一个cookie
            if (!req.user && (!req.cookies || !req.cookies.clientId)) {
                const clientId = crypto.randomBytes(16).toString('hex');
                res.cookie('clientId', clientId, { 
                    maxAge: 365 * 24 * 60 * 60 * 1000, // 一年有效期
                    httpOnly: true,
                    path: '/',  // 确保cookie在所有路径可用
                    sameSite: 'Lax',  // 设置SameSite策略为Lax，在大多数情况下都能正常工作
                    secure: process.env.NODE_ENV === 'production'  // 生产环境下使用secure
                });
                clientInfo.clientId = clientId;
                console.log(`为未登录用户设置了新的客户端ID: ${clientId}`);
            }
            
            // 更新章节浏览量和阅读记录
            try {
                // 使用章节模型的incrementViewCount方法更新浏览量
                console.log(`准备更新章节浏览量，当前值: ${chapter.viewCount || 0}`);
                await chapter.incrementViewCount(clientInfo);
                console.log(`章节浏览量更新完成，新值: ${chapter.viewCount || 0}`);
            } catch (incrementError) {
                console.error('更新章节浏览量失败:', incrementError.message);
                // 继续执行，不影响内容显示
            }
        } catch (viewCountError) {
            console.error('处理浏览量逻辑失败:', viewCountError.message);
            // 继续执行，不影响主流程
        }
        
        // 如果用户已登录，更新阅读历史
        if (req.user) {
            try {
                const userId = req.user.id;
                console.log(`更新用户阅读历史 - userId: ${userId}`);
                
                // 确保totalChapters有值
                const totalChapters = novel.totalChapters || 1;
                const progress = (parseFloat(chapterNumber) / totalChapters) * 100;
                
                // 使用Promise.resolve以避免阻塞，防止更新历史的操作影响主流程
                Promise.resolve().then(async () => {
                    try {
                        await ReadingHistory.updateHistory(
                            userId,
                            novelId,
                            chapter._id,
                            Math.min(progress, 100)
                        );
                        console.log('用户阅读历史已更新');
                    } catch (err) {
                        console.error('更新阅读历史时发生错误:', err);
                    }
                });
            } catch (historyError) {
                console.error('准备更新阅读历史失败:', historyError);
                // 继续执行，不影响主流程
            }
        }
        
        // 查询前后章节 - 捕获可能的错误，但不影响主流程
        let prevChapter = null;
        let nextChapter = null;
        
        try {
            prevChapter = await Chapter.findOne({
                novel: novelId,
                chapterNumber: { $lt: parseFloat(chapterNumber) }
            })
            .sort({ chapterNumber: -1 })
            .select('chapterNumber title');
            
            nextChapter = await Chapter.findOne({
                novel: novelId,
                chapterNumber: { $gt: parseFloat(chapterNumber) }
            })
            .sort({ chapterNumber: 1 })
            .select('chapterNumber title');
            
            console.log('成功获取前后章节');
        } catch (navError) {
            console.error('获取前后章节失败:', navError);
            // 继续执行，不影响主流程
        }
        
        console.log('章节内容API返回成功');
        return res.status(200).json({
            success: true,
            data: {
                novel: {
                    id: novel._id,
                    title: novel.title,
                    authorName: novel.authorName
                },
                chapter: {
                    id: chapter._id,
                    title: chapter.title,
                    content: chapter.content,
                    chapterNumber: chapter.chapterNumber,
                    wordCount: chapter.wordCount,
                    viewCount: chapter.viewCount,
                    createdAt: chapter.createdAt,
                    updatedAt: chapter.updatedAt
                },
                navigation: {
                    prev: prevChapter,
                    next: nextChapter
                }
            }
        });
    } catch (error) {
        console.error('获取章节内容失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取热门小说
export const getPopularNovels = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // 按阅读人数排序获取热门小说
        const novels = await Novel.find()
            .sort({ readers: -1 })
            .limit(parseInt(limit))
            .select('title authorName cover shortDescription readers collections');
            
        return res.status(200).json({
            success: true,
            count: novels.length,
            data: novels
        });
    } catch (error) {
        console.error('获取热门小说失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取最新更新的小说
export const getLatestNovels = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // 按更新时间排序获取最新小说
        const novels = await Novel.find()
            .sort({ updatedAt: -1 })
            .limit(parseInt(limit))
            .select('title authorName cover shortDescription updatedAt');
            
        return res.status(200).json({
            success: true,
            count: novels.length,
            data: novels
        });
    } catch (error) {
        console.error('获取最新小说失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取按分类的小说
export const getNovelsByCategory = async (req, res) => {
    try {
        const { category, limit = 10, page = 1 } = req.query;
        
        if (!category) {
            return res.status(400).json({
                success: false,
                message: '请提供分类参数'
            });
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 按分类查询小说
        const novels = await Novel.find({ categories: category })
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('title authorName cover shortDescription status totalChapters readers collections updatedAt');
            
        // 计算总数
        const total = await Novel.countDocuments({ categories: category });
        
        return res.status(200).json({
            success: true,
            count: novels.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            category,
            data: novels
        });
    } catch (error) {
        console.error('按分类获取小说失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 搜索小说
export const searchNovels = async (req, res) => {
    try {
        const { keyword, limit = 10, page = 1 } = req.query;
        
        if (!keyword) {
            return res.status(400).json({
                success: false,
                message: '请提供搜索关键词'
            });
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 构建搜索条件
        const query = {
            $or: [
                { title: { $regex: keyword, $options: 'i' } },
                { authorName: { $regex: keyword, $options: 'i' } },
                { tags: { $regex: keyword, $options: 'i' } }
            ]
        };
        
        // 搜索小说
        const novels = await Novel.find(query)
            .sort({ readers: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .select('title authorName cover shortDescription status totalChapters readers collections');
            
        // 计算总数
        const total = await Novel.countDocuments(query);
        
        return res.status(200).json({
            success: true,
            count: novels.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            keyword,
            data: novels
        });
    } catch (error) {
        console.error('搜索小说失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 修复小说统计数据
export const fixNovelStats = async (req, res) => {
    try {
        const { novelId } = req.params;
        
        // 检查是否是管理员
        if (!req.user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: '只有管理员可以执行此操作'
            });
        }
        
        // 如果提供了特定小说ID，只修复该小说
        if (novelId && mongoose.Types.ObjectId.isValid(novelId)) {
            const novel = await Novel.findById(novelId);
            
            if (!novel) {
                return res.status(404).json({
                    success: false,
                    message: '未找到小说'
                });
            }
            
            console.log(`修复小说 ${novelId} 的统计数据`);
            
            // 更新字数统计
            await novel.updateWordCount();
            
            // 更新阅读量统计
            await novel.updateReadersCount();
            
            return res.status(200).json({
                success: true,
                message: `小说 ${novelId} 的统计数据已修复`,
                data: {
                    wordCount: novel.wordCount,
                    totalChapters: novel.totalChapters,
                    readers: novel.readers
                }
            });
        }
        
        // 如果没有提供ID，修复所有小说
        const novels = await Novel.find({});
        console.log(`修复所有 ${novels.length} 本小说的统计数据`);
        
        let updated = 0;
        let failed = 0;
        
        for (const novel of novels) {
            try {
                // 更新字数统计
                await novel.updateWordCount();
                
                // 更新阅读量统计
                await novel.updateReadersCount();
                
                updated++;
            } catch (error) {
                console.error(`修复小说 ${novel._id} 统计数据失败:`, error);
                failed++;
            }
        }
        
        return res.status(200).json({
            success: true,
            message: `已修复 ${updated} 本小说的统计数据，${failed} 本失败`,
            data: {
                total: novels.length,
                updated,
                failed
            }
        });
    } catch (error) {
        console.error('修复小说统计数据失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取指定作者的小说
export const getNovelsByAuthor = async (req, res) => {
    try {
        const { authorId } = req.params;
        console.log(`获取作者小说 - authorId: ${authorId}`);
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(authorId)) {
            return res.status(400).json({
                success: false,
                message: '无效的作者ID'
            });
        }
        
        // 查询该作者创建的所有小说（删除了不存在的isPublished验证）
        const novels = await Novel.find({ 
            creator: authorId
        })
        .select('title authorName cover shortDescription status totalChapters readers collections updatedAt categories tags')
        .sort({ updatedAt: -1 });
        
        console.log(`找到${novels.length}本小说`);
        
        return res.status(200).json({
            success: true,
            count: novels.length,
            data: novels
        });
    } catch (error) {
        console.error('获取作者小说列表失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
}; 