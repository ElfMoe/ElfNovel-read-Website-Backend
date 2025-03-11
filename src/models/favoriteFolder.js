import mongoose from 'mongoose';

/**
 * 收藏与文件夹关联模型
 * 
 * 该模型存储收藏与文件夹的多对多关系
 * 一个收藏可以属于多个文件夹，一个文件夹可以包含多个收藏
 */
const favoriteFolderSchema = new mongoose.Schema({
    // 关联的用户ID
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // 关联的收藏ID
    favorite: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Favorite',
        required: true
    },
    
    // 关联的文件夹ID
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        required: true
    },
    
    // 添加时间
    addedAt: {
        type: Date,
        default: Date.now
    }
});

// 创建复合索引，确保每个用户的每个收藏在每个文件夹中只有一条记录
favoriteFolderSchema.index({ user: 1, favorite: 1, folder: 1 }, { unique: true });

// 获取小说所在的所有文件夹
favoriteFolderSchema.statics.getFavoriteFolders = async function(favoriteId) {
    try {
        const relations = await this.find({ favorite: favoriteId })
            .populate('folder', 'name icon isDefault');
        
        return relations.map(rel => rel.folder);
    } catch (error) {
        console.error('获取收藏文件夹失败:', error);
        throw error;
    }
};

// 获取文件夹中的所有小说
favoriteFolderSchema.statics.getFolderFavorites = async function(folderId, limit = 20, page = 1) {
    try {
        const skip = (page - 1) * limit;
        
        const relations = await this.find({ folder: folderId })
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'favorite',
                populate: {
                    path: 'novel',
                    select: 'title authorName cover shortDescription status totalChapters updatedAt'
                }
            });
        
        return relations.map(rel => rel.favorite);
    } catch (error) {
        console.error('获取文件夹收藏列表失败:', error);
        throw error;
    }
};

// 添加收藏到文件夹
favoriteFolderSchema.statics.addToFolder = async function(userId, favoriteId, folderId) {
    try {
        // 检查是否已存在关联
        const existing = await this.findOne({ 
            user: userId,
            favorite: favoriteId, 
            folder: folderId 
        });
        
        if (existing) {
            return existing;
        }
        
        // 创建新关联
        const relation = new this({
            user: userId,
            favorite: favoriteId,
            folder: folderId
        });
        
        await relation.save();
        return relation;
    } catch (error) {
        console.error('添加收藏到文件夹失败:', error);
        throw error;
    }
};

// 从文件夹中移除收藏
favoriteFolderSchema.statics.removeFromFolder = async function(userId, favoriteId, folderId) {
    try {
        const result = await this.deleteOne({ 
            user: userId,
            favorite: favoriteId, 
            folder: folderId 
        });
        return result.deletedCount > 0;
    } catch (error) {
        console.error('从文件夹移除收藏失败:', error);
        throw error;
    }
};

// 当收藏被删除时，删除所有相关的文件夹关联
favoriteFolderSchema.statics.removeAllForFavorite = async function(userId, favoriteId) {
    try {
        const result = await this.deleteMany({ 
            user: userId,
            favorite: favoriteId 
        });
        return result.deletedCount;
    } catch (error) {
        console.error('删除收藏的文件夹关联失败:', error);
        throw error;
    }
};

const FavoriteFolder = mongoose.model('FavoriteFolder', favoriteFolderSchema);

export { FavoriteFolder }; 