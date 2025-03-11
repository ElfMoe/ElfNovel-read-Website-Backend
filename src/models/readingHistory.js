import mongoose from 'mongoose';

/**
 * 阅读历史记录模型
 * 
 * 该模型存储用户的阅读历史记录，包括小说、章节、阅读进度等信息
 * 与用户、小说和章节形成多对多的关系
 */
const readingHistorySchema = new mongoose.Schema({
    // 关联的用户ID
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // 关联的小说ID
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true,
        index: true
    },
    
    // 最近阅读的章节ID
    lastChapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        required: true
    },
    
    // 阅读进度（百分比）
    readingProgress: {
        type: Number,
        default: 0,  // 0-100的百分比
        min: 0,
        max: 100
    },
    
    // 上次阅读时间
    lastReadAt: {
        type: Date,
        default: Date.now
    },
    
    // 阅读总时长（分钟）
    totalReadingTime: {
        type: Number,
        default: 0
    },
    
    // 是否已读完
    isCompleted: {
        type: Boolean,
        default: false
    },
    
    // 阅读笔记
    notes: {
        type: String,
        default: ''
    },
    
    // 用户评分
    rating: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    }
});

// 创建复合索引，确保每个用户对每本小说只有一条记录
readingHistorySchema.index({ user: 1, novel: 1 }, { unique: true });

// 更新阅读历史的方法
readingHistorySchema.statics.updateHistory = async function(userId, novelId, chapterId, progress = 0) {
    try {
        // 查找现有记录或创建新记录
        const history = await this.findOneAndUpdate(
            { user: userId, novel: novelId },
            { 
                lastChapter: chapterId,
                lastReadAt: Date.now(),
                readingProgress: progress,
                $inc: { totalReadingTime: 1 } // 每次更新增加1分钟的阅读时间（简化处理）
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        
        return history;
    } catch (error) {
        console.error('更新阅读历史失败:', error);
        throw error;
    }
};

// 获取用户最近阅读的小说列表
readingHistorySchema.statics.getRecentlyRead = async function(userId, limit = 10) {
    try {
        const histories = await this.find({ user: userId })
            .sort({ lastReadAt: -1 })
            .limit(limit)
            .populate('novel', 'title author cover')
            .populate('lastChapter', 'title chapterNumber');
            
        return histories;
    } catch (error) {
        console.error('获取最近阅读失败:', error);
        throw error;
    }
};

// 获取用户阅读统计
readingHistorySchema.statics.getUserReadingStats = async function(userId) {
    try {
        const stats = await this.aggregate([
            { $match: { user: mongoose.Types.ObjectId(userId) } },
            { $group: {
                _id: null,
                totalNovels: { $sum: 1 },
                completedNovels: { $sum: { $cond: ["$isCompleted", 1, 0] } },
                totalReadingTime: { $sum: "$totalReadingTime" }
            }}
        ]);
        
        return stats.length > 0 ? stats[0] : { totalNovels: 0, completedNovels: 0, totalReadingTime: 0 };
    } catch (error) {
        console.error('获取用户阅读统计失败:', error);
        throw error;
    }
};

// 自定义静态方法
readingHistorySchema.statics.findByUserId = async function(userId, options = {}) {
    try {
        const { limit = 20, page = 1, includeNovel = true } = options;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        console.log(`查询用户 ${userId} 的阅读历史, limit: ${limit}, page: ${page}`);
        
        // 构建查询管道
        let query = this.find({ user: userId })
                     .sort({ lastReadAt: -1 })
                     .skip(skip)
                     .limit(parseInt(limit));
        
        // 如果需要，填充小说和章节信息
        if (includeNovel) {
            query = query.populate({
                path: 'novel',
                select: 'title cover authorName lastUpdated status',
                // 添加额外检查，确保novel字段存在
                match: { _id: { $exists: true } }
            }).populate({
                path: 'lastChapter',
                select: 'title chapterNumber'
            });
        }
        
        const histories = await query;
        
        // 过滤掉任何novel为null的记录
        const validHistories = histories.filter(history => history.novel != null);
        
        if (validHistories.length !== histories.length) {
            console.log(`过滤掉了 ${histories.length - validHistories.length} 条无效的阅读历史记录`);
        }
        
        return validHistories;
    } catch (error) {
        console.error('查询用户阅读历史失败:', error);
        throw error;
    }
};

const ReadingHistory = mongoose.model('ReadingHistory', readingHistorySchema);

export { ReadingHistory }; 