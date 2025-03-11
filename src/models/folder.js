import mongoose from 'mongoose';

/**
 * 收藏文件夹模型
 * 
 * 该模型存储用户创建的收藏文件夹信息
 * 每个用户可以创建多个文件夹，用于组织收藏的小说
 */
const folderSchema = new mongoose.Schema({
    // 关联的用户ID
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // 文件夹名称
    name: {
        type: String,
        required: true,
        trim: true
    },
    
    // 文件夹图标
    icon: {
        type: String,
        default: '📁',
        trim: true
    },
    
    // 是否是默认文件夹（全部收藏）
    isDefault: {
        type: Boolean,
        default: false
    },
    
    // 文件夹排序
    order: {
        type: Number,
        default: 0
    },
    
    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // 更新时间
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// 创建复合索引，确保每个用户的文件夹名称唯一
folderSchema.index({ user: 1, name: 1 }, { unique: true });

// 更新时间中间件
folderSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 为每个用户创建默认文件夹的静态方法
folderSchema.statics.createDefaultFolder = async function(userId) {
    try {
        if (!userId) {
            console.error('创建默认文件夹失败: 用户ID不能为空');
            return null;
        }
        
        // 检查是否已存在默认文件夹
        const existingDefault = await this.findOne({ user: userId, isDefault: true });
        if (existingDefault) {
            return existingDefault;
        }
        
        // 创建默认文件夹
        const defaultFolder = new this({
            user: userId,
            name: '全部收藏',
            icon: '📚',
            isDefault: true,
            order: -1 // 确保默认文件夹始终排在最前面
        });
        
        await defaultFolder.save();
        return defaultFolder;
    } catch (error) {
        console.error('创建默认文件夹失败:', error);
        // 不抛出错误，返回null
        return null;
    }
};

// 获取用户的所有文件夹
folderSchema.statics.getUserFolders = async function(userId) {
    try {
        const folders = await this.find({ user: userId })
            .sort({ order: 1, createdAt: 1 });
        
        return folders;
    } catch (error) {
        console.error('获取用户文件夹失败:', error);
        throw error;
    }
};

const Folder = mongoose.model('Folder', folderSchema);

export { Folder }; 