import { Novel, Chapter, User } from '../models/index.js';
import mongoose from 'mongoose';
import { uploadToCloudinary } from '../utils/cloudinaryUpload.js';

/**
 * 作者控制器 - 处理作者相关的API请求
 * 包括小说创建、编辑、发布章节等功能
 */

// 获取当前作者创建的所有小说
export const getMyNovels = async (req, res) => {
    try {
        const userId = req.user.id; // 从JWT中获取的用户ID
        
        // 查找该用户创建的所有小说
        const novels = await Novel.find({ creator: userId })
            .select('title authorName cover shortDescription status totalChapters readers collections updatedAt categories tags')
            .sort({ updatedAt: -1 });
            
        console.log('查询到作者小说数量:', novels.length);
        
        // 打印每本小说的categories和tags，帮助调试
        novels.forEach((novel, index) => {
            console.log(`小说 #${index + 1} ${novel.title}:`);
            console.log(`  - 分类:`, novel.categories);
            console.log(`  - 标签:`, novel.tags);
        });
            
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

// 获取单本小说的详细信息（作者视角）
export const getNovelDetail = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 查找小说并确认是当前用户创建的
        const novel = await Novel.findOne({ _id: novelId, creator: userId })
            .populate('latestChapter', 'title chapterNumber updatedAt');
            
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说或您没有权限查看'
            });
        }
        
        // 获取章节数量
        const chaptersCount = await Chapter.countDocuments({ novel: novelId });
        
        return res.status(200).json({
            success: true,
            data: {
                ...novel.toObject(),
                chaptersCount
            }
        });
    } catch (error) {
        console.error('获取小说详情失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 创建新小说
export const createNovel = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 记录整个请求体用于调试
        console.log('创建小说请求体:', JSON.stringify(req.body, null, 2));
        
        // 获取用户信息（包括笔名）
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 检查用户是否设置了笔名
        if (!user.penName) {
            return res.status(400).json({
                success: false,
                message: '请先在个人资料中设置笔名'
            });
        }
        
        // 提取请求体中的数据
        const { 
            title, 
            shortDescription, 
            longDescription, 
            categories,
            tags,
            status
        } = req.body;
        
        // 记录分类和标签信息
        console.log('小说分类:', categories, '类型:', Array.isArray(categories) ? 'Array' : typeof categories);
        console.log('小说标签:', tags, '类型:', Array.isArray(tags) ? 'Array' : typeof tags);
        
        // 确保分类和标签是数组
        let processedCategories = categories;
        let processedTags = tags;
        
        // 处理分类
        if (typeof categories === 'string') {
            try {
                // 尝试解析JSON字符串
                processedCategories = JSON.parse(categories);
            } catch (e) {
                // 如果解析失败，将字符串作为单个元素放入数组
                processedCategories = [categories];
            }
        } else if (!Array.isArray(categories)) {
            processedCategories = categories ? ['其他'] : ['其他'];
        }
        
        // 处理标签
        if (typeof tags === 'string') {
            try {
                // 尝试解析JSON字符串
                processedTags = JSON.parse(tags);
            } catch (e) {
                // 尝试分割字符串(可能是逗号分隔的)
                processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
            }
        } else if (!Array.isArray(tags)) {
            processedTags = tags ? [tags] : [];
        }
        
        console.log('处理后的分类:', processedCategories);
        console.log('处理后的标签:', processedTags);
        
        // 不再需要分类映射，现在允许任何分类
        console.log('现在支持任意分类值:', processedCategories);
        
        // 创建新小说
        const newNovel = new Novel({
            title,
            authorName: user.penName, // 使用用户的笔名
            shortDescription,
            longDescription,
            categories: processedCategories,
            tags: processedTags,
            status,
            creator: userId
        });
        
        // 保存到数据库
        await newNovel.save();
        
        return res.status(201).json({
            success: true,
            message: '小说创建成功',
            data: newNovel
        });
    } catch (error) {
        console.error('创建小说失败:', error);
        
        // 处理唯一性约束错误
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: '已存在同名小说，请修改标题后重试'
            });
        }
        
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新小说信息
export const updateNovel = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        // 记录整个请求体和文件信息用于调试
        console.log('更新小说请求体:', JSON.stringify(req.body, null, 2));
        console.log('更新小说请求文件:', req.file);
        
        // 获取用户信息（包括笔名）
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 检查用户是否设置了笔名
        if (!user.penName) {
            return res.status(400).json({
                success: false,
                message: '请先在个人资料中设置笔名'
            });
        }
        
        // 查找小说
        const novel = await Novel.findById(novelId);
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说'
            });
        }
        
        // 验证用户权限
        if (novel.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: '您没有权限编辑此小说'
            });
        }
        
        // 提取请求体中的数据
        const { 
            title, 
            shortDescription, 
            longDescription, 
            categories,
            tags,
            status
        } = req.body;
        
        // 记录分类和标签信息
        console.log('小说分类:', categories, '类型:', Array.isArray(categories) ? 'Array' : typeof categories);
        console.log('小说标签:', tags, '类型:', Array.isArray(tags) ? 'Array' : typeof tags);
        
        // 确保分类和标签是数组
        let processedCategories = categories;
        let processedTags = tags;
        
        // 处理分类
        if (typeof categories === 'string') {
            try {
                // 尝试解析JSON字符串
                processedCategories = JSON.parse(categories);
            } catch (e) {
                // 如果是categories[]格式
                if (categories.includes('categories[]')) {
                    processedCategories = req.body['categories[]'] || ['其他'];
                } else {
                    // 如果解析失败，将字符串作为单个元素放入数组
                    processedCategories = [categories];
                }
            }
        } else if (!Array.isArray(categories)) {
            // 检查是否有categories[]字段
            if (req.body['categories[]']) {
                processedCategories = Array.isArray(req.body['categories[]']) ? 
                    req.body['categories[]'] : [req.body['categories[]']];
            } else {
                processedCategories = categories ? ['其他'] : ['其他'];
            }
        }
        
        // 处理标签
        if (typeof tags === 'string') {
            try {
                // 尝试解析JSON字符串
                processedTags = JSON.parse(tags);
            } catch (e) {
                // 如果是tags[]格式
                if (tags.includes('tags[]')) {
                    processedTags = req.body['tags[]'] || [];
                } else {
                    // 尝试分割字符串(可能是逗号分隔的)
                    processedTags = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                }
            }
        } else if (!Array.isArray(tags)) {
            // 检查是否有tags[]字段
            if (req.body['tags[]']) {
                processedTags = Array.isArray(req.body['tags[]']) ? 
                    req.body['tags[]'] : [req.body['tags[]']];
            } else {
                processedTags = tags ? [tags] : [];
            }
        }
        
        console.log('处理后的分类:', processedCategories);
        console.log('处理后的标签:', processedTags);
        
        // 不再需要分类映射，现在允许任何分类
        console.log('现在支持任意分类值:', processedCategories);
        
        // 更新小说
        novel.title = title;
        // 更新笔名，使用用户当前的笔名
        novel.authorName = user.penName;
        novel.shortDescription = shortDescription;
        novel.longDescription = longDescription;
        novel.categories = processedCategories || ['其他'];
        novel.tags = processedTags || [];
        
        // 检查状态是否从"已完结"变为"连载中"
        const statusChanged = novel.status === '已完结' && status === '连载中';
        
        // 更新状态
        novel.status = status;
        
        // 保存更新
        await novel.save();
        
        // 如果状态从"已完结"变为"连载中"，取消所有章节的番外标记
        if (statusChanged) {
            await Chapter.updateMany(
                { novel: novelId, isExtra: true },
                { $set: { isExtra: false } }
            );
            console.log(`小说 ${novel.title} 状态从已完结变为连载中，已重置所有番外章节标记`);
        }
        
        return res.status(200).json({
            success: true,
            message: '小说信息更新成功',
            data: novel
        });
    } catch (error) {
        console.error('更新小说失败:', error);
        console.error('错误堆栈:', error.stack);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除小说
export const deleteNovel = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 查找小说并确认是当前用户创建的
        const novel = await Novel.findOne({ _id: novelId, creator: userId });
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说或您没有权限删除'
            });
        }
        
        // 删除该小说的所有章节
        await Chapter.deleteMany({ novel: novelId });
        
        // 删除小说
        await Novel.findByIdAndDelete(novelId);
        
        // 更新用户的作者统计信息
        const user = await User.findById(userId);
        await user.updateAuthorStats();
        
        return res.status(200).json({
            success: true,
            message: '小说删除成功'
        });
    } catch (error) {
        console.error('删除小说失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取小说的所有章节
export const getNovelChapters = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 确认小说属于当前用户
        const novel = await Novel.findOne({ _id: novelId, creator: userId });
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说或您没有权限查看'
            });
        }
        
        // 获取所有章节，只返回必要字段
        const chapters = await Chapter.find({ novel: novelId })
            .select('title chapterNumber wordCount viewCount isPremium isExtra updatedAt')
            .sort({ chapterNumber: 1 });
            
        return res.status(200).json({
            success: true,
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

// 获取单个章节详情
export const getChapterDetail = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.id;
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(chapterId)) {
            return res.status(400).json({
                success: false,
                message: '无效的章节ID'
            });
        }
        
        // 获取章节并填充小说信息
        const chapter = await Chapter.findById(chapterId).populate('novel', 'title creator');
        
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '未找到章节'
            });
        }
        
        // 确认小说属于当前用户
        if (chapter.novel.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: '您没有权限查看该章节'
            });
        }
        
        return res.status(200).json({
            success: true,
            data: chapter
        });
    } catch (error) {
        console.error('获取章节详情失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 创建新章节
export const createChapter = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        
        // 检查小说ID格式
        if (!mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        // 确认小说属于当前用户
        const novel = await Novel.findOne({ _id: novelId, creator: userId });
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说或您没有权限添加章节'
            });
        }
        
        // 提取请求体中的数据
        const { title, content, chapterNumber, isPremium, price, isExtra: requestIsExtra } = req.body;
        
        // 验证必填字段
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: '请提供章节标题和内容'
            });
        }
        
        // 确定是否标记为番外
        let isExtra = requestIsExtra !== undefined ? Boolean(requestIsExtra) : false;
        if (novel.status === '已完结' && requestIsExtra === undefined) {
            isExtra = true;
        }
        
        // 如果没有提供章节号，根据章节类型决定下一个章节号
        let nextChapterNumber = chapterNumber;
        if (!nextChapterNumber) {
            if (!isExtra) {
                // 如果是正常章节，只查找非番外章节的最大章节号
                const lastRegularChapter = await Chapter.findOne({ 
                    novel: novelId,
                    isExtra: false 
                }).sort({ chapterNumber: -1 });
                
                nextChapterNumber = lastRegularChapter ? lastRegularChapter.chapterNumber + 1 : 1;
            } else {
                // 如果是番外章节，使用与普通章节相同的编号逻辑，但会通过isExtra字段区分
                const lastChapter = await Chapter.findOne({ novel: novelId })
                    .sort({ chapterNumber: -1 });
                    
                nextChapterNumber = lastChapter ? lastChapter.chapterNumber + 1 : 1;
            }
        }
        
        // 检查章节号是否已存在
        const existingChapter = await Chapter.findOne({ 
            novel: novelId, 
            chapterNumber: nextChapterNumber,
            isExtra: isExtra // 添加isExtra条件，确保只在相同类型的章节中检查唯一性
        });
        
        if (existingChapter) {
            return res.status(400).json({
                success: false,
                message: `${isExtra ? '番外' : '章节号'} ${nextChapterNumber} 已存在，请使用其他章节号`
            });
        }
        
        // 创建新章节
        const chapter = new Chapter({
            novel: novelId,
            title,
            content,
            chapterNumber: nextChapterNumber,
            isPremium: isPremium || false,
            price: isPremium ? (price || 0) : 0,
            isExtra
        });
        
        // 保存章节
        await chapter.save();
        
        // 更新小说的最新章节
        novel.latestChapter = chapter._id;
        await novel.save();
        
        return res.status(201).json({
            success: true,
            message: '章节创建成功',
            data: chapter
        });
    } catch (error) {
        console.error('创建章节失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新章节
export const updateChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.id;
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(chapterId)) {
            return res.status(400).json({
                success: false,
                message: '无效的章节ID'
            });
        }
        
        // 获取章节并填充小说信息
        const chapter = await Chapter.findById(chapterId).populate('novel', 'creator status');
        
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '未找到章节'
            });
        }
        
        // 确认小说属于当前用户
        if (chapter.novel.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: '您没有权限修改该章节'
            });
        }
        
        // 提取请求体中的数据
        const { title, content, chapterNumber, isPremium, price, isExtra } = req.body;
        
        // 验证番外标记：如果小说已完结，不允许取消番外标记
        if (chapter.novel.status === '已完结' && isExtra === false) {
            return res.status(400).json({
                success: false,
                message: '小说已完结，无法取消章节的番外标记。如需取消，请先将小说状态改为"连载中"'
            });
        }
        
        // 更新章节字段（只更新提供的字段）
        if (title) chapter.title = title;
        if (content) chapter.content = content;
        if (chapterNumber !== undefined) {
            // 检查新章节号是否已存在
            if (chapterNumber !== chapter.chapterNumber) {
                const existingChapter = await Chapter.findOne({ 
                    novel: chapter.novel._id, 
                    chapterNumber,
                    _id: { $ne: chapterId } // 排除当前章节
                });
                
                if (existingChapter) {
                    return res.status(400).json({
                        success: false,
                        message: `章节号 ${chapterNumber} 已存在，请使用其他章节号`
                    });
                }
                
                chapter.chapterNumber = chapterNumber;
            }
        }
        if (isPremium !== undefined) chapter.isPremium = isPremium;
        if (isPremium && price !== undefined) chapter.price = price;
        if (isExtra !== undefined) chapter.isExtra = isExtra;
        
        // 保存更新
        await chapter.save();
        
        return res.status(200).json({
            success: true,
            message: '章节更新成功',
            data: chapter
        });
    } catch (error) {
        console.error('更新章节失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除章节
export const deleteChapter = async (req, res) => {
    try {
        const { chapterId } = req.params;
        const userId = req.user.id;
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(chapterId)) {
            return res.status(400).json({
                success: false,
                message: '无效的章节ID'
            });
        }
        
        // 获取章节并填充小说信息
        const chapter = await Chapter.findById(chapterId).populate('novel', 'creator latestChapter');
        
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '未找到章节'
            });
        }
        
        // 确认小说属于当前用户
        if (chapter.novel.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: '您没有权限删除该章节'
            });
        }
        
        const novelId = chapter.novel._id;
        
        // 使用findOneAndDelete以触发pre钩子
        const deleteResult = await Chapter.findOneAndDelete({ _id: chapterId });
        console.log('章节删除结果:', deleteResult ? '成功' : '失败');
        
        // 即使有钩子，也显式更新小说信息作为双重保障
        try {
            console.log(`控制器: 正在显式更新小说 ${novelId} 的信息`);
            const novel = await Novel.findById(novelId);
            if (novel) {
                // 更新最新章节引用（如果删除的是最新章节）
                if (novel.latestChapter && novel.latestChapter.toString() === chapterId) {
                    console.log(`控制器: 删除的是最新章节，更新最新章节引用`);
                    const latestChapter = await Chapter.findOne({ 
                        novel: novelId,
                        _id: { $ne: chapterId }
                    }).sort({ chapterNumber: -1 });
                    
                    novel.latestChapter = latestChapter ? latestChapter._id : null;
                }
                
                // 更新章节数和字数统计
                console.log(`控制器: 更新小说 ${novelId} 的字数统计`);
                await novel.updateWordCount();
                console.log(`控制器: 小说 ${novelId} 更新完成`);
            } else {
                console.log(`控制器: 未找到小说 ${novelId}`);
            }
        } catch (updateError) {
            console.error('控制器: 显式更新小说信息失败:', updateError);
            // 记录错误但不影响响应
        }
        
        return res.status(200).json({
            success: true,
            message: '章节删除成功'
        });
    } catch (error) {
        console.error('删除章节失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取作者统计数据
export const getAuthorStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 获取用户信息，包括作者统计
        const user = await User.findById(userId);
        
        // 更新作者统计数据
        await user.updateAuthorStats();
        
        // 添加调试日志
        console.log('作者统计数据:', JSON.stringify(user.authorProfile, null, 2));
        console.log('总章节数:', user.authorProfile.totalChapters);
        
        // 直接计算章节总数进行验证
        const novels = await Novel.find({ creator: userId });
        const novelIds = novels.map(novel => novel._id);
        const directChapterCount = await Chapter.countDocuments({ novel: { $in: novelIds } });
        console.log(`直接计算的章节总数: ${directChapterCount}`);
        
        // 确保统计数据正确
        if (user.authorProfile.totalChapters !== directChapterCount) {
            console.log('章节总数不匹配，使用直接计算的结果');
            user.authorProfile.totalChapters = directChapterCount;
            await user.save();
        }
        
        // 获取最受欢迎的小说
        const popularNovels = await Novel.find({ creator: userId })
            .sort({ readers: -1 })
            .limit(5)
            .select('title authorName cover readers collections');
            
        // 获取最新更新的小说
        const recentNovels = await Novel.find({ creator: userId })
            .sort({ updatedAt: -1 })
            .limit(5)
            .select('title authorName cover updatedAt');
            
        return res.status(200).json({
            success: true,
            data: {
                authorStats: {
                    ...user.authorProfile,
                    totalChapters: directChapterCount // 使用直接计算的章节总数
                },
                popularNovels,
                recentNovels
            }
        });
    } catch (error) {
        console.error('获取作者统计失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 上传小说封面
export const uploadNovelCover = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        // 检查小说是否存在且属于当前用户
        const novel = await Novel.findOne({ _id: novelId, creator: userId });
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '找不到该小说或您没有权限修改'
            });
        }
        
        // 检查请求中是否有文件上传
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请上传封面图片'
            });
        }
        
        console.log('上传文件信息:', req.file);
        
        // 上传到Cloudinary
        const cloudinaryResult = await uploadToCloudinary(req.file.path, 'novel-covers');
        
        if (!cloudinaryResult.success) {
            return res.status(500).json({
                success: false,
                message: '封面上传失败: ' + cloudinaryResult.error
            });
        }
        
        console.log('Cloudinary上传结果:', cloudinaryResult);
        
        // 保存旧封面的public_id用于可能的删除
        const oldCoverPublicId = novel.coverPublicId;
        
        // 更新小说封面信息
        novel.cover = cloudinaryResult.url;
        novel.coverPublicId = cloudinaryResult.public_id;
        novel.useCustomCover = true;
        
        await novel.save();
        
        return res.status(200).json({
            success: true,
            message: '封面上传成功',
            data: {
                cover: novel.cover,
                useCustomCover: novel.useCustomCover
            }
        });
    } catch (error) {
        console.error('上传小说封面失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 设置小说封面模板
export const setNovelCoverTemplate = async (req, res) => {
    try {
        const { novelId } = req.params;
        const { templateId } = req.body;
        const userId = req.user.id;
        
        // 验证模板ID
        if (!templateId || !Number.isInteger(Number(templateId)) || Number(templateId) < 1 || Number(templateId) > 6) {
            return res.status(400).json({
                success: false,
                message: '无效的模板ID，请提供1-6之间的整数'
            });
        }
        
        // 检查小说是否存在且属于当前用户
        const novel = await Novel.findOne({ _id: novelId, creator: userId });
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '找不到该小说或您没有权限修改'
            });
        }
        
        // 更新小说封面模板信息
        novel.coverTemplate = Number(templateId);
        novel.useCustomCover = false;
        
        // 设置特殊的封面路径，前端可以根据该路径识别使用哪个模板
        novel.cover = `/templates/cover-template-${templateId}.jpg`;
        
        await novel.save();
        
        return res.status(200).json({
            success: true,
            message: '封面模板设置成功',
            data: {
                cover: novel.cover,
                coverTemplate: novel.coverTemplate,
                useCustomCover: novel.useCustomCover
            }
        });
    } catch (error) {
        console.error('设置小说封面模板失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 单独更新小说状态的接口
export const updateNovelStatus = async (req, res) => {
    try {
        const { novelId } = req.params;
        const userId = req.user.id;
        
        // 查找小说
        const novel = await Novel.findById(novelId);
        
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '未找到小说'
            });
        }
        
        // 验证用户权限
        if (novel.creator.toString() !== userId) {
            return res.status(403).json({
                success: false,
                message: '您没有权限编辑此小说'
            });
        }
        
        // 提取请求体中的状态
        const { status } = req.body;
        
        if (!status) {
            return res.status(400).json({
                success: false,
                message: '请提供小说状态'
            });
        }
        
        // 检查状态是否有效
        if (!['连载中', '已完结', '暂停更新'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说状态'
            });
        }
        
        // 检查状态是否从"已完结"变为"连载中"
        const statusChanged = novel.status === '已完结' && status === '连载中';
        
        // 更新状态
        novel.status = status;
        
        // 使用Mongoose的updateOne方法，跳过验证
        await Novel.updateOne({ _id: novelId }, { status: status });
        
        // 如果状态从"已完结"变为"连载中"，取消所有章节的番外标记
        if (statusChanged) {
            await Chapter.updateMany(
                { novel: novelId, isExtra: true },
                { $set: { isExtra: false } }
            );
            console.log(`小说 ${novel.title} 状态从已完结变为连载中，已重置所有番外章节标记`);
        }
        
        return res.status(200).json({
            success: true,
            message: '小说状态更新成功',
            data: { status }
        });
    } catch (error) {
        console.error('更新小说状态失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
}; 