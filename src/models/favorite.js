import mongoose from 'mongoose';

/**
 * 收藏模型
 * 
 * 该模型存储用户收藏的小说信息
 * 与用户和小说形成多对多的关系
 */
const favoriteSchema = new mongoose.Schema({
    // 关联的用户ID
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // 关联的小说ID
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    
    // 收藏时间
    addedAt: {
        type: Date,
        default: Date.now
    },
    
    // 收藏分组/标签
    group: {
        type: String,
        default: '默认收藏夹',
        trim: true
    },
    
    // 收藏备注
    notes: {
        type: String,
        default: '',
        trim: true
    },
    
    // 收藏排序（用户可以自定义排序）
    order: {
        type: Number,
        default: 0
    }
});

// 创建复合索引，确保每个用户对每本小说只有一条收藏记录
favoriteSchema.index({ user: 1, novel: 1 }, { unique: true });

// 增加小说收藏数的方法
favoriteSchema.post('save', async function() {
    try {
        // 获取Novel模型
        const Novel = mongoose.model('Novel');
        await Novel.findByIdAndUpdate(
            this.novel,
            { $inc: { collections: 1 } }
        );
    } catch (error) {
        console.error('更新小说收藏数失败:', error);
    }
});

// 减少小说收藏数的方法
favoriteSchema.post('remove', async function() {
    try {
        // 获取Novel模型
        const Novel = mongoose.model('Novel');
        await Novel.findByIdAndUpdate(
            this.novel,
            { $inc: { collections: -1 } }
        );
    } catch (error) {
        console.error('更新小说收藏数失败:', error);
    }
});

// 获取用户的收藏列表
favoriteSchema.statics.getUserFavorites = async function(userId, group = null, limit = 20, page = 1) {
    try {
        console.log(`获取用户 ${userId} 的收藏列表, group: ${group}, limit: ${limit}, page: ${page}`);
        
        const query = { user: userId };
        if (group) {
            query.group = group;
        }
        
        const skip = (page - 1) * limit;
        
        const favorites = await this.find(query)
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'novel',
                // 扩展select，确保包含categories和tags，以及读者和收藏数量字段
                select: 'title authorName cover shortDescription status totalChapters updatedAt categories tags readers collections',
                // 添加额外检查，确保novel字段存在
                match: { _id: { $exists: true } }
            });
        
        console.log(`找到 ${favorites.length} 个收藏记录`);
        // 调试查询结果
        favorites.forEach((fav, index) => {
            console.log(`收藏 #${index + 1}: ${fav.novel ? fav.novel.title : '无效小说'}`);
            if (fav.novel) {
                console.log(`  - 分类: ${JSON.stringify(fav.novel.categories || [])}`);
                console.log(`  - 标签: ${JSON.stringify(fav.novel.tags || [])}`);
            }
        });
            
        // 过滤掉任何novel为null的记录
        const validFavorites = favorites.filter(favorite => favorite.novel != null);
        
        if (validFavorites.length !== favorites.length) {
            console.log(`过滤掉了 ${favorites.length - validFavorites.length} 条无效的收藏记录`);
        }
        
        return validFavorites;
    } catch (error) {
        console.error('获取用户收藏列表失败:', error);
        throw error;
    }
};

// 获取用户的收藏分组
favoriteSchema.statics.getUserGroups = async function(userId) {
    try {
        const groups = await this.aggregate([
            { $match: { user: mongoose.Types.ObjectId(userId) } },
            { $group: {
                _id: "$group",
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);
        
        return groups.map(g => ({ name: g._id, count: g.count }));
    } catch (error) {
        console.error('获取用户收藏分组失败:', error);
        throw error;
    }
};

// 检查用户是否已收藏小说
favoriteSchema.statics.isNovelFavorited = async function(userId, novelId) {
    try {
        const favorite = await this.findOne({ user: userId, novel: novelId });
        return !!favorite;
    } catch (error) {
        console.error('检查收藏状态失败:', error);
        throw error;
    }
};

const Favorite = mongoose.model('Favorite', favoriteSchema);

export { Favorite }; 