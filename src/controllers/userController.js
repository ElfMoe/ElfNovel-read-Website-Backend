import { User, ReadingHistory, Favorite, Novel, Chapter, FavoriteFolder } from '../models/index.js';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * 用户控制器 - 处理用户个人中心相关的API请求
 * 包括用户资料、阅读历史、收藏等功能
 */

// 获取当前用户信息
export const getCurrentUser = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 查询用户信息，不返回敏感字段
        const user = await User.findById(userId)
            .select('-emailVerificationToken -emailVerificationExpires');
            
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        return res.status(200).json({
            success: true,
            data: user
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新用户资料
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 提取请求体中的数据
        const { 
            username,
            avatar,
            penName,
            profile,
            readingPreferences
        } = req.body;
        
        // 查找用户
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 验证用户名唯一性
        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: '用户名已被使用'
                });
            }
            user.username = username;
        }
        
        // 记录笔名是否变更
        const penNameChanged = penName && penName !== user.penName;
        
        // 更新各字段
        if (avatar) user.avatar = avatar;
        if (penName) user.penName = penName;
        
        // 更新个人资料
        if (profile) {
            // 确保只更新允许的字段
            if (profile.nickname !== undefined) user.profile.nickname = profile.nickname;
            if (profile.bio !== undefined) user.profile.bio = profile.bio;
            if (profile.gender !== undefined) user.profile.gender = profile.gender;
            if (profile.birthday !== undefined) user.profile.birthday = profile.birthday;
            if (profile.location !== undefined) user.profile.location = profile.location;
            if (profile.website !== undefined) user.profile.website = profile.website;
        }
        
        // 更新阅读偏好设置
        if (readingPreferences) {
            if (readingPreferences.fontSize !== undefined) 
                user.readingPreferences.fontSize = readingPreferences.fontSize;
            if (readingPreferences.lineHeight !== undefined) 
                user.readingPreferences.lineHeight = readingPreferences.lineHeight;
            if (readingPreferences.theme !== undefined) 
                user.readingPreferences.theme = readingPreferences.theme;
            if (readingPreferences.fontFamily !== undefined) 
                user.readingPreferences.fontFamily = readingPreferences.fontFamily;
        }
        
        // 保存更新
        await user.save();
        
        // 如果笔名变更，则更新该用户创建的所有小说的笔名
        if (penNameChanged && user.penName) {
            try {
                // 更新小说中的笔名
                await Novel.updateMany(
                    { creator: userId },
                    { authorName: user.penName }
                );
                console.log(`用户 ${userId} 更新了笔名，已同步更新所有小说的作者名`);
            } catch (err) {
                console.error('同步更新小说笔名失败:', err);
                // 注意：这里我们不让笔名同步失败影响主流程
            }
        }
        
        return res.status(200).json({
            success: true,
            message: '个人资料更新成功',
            data: user
        });
    } catch (error) {
        console.error('更新用户资料失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新用户密码
export const updatePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;
        
        // 验证请求数据
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: '请提供当前密码和新密码'
            });
        }
        
        // 查找用户（需要包含密码字段）
        const user = await User.findById(userId).select('+password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 验证当前密码
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: '当前密码错误'
            });
        }
        
        // 更新密码
        user.password = newPassword;
        await user.save();
        
        return res.status(200).json({
            success: true,
            message: '密码更新成功'
        });
    } catch (error) {
        console.error('更新密码失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取阅读历史
export const getReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取阅读历史
        const histories = await ReadingHistory.find({ user: userId })
            .sort({ lastReadAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('novel', 'title authorName cover shortDescription status')
            .populate('lastChapter', 'title chapterNumber');
            
        // 计算总数
        const total = await ReadingHistory.countDocuments({ user: userId });
        
        return res.status(200).json({
            success: true,
            count: histories.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: histories
        });
    } catch (error) {
        console.error('获取阅读历史失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除阅读历史
export const deleteReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        // 如果提供了ID，删除特定历史记录
        if (id && mongoose.Types.ObjectId.isValid(id)) {
            await ReadingHistory.findOneAndDelete({ user: userId, _id: id });
            
            return res.status(200).json({
                success: true,
                message: '阅读历史记录删除成功'
            });
        } 
        // 否则删除所有历史记录
        else if (id === 'all') {
            await ReadingHistory.deleteMany({ user: userId });
            
            return res.status(200).json({
                success: true,
                message: '所有阅读历史记录删除成功'
            });
        } else {
            return res.status(400).json({
                success: false,
                message: '无效的ID'
            });
        }
    } catch (error) {
        console.error('删除阅读历史失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取收藏列表
export const getFavorites = async (req, res) => {
    try {
        console.log('开始处理getFavorites请求:', req.query);
        const userId = req.user.id;
        console.log('用户ID:', userId);
        const { limit = 20, page = 1, group } = req.query;
        
        try {
            // 使用安全的方法获取收藏列表
            console.log('开始查询收藏列表...');
            const favorites = await Favorite.getUserFavorites(userId, group, parseInt(limit), parseInt(page));
                
            console.log(`查询到 ${favorites.length} 个收藏`);
            
            // 计算总数
            const query = { user: userId };
            if (group) query.group = group;
            const total = await Favorite.countDocuments(query);
            console.log('收藏总数:', total);
            
            // 获取用户的阅读历史记录
            console.log('开始查询阅读历史...');
            const readingHistories = await ReadingHistory.findByUserId(userId, { limit: 100 });
            
            console.log(`查询到 ${readingHistories.length} 条阅读历史`);
            
            // 创建一个映射，存储每本小说的最后阅读时间
            const novelReadTimeMap = {};
            readingHistories.forEach(history => {
                if (!history.novel) {
                    console.error('阅读历史中缺少novel字段:', history);
                    return;
                }
                novelReadTimeMap[history.novel._id.toString()] = history.lastReadAt;
            });
            
            // 处理收藏列表，添加最后阅读时间信息
            const processedFavorites = favorites.map(favorite => {
                if (!favorite.novel || !favorite.novel._id) {
                    console.error('收藏中缺少novel或novel._id字段:', favorite);
                    return {
                        ...favorite.toObject(),
                        lastReadAt: null,
                        isRecentlyUpdated: false
                    };
                }
                
                const novelId = favorite.novel._id.toString();
                const lastReadAt = novelReadTimeMap[novelId] || null;
                
                // 获取小说更新时间
                const updatedAt = favorite.novel.updatedAt ? new Date(favorite.novel.updatedAt) : null;
                const addedAt = new Date(favorite.addedAt);
                
                // 判断是否最近更新（3天内）
                const isRecentlyUpdated = updatedAt && 
                    ((new Date() - updatedAt) / (1000 * 60 * 60 * 24) < 3) && // 3天内的更新
                    (!lastReadAt || updatedAt > new Date(lastReadAt)) && // 更新时间晚于最后访问时间
                    updatedAt > addedAt; // 更新时间晚于收藏时间
                
                return {
                    ...favorite.toObject(),
                    lastReadAt,
                    isRecentlyUpdated
                };
            });
            
            // 根据最后阅读时间和更新状态排序
            // 1. 最近阅读的排在最前面，无论是否有更新
            // 2. 有更新但未阅读的排在第二位
            // 3. 其他的按收藏时间排序
            processedFavorites.sort((a, b) => {
                // 如果两者都有阅读记录，按最后阅读时间排序
                if (a.lastReadAt && b.lastReadAt) {
                    return new Date(b.lastReadAt) - new Date(a.lastReadAt);
                }
                
                // 如果只有a有阅读记录，a排在前面
                if (a.lastReadAt) return -1;
                
                // 如果只有b有阅读记录，b排在前面
                if (b.lastReadAt) return 1;
                
                // 两者都没有阅读记录，比较更新状态
                if (a.isRecentlyUpdated && !b.isRecentlyUpdated) return -1;
                if (!a.isRecentlyUpdated && b.isRecentlyUpdated) return 1;
                
                // 两者更新状态相同，按收藏时间排序
                return new Date(b.addedAt) - new Date(a.addedAt);
            });
            
            // 临时注释掉获取分组，以便排查问题
            // const groups = await Favorite.getUserGroups(userId);
            
            console.log('准备返回处理后的数据');
            return res.status(200).json({
                success: true,
                count: processedFavorites.length,
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
                currentPage: parseInt(page),
                groups: [], // 临时返回空数组
                data: processedFavorites
            });
        } catch (innerError) {
            console.error('getFavorites内部处理错误:', innerError);
            console.error('错误堆栈:', innerError.stack);
            throw innerError;
        }
    } catch (error) {
        console.error('获取收藏列表失败:', error);
        console.error('错误堆栈:', error.stack);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 检查小说是否已收藏
export const checkFavoriteStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const novelId = req.params.id;
        
        console.log(`检查用户[${userId}]是否已收藏小说[${novelId}]`);
        
        // 查询数据库
        const favorite = await Favorite.findOne({ user: userId, novel: novelId });
        
        return res.status(200).json({
            success: true,
            isFavorite: !!favorite,
            data: favorite ? { id: favorite._id } : null
        });
    } catch (error) {
        console.error('检查收藏状态失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 添加收藏
export const addFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novel, novelId, group = '默认收藏夹' } = req.body;
        
        // 支持两种参数名称：novel或novelId
        const novelIdToUse = novel || novelId;
        
        if (!novelIdToUse) {
            return res.status(400).json({
                success: false,
                message: '缺少必要参数：novel或novelId'
            });
        }
        
        console.log(`用户[${userId}]尝试收藏小说[${novelIdToUse}]`);
        
        // 检查小说是否存在
        const novelExists = await Novel.findById(novelIdToUse);
        if (!novelExists) {
            return res.status(404).json({
                success: false,
                message: '小说不存在'
            });
        }
        
        // 检查是否已收藏
        const existingFavorite = await Favorite.findOne({ user: userId, novel: novelIdToUse });
        if (existingFavorite) {
            return res.status(400).json({
                success: false,
                message: '您已收藏过此小说'
            });
        }
        
        // 创建收藏记录
        const favorite = new Favorite({
            user: userId,
            novel: novelIdToUse,
            group
        });
        
        await favorite.save();
        
        return res.status(201).json({
            success: true,
            message: '收藏成功',
            data: favorite
        });
    } catch (error) {
        console.error('添加收藏失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新收藏
export const updateFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { group, notes } = req.body;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的收藏ID'
            });
        }
        
        // 找到对应的收藏
        const favorite = await Favorite.findOne({ _id: id, user: userId });
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: '未找到收藏或无权限修改'
            });
        }
        
        // 更新收藏信息
        if (group !== undefined) favorite.group = group;
        if (notes !== undefined) favorite.notes = notes;
        
        await favorite.save();
        
        return res.status(200).json({
            success: true,
            message: '收藏更新成功',
            data: favorite
        });
    } catch (error) {
        console.error('更新收藏失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除收藏
export const deleteFavorite = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        console.log(`尝试删除收藏，用户ID: ${userId}，参数ID: ${id}`);
        
        // 尝试当作收藏ID查询
        let favorite = null;
        
        // 判断ID是否是有效的ObjectId
        if (mongoose.Types.ObjectId.isValid(id)) {
            favorite = await Favorite.findOne({ _id: id, user: userId });
        }
        
        // 如果没找到，再尝试当作小说ID查询
        if (!favorite && mongoose.Types.ObjectId.isValid(id)) {
            console.log('尝试通过小说ID查找收藏');
            favorite = await Favorite.findOne({ novel: id, user: userId });
        }
        
        if (!favorite) {
            console.log('未找到匹配的收藏记录');
            return res.status(404).json({
                success: false,
                message: '未找到收藏或无权限删除'
            });
        }
        
        // 删除收藏
        console.log(`找到收藏记录，ID: ${favorite._id}`);
        
        // 删除收藏与文件夹的关联
        await FavoriteFolder.deleteMany({ user: userId, favorite: favorite._id });
        
        // MongoDB 4.x及以上版本使用deleteOne代替remove
        try {
            // 优先尝试使用remove()方法以触发中间件
            await favorite.remove(); 
        } catch (removeError) {
            console.log('remove()方法失败，尝试使用deleteOne()', removeError);
            await Favorite.deleteOne({ _id: favorite._id });
            
            // 手动更新小说收藏数量
            try {
                await Novel.findByIdAndUpdate(
                    favorite.novel,
                    { $inc: { collections: -1 } }
                );
            } catch (updateError) {
                console.error('手动更新小说收藏数失败:', updateError);
            }
        }
        
        return res.status(200).json({
            success: true,
            message: '收藏删除成功'
        });
    } catch (error) {
        console.error('删除收藏失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取阅读统计
export const getReadingStats = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 查找用户
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 更新并获取最新的阅读统计
        await user.updateReadingStats();
        
        const stats = {
            totalReadingTime: user.stats.totalReadingTime || 0,
            booksRead: user.stats.booksRead || 0,
            chaptersRead: user.stats.chaptersRead || 0,
            favoriteGenres: user.stats.favoriteGenres || []
        };
        
        return res.status(200).json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('获取阅读统计失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 上传用户头像
export const uploadAvatar = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 确保上传了文件
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '请选择要上传的头像图片'
            });
        }
        
        // 查找用户
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 更新用户头像
        user.avatar = `/uploads/${req.file.filename}`;
        await user.save();
        
        return res.status(200).json({
            success: true,
            message: '头像上传成功',
            data: {
                avatar: user.avatar
            }
        });
    } catch (error) {
        console.error('上传头像失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除账号
export const deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 查找用户
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 删除用户的相关数据
        // 1. 删除阅读历史
        await ReadingHistory.deleteMany({ user: userId });
        
        // 2. 删除收藏记录
        await Favorite.deleteMany({ user: userId });
        
        // 3. 如果是作者，可能需要处理他的作品
        if (user.role === 'author') {
            // 这里可以选择删除作品或改为匿名作者
            // 具体逻辑根据业务需求实现
            
            // 示例：将作者的作品标记为匿名
            await Novel.updateMany(
                { creator: userId },
                { authorName: '匿名作者', creator: null }
            );
        }
        
        // 4. 删除用户账号
        await User.findByIdAndDelete(userId);
        
        return res.status(200).json({
            success: true,
            message: '账号已成功删除'
        });
    } catch (error) {
        console.error('删除账号失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 添加/更新阅读历史
export const addReadingHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novel: novelId } = req.body;
        
        if (!novelId || !mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        console.log(`添加/更新阅读历史 - userId: ${userId}, novelId: ${novelId}`);
        
        // 检查小说是否存在
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '小说不存在'
            });
        }
        
        // 查找该小说的第一章
        const firstChapter = await Chapter.findOne({ novel: novelId }).sort({ chapterNumber: 1 });
        if (!firstChapter) {
            return res.status(404).json({
                success: false,
                message: '该小说没有章节'
            });
        }
        
        // 查找现有记录
        let history = await ReadingHistory.findOne({ user: userId, novel: novelId });
        
        // 如果没有记录，创建新记录
        if (!history) {
            history = new ReadingHistory({
                user: userId,
                novel: novelId,
                // 不再自动设置为第一章，保持为null表示未开始阅读
                lastChapter: null,
                readingProgress: 0,
                lastReadAt: new Date(),
                isCompleted: false
            });
            await history.save();
            console.log('新阅读历史已创建');
        } else {
            // 如果有记录，只更新最后访问时间
            history.lastReadAt = new Date();
            await history.save();
            console.log('阅读历史已更新');
        }
        
        return res.status(200).json({
            success: true,
            message: '阅读历史已更新',
            data: history
        });
    } catch (error) {
        console.error('添加/更新阅读历史失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新阅读进度
export const updateReadingProgress = async (req, res) => {
    try {
        const userId = req.user.id;
        const { novelId } = req.params;
        const { chapterId, lastReadChapter } = req.body;
        
        if (!novelId || !mongoose.Types.ObjectId.isValid(novelId)) {
            return res.status(400).json({
                success: false,
                message: '无效的小说ID'
            });
        }
        
        if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
            return res.status(400).json({
                success: false,
                message: '无效的章节ID'
            });
        }
        
        console.log(`更新阅读进度 - userId: ${userId}, novelId: ${novelId}, chapterId: ${chapterId}`);
        
        // 检查小说是否存在
        const novel = await Novel.findById(novelId);
        if (!novel) {
            return res.status(404).json({
                success: false,
                message: '小说不存在'
            });
        }
        
        // 检查章节是否存在
        const chapter = await Chapter.findById(chapterId);
        if (!chapter) {
            return res.status(404).json({
                success: false,
                message: '章节不存在'
            });
        }
        
        // 计算阅读进度
        const totalChapters = novel.totalChapters || 1;
        const progress = lastReadChapter ? 
            (parseFloat(lastReadChapter) / totalChapters) * 100 : 
            (parseFloat(chapter.chapterNumber) / totalChapters) * 100;
        
        // 更新阅读历史
        const history = await ReadingHistory.updateHistory(
            userId,
            novelId,
            chapterId,
            Math.min(progress, 100)
        );
        
        return res.status(200).json({
            success: true,
            message: '阅读进度已更新',
            data: history
        });
    } catch (error) {
        console.error('更新阅读进度失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取指定用户的公开信息
export const getUserProfileById = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`获取用户公开信息 - userId: ${userId}`);
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        
        // 查询用户基本信息（不包含敏感信息）
        const user = await User.findById(userId).select('username penName avatar bio createdAt');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '未找到用户'
            });
        }
        
        // 查询用户的统计信息（小说数、收藏数等）
        const novelCount = await Novel.countDocuments({ creator: userId });
        const favoriteCount = await Favorite.countDocuments({ user: userId });
        
        // 返回用户信息
        return res.status(200).json({
            success: true,
            data: {
                ...user.toObject(),
                novelCount,
                favoriteCount
            }
        });
    } catch (error) {
        console.error('获取用户公开信息失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取指定用户的收藏列表
export const getUserFavoritesById = async (req, res) => {
    try {
        const { userId } = req.params;
        console.log(`获取用户收藏 - userId: ${userId}`);
        
        // 检查ID格式
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: '无效的用户ID'
            });
        }
        
        // 获取查询参数
        const { limit = 20, page = 1, group } = req.query;
        
        // 查询该用户的收藏
        const favorites = await Favorite.getUserFavorites(userId, group, parseInt(limit), parseInt(page));
        
        // 计算总数
        const query = { user: userId };
        if (group) query.group = group;
        const total = await Favorite.countDocuments(query);
        
        // 处理收藏列表，添加必要的信息
        const processedFavorites = favorites.map(favorite => {
            if (!favorite.novel) {
                return {
                    ...favorite.toObject(),
                    lastReadAt: null,
                    isRecentlyUpdated: false
                };
            }
            
            return {
                ...favorite.toObject(),
                lastReadAt: null, // 公开访问不提供阅读时间
                isRecentlyUpdated: false // 公开访问不提供更新状态
            };
        });
        
        return res.status(200).json({
            success: true,
            count: processedFavorites.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            groups: [], // 公开访问不提供分组信息
            data: processedFavorites
        });
    } catch (error) {
        console.error('获取用户收藏列表失败:', error);
        console.error('错误堆栈:', error.stack);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
}; 