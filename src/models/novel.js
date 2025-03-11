import mongoose from 'mongoose';

/**
 * 小说模型
 * 
 * 该模型存储小说的基本信息，如标题、作者、描述等
 * 设计参考了前端需求，包含了小说详情页和章节列表所需的字段
 */
const novelSchema = new mongoose.Schema({
    // 基本信息
    title: {
        type: String,
        required: [true, '标题是必需的'],
        trim: true,
        maxlength: [100, '标题不能超过100个字符']
    },
    
    // 笔名 - 显示给读者看的作者名
    authorName: {
        type: String,
        required: [true, '笔名是必需的'],
        trim: true,
        maxlength: [50, '笔名不能超过50个字符']
    },
    
    // 实际作者 - 关联到用户账号
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    cover: {
        type: String,
        default: '/images/default-cover.jpg' // 默认封面路径
    },
    
    // 封面模板设置
    coverTemplate: {
        type: Number,
        default: 1 // 默认模板ID
    },
    
    // 是否使用自定义封面
    useCustomCover: {
        type: Boolean,
        default: false
    },
    
    // 描述信息
    shortDescription: {
        type: String,
        required: [true, '简短描述是必需的'],
        trim: true,
        maxlength: [200, '简短描述不能超过200个字符']
    },
    
    longDescription: {
        type: String,
        required: [true, '详细描述是必需的'],
        trim: true
    },
    
    // 分类与标签
    categories: [{
        type: String,
        trim: true,
        default: '其他'
    }],
    
    tags: [{
        type: String,
        trim: true
    }],
    
    // 状态信息
    status: {
        type: String,
        enum: ['连载中', '已完结', '暂停更新'],
        default: '连载中'
    },
    
    // 统计信息
    wordCount: {
        type: Number,
        default: 0
    },
    
    totalChapters: {
        type: Number,
        default: 0
    },
    
    readers: {
        type: Number,
        default: 0
    },
    
    collections: {
        type: Number,
        default: 0
    },
    
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    
    // 时间信息
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    // 章节引用 - 使用引用关系而不是嵌入，以优化性能
    chapters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter'
    }],
    
    // 最新章节信息 - 用于首页展示
    latestChapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter'
    }
});

// 更新小说时自动更新updatedAt字段
novelSchema.pre('save', function(next) {
    console.log(`pre save钩子：保存小说 ${this._id}`);
    
    // 检查修改的字段
    const modifiedPaths = this.modifiedPaths();
    console.log(`修改的字段:`, modifiedPaths);
    
    // 如果是新文档或者修改了文档，则更新updatedAt
    if (this.isNew || modifiedPaths.length > 0) {
        console.log(`小说 ${this._id} 已修改，更新updatedAt字段`);
        this.updatedAt = Date.now();
    }
    
    next();
});

// 定义虚拟字段 latestChapters，返回最近的几章
novelSchema.virtual('latestChapters', {
    ref: 'Chapter',
    localField: '_id',
    foreignField: 'novel',
    options: { sort: { createdAt: -1 }, limit: 5 } // 获取最新的5章
});

// 方法：更新小说字数统计
novelSchema.methods.updateWordCount = async function() {
    try {
        const Chapter = mongoose.model('Chapter');
        
        console.log(`更新小说 ${this._id} 的字数统计开始`);
        
        // 使用lean()获取原始数据，提高性能
        const chapters = await Chapter.find({ novel: this._id }).lean();
        
        console.log(`更新小说 ${this._id} 的字数统计，找到 ${chapters.length} 章节`);
        
        let totalWords = 0;
        chapters.forEach(chapter => {
            totalWords += chapter.wordCount || 0;
        });
        
        console.log(`小说 ${this._id} 的总字数: ${totalWords}，总章节数: ${chapters.length}`);
        
        // 显式地设置这些值，确保它们会被保存
        this.wordCount = totalWords;
        this.totalChapters = chapters.length;
        
        // 标记这些字段为已修改
        this.markModified('wordCount');
        this.markModified('totalChapters');
        
        // 显式强制保存并等待结果
        console.log(`正在保存小说 ${this._id} 的更新`);
        try {
            const savedNovel = await this.save();
            console.log(`小说 ${this._id} 的更新已保存，新字数: ${savedNovel.wordCount}, 章节数: ${savedNovel.totalChapters}`);
            
            // 再次从数据库获取最新数据，确认更新成功
            const freshNovel = await mongoose.model('Novel').findById(this._id);
            console.log(`验证更新: 小说 ${this._id} 当前字数: ${freshNovel.wordCount}, 章节数: ${freshNovel.totalChapters}`);
            
            return savedNovel;
        } catch (saveError) {
            console.error(`保存小说 ${this._id} 更新失败:`, saveError);
            throw saveError; // 重新抛出保存错误
        }
    } catch (error) {
        console.error('更新小说字数统计失败:', error);
        // 抛出错误以便调用者可以处理
        throw error;
    }
};

// 方法：更新小说的总阅读量
novelSchema.methods.updateReadersCount = async function() {
    try {
        const Chapter = mongoose.model('Chapter');
        
        console.log(`更新小说 ${this._id} 的总阅读量开始`);
        
        // 获取所有章节的阅读量
        const chapters = await Chapter.find({ novel: this._id }).select('viewCount').lean();
        
        console.log(`更新小说 ${this._id} 的总阅读量，找到 ${chapters.length} 章节`);
        
        // 计算总阅读量
        let totalViews = 0;
        chapters.forEach(chapter => {
            totalViews += chapter.viewCount || 0;
        });
        
        console.log(`小说 ${this._id} 的总阅读量: ${totalViews}`);
        
        // 更新小说的readers字段
        this.readers = totalViews;
        
        // 标记字段为已修改
        this.markModified('readers');
        
        // 保存并返回结果
        console.log(`正在保存小说 ${this._id} 的阅读量更新`);
        try {
            const savedNovel = await this.save();
            console.log(`小说 ${this._id} 的阅读量已更新为: ${savedNovel.readers}`);
            return savedNovel;
        } catch (saveError) {
            console.error(`保存小说 ${this._id} 阅读量更新失败:`, saveError);
            throw saveError;
        }
    } catch (error) {
        console.error('更新小说阅读量统计失败:', error);
        throw error;
    }
};

const Novel = mongoose.model('Novel', novelSchema);

export { Novel }; 