import mongoose from 'mongoose';

/**
 * 留言/评论模型
 * 
 * 该模型用于存储用户对小说整体或特定章节的留言
 * 可以关联到小说或特定章节
 */
const commentSchema = new mongoose.Schema({
    // 留言内容
    content: {
        type: String,
        required: [true, '留言内容不能为空'],
        trim: true,
        maxlength: [1000, '留言内容不能超过1000个字符']
    },
    
    // 留言作者
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // 关联的小说
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    
    // 关联的章节（可选）
    chapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        default: null
    },
    
    // 章节编号（冗余字段，便于显示和查询）
    chapterNumber: {
        type: Number,
        default: null
    },
    
    // 时间信息
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    // 更新时间
    updatedAt: {
        type: Date,
        default: Date.now
    },
    
    // 是否被删除（软删除）
    isDeleted: {
        type: Boolean,
        default: false
    },
    
    // 点赞数
    likes: {
        type: Number,
        default: 0
    },
    
    // 点赞用户
    likedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // 回复的留言（可选，用于实现嵌套回复）
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null
    },
    
    // 回复的用户（可选，用于显示"回复给xxx"）
    replyToUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
});

// 创建复合索引，用于快速查询特定小说或章节的留言
commentSchema.index({ novel: 1, createdAt: -1 });
commentSchema.index({ chapter: 1, createdAt: -1 });
commentSchema.index({ user: 1, createdAt: -1 }); // 用于查询用户的留言历史

// 更新留言时自动更新updatedAt字段
commentSchema.pre('save', function(next) {
    if (this.isModified('content') || this.isModified('isDeleted')) {
        this.updatedAt = Date.now();
    }
    next();
});

// 方法：点赞留言
commentSchema.methods.addLike = async function(userId) {
    // 检查用户是否已经点赞过
    if (!this.likedBy.includes(userId)) {
        this.likes += 1;
        this.likedBy.push(userId);
        await this.save();
    }
    return this;
};

// 方法：取消点赞
commentSchema.methods.removeLike = async function(userId) {
    // 检查用户是否已经点赞过
    if (this.likedBy.includes(userId)) {
        this.likes = Math.max(0, this.likes - 1);
        this.likedBy = this.likedBy.filter(id => id.toString() !== userId.toString());
        await this.save();
    }
    return this;
};

// 静态方法：获取小说的所有留言（包括章节留言）
commentSchema.statics.getNovelComments = async function(novelId, options = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
    
    try {
        // 首先找出主留言（非回复）
        const mainComments = await this.find({
            novel: novelId,
            replyTo: null, // 只获取主留言，不是回复
            isDeleted: false
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar penName')
        .populate('chapter', 'title chapterNumber')
        .lean();
        
        // 找出每个主留言的回复
        const commentIds = mainComments.map(comment => comment._id);
        const replies = await this.find({
            replyTo: { $in: commentIds },
            isDeleted: false
        })
        .populate('user', 'username avatar penName')
        .populate('replyTo', 'content')
        .populate('replyToUser', 'username avatar penName')
        .lean();
        
        // 将回复添加到对应的主留言中
        const commentsWithReplies = mainComments.map(comment => {
            const commentReplies = replies.filter(reply => 
                reply.replyTo && reply.replyTo._id.toString() === comment._id.toString()
            );
            return {
                ...comment,
                replies: commentReplies
            };
        });
        
        return commentsWithReplies;
    } catch (error) {
        console.error('获取小说留言失败:', error);
        throw error;
    }
};

// 静态方法：获取特定章节的留言
commentSchema.statics.getChapterComments = async function(chapterId, options = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
    
    try {
        // 首先找出主留言（非回复）
        const mainComments = await this.find({
            chapter: chapterId,
            replyTo: null, // 只获取主留言，不是回复
            isDeleted: false
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('user', 'username avatar penName')
        .lean();
        
        // 找出每个主留言的回复
        const commentIds = mainComments.map(comment => comment._id);
        const replies = await this.find({
            replyTo: { $in: commentIds },
            isDeleted: false
        })
        .populate('user', 'username avatar penName')
        .populate('replyTo', 'content')
        .populate('replyToUser', 'username avatar penName')
        .sort({ createdAt: 1 }) // 回复按时间正序排列
        .lean();
        
        // 将回复添加到对应的主留言中
        const commentsWithReplies = mainComments.map(comment => {
            const commentReplies = replies.filter(reply => 
                reply.replyTo && reply.replyTo._id.toString() === comment._id.toString()
            );
            return {
                ...comment,
                replies: commentReplies
            };
        });
        
        return commentsWithReplies;
    } catch (error) {
        console.error('获取章节留言失败:', error);
        throw error;
    }
};

// 静态方法：获取用户的留言历史
commentSchema.statics.getUserComments = async function(userId, options = {}) {
    const { limit = 20, skip = 0, sort = { createdAt: -1 } } = options;
    
    try {
        const comments = await this.find({
            user: userId,
            isDeleted: false
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('novel', 'title cover')
        .populate('chapter', 'title chapterNumber')
        .lean();
        
        return comments;
    } catch (error) {
        console.error('获取用户留言历史失败:', error);
        throw error;
    }
};

const Comment = mongoose.model('Comment', commentSchema);

export default Comment; 