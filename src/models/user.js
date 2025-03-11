import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema({
    username:{
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: [2, '用户名至少需要2个字符'],
        maxlength: [20, '用户名不能超过20个字符'],
        validate: {
            validator: function(v) {
                // 检查是否只包含数字
                return !/^\d+$/.test(v);
            },
            message: '用户名不能只包含数字'
        }
    },

    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
    },

    // 新增：邮箱验证相关字段
    isEmailVerified: {
        type: Boolean,
        default: false        // 新用户默认邮箱未验证
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    password: {
        type: String,
        required: [true, '密码是必需的'],
        minlength: [6, '密码至少需要6个字符'],
        select: false
    },

    // 用户头像
    avatar: {
        type: String,
        default: '/images/default-avatar.jpg'
    },

    // 用户角色
    role: {
        type: String,
        enum: ['user', 'admin', 'author'],
        default: 'user'
    },

    // 用户笔名 - 作为作者发布小说时使用
    penName: {
        type: String,
        trim: true,
        maxlength: [50, '笔名不能超过50个字符']
    },

    // 作者信息 - 当用户成为作者时使用
    authorProfile: {
        bio: {
            type: String,
            trim: true,
            maxlength: [500, '作者简介不能超过500个字符']
        },
        genres: [{
            type: String,
            enum: ['武侠', '仙侠', '都市', '玄幻', '科幻', '历史', '军事', '游戏', '体育', '悬疑', '轻小说', '其他']
        }],
        isVerified: {
            type: Boolean,
            default: false // 是否为认证作者
        },
        worksCount: {
            type: Number,
            default: 0 // 作品数量
        },
        totalWordCount: {
            type: Number,
            default: 0 // 总字数
        },
        totalReaders: {
            type: Number,
            default: 0 // 总读者数
        },
        totalChapters: {
            type: Number,
            default: 0 // 总章节数
        }
    },

    // 用户个人资料
    profile: {
        nickname: {
            type: String,
            trim: true
        },
        bio: {
            type: String,
            trim: true,
            maxlength: [200, '个人简介不能超过200个字符']
        },
        gender: {
            type: String,
            enum: ['male', 'female', 'other', 'prefer-not-to-say'],
            default: 'prefer-not-to-say'
        },
        birthday: Date,
        location: {
            type: String,
            trim: true
        },
        website: {
            type: String,
            trim: true
        }
    },

    // 阅读偏好设置
    readingPreferences: {
        fontSize: {
            type: Number,
            default: 18
        },
        lineHeight: {
            type: Number,
            default: 1.8
        },
        theme: {
            type: String,
            enum: ['light', 'dark', 'sepia'],
            default: 'light'
        },
        fontFamily: {
            type: String,
            default: 'sans-serif'
        }
    },

    // 用户统计信息
    stats: {
        totalReadingTime: {
            type: Number,
            default: 0
        },
        booksRead: {
            type: Number,
            default: 0
        },
        chaptersRead: {
            type: Number,
            default: 0
        },
        favoriteGenres: [{
            type: String
        }]
    },

    // 创建时间
    createdAt: {
        type: Date,
        default: Date.now
    },

    // 最后登录时间
    lastLoginAt: {
        type: Date,
        default: Date.now
    }
});

// 在保存用户之前自动加密密码
userSchema.pre('save', async function(next) {
    // 如果密码没有被修改，跳过加密
    if (!this.isModified('password')) return next();
    
    try {
        // 生成加密盐
        const salt = await bcrypt.genSalt(10);
        // 加密密码
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 比较密码
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// 生成JWT Token
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign(
        { id: this._id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );
};

// 生成邮箱验证token
userSchema.methods.generateEmailVerificationToken = function() {
    // 生成随机token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // 保存到用户文档
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
    
    // 设置过期时间（24小时后）
    this.emailVerificationExpires = Date.now() + 24*60*60*1000;
    
    return verificationToken;
};

// 更新用户阅读统计数据的方法
userSchema.methods.updateReadingStats = async function() {
    try {
        const ReadingHistory = mongoose.model('ReadingHistory');
        const stats = await ReadingHistory.getUserReadingStats(this._id);
        
        this.stats.totalReadingTime = stats.totalReadingTime || 0;
        this.stats.booksRead = stats.totalNovels || 0;
        
        // 获取最常阅读的类型
        const Novel = mongoose.model('Novel');
        const favoriteGenres = await Novel.aggregate([
            { $match: { _id: { $in: await ReadingHistory.distinct('novel', { user: this._id }) } } },
            { $unwind: '$categories' },
            { $group: { _id: '$categories', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 3 }
        ]);
        
        this.stats.favoriteGenres = favoriteGenres.map(g => g._id);
        
        return this.save();
    } catch (error) {
        console.error('更新用户阅读统计失败:', error);
        throw error;
    }
};

// 更新作者统计信息的方法
userSchema.methods.updateAuthorStats = async function() {
    try {
        const Novel = mongoose.model('Novel');
        const Chapter = mongoose.model('Chapter');
        
        // 查询该用户创建的所有小说
        const novels = await Novel.find({ creator: this._id });
        console.log(`找到作者(${this._id})的小说数量: ${novels.length}`);
        
        // 计算总作品数
        this.authorProfile.worksCount = novels.length;
        
        // 计算总字数
        let totalWords = 0;
        novels.forEach(novel => {
            totalWords += novel.wordCount || 0;
        });
        this.authorProfile.totalWordCount = totalWords;
        console.log(`作者总字数: ${totalWords}`);
        
        // 计算总读者数（简化处理，实际应该统计不重复的读者）
        let totalReaders = 0;
        novels.forEach(novel => {
            totalReaders += novel.readers || 0;
        });
        this.authorProfile.totalReaders = totalReaders;
        console.log(`作者总读者数: ${totalReaders}`);
        
        // 计算总章节数
        const novelIds = novels.map(novel => novel._id);
        console.log(`小说ID列表: ${novelIds.join(', ')}`);
        
        const totalChapters = await Chapter.countDocuments({ novel: { $in: novelIds } });
        console.log(`作者总章节数: ${totalChapters}`);
        
        this.authorProfile.totalChapters = totalChapters;
        
        // 保存更新后的用户数据
        const result = await this.save();
        console.log(`用户数据保存结果: ${result ? '成功' : '失败'}`);
        console.log(`更新后的作者统计数据: ${JSON.stringify(this.authorProfile, null, 2)}`);
        
        return result;
    } catch (error) {
        console.error('更新作者统计失败:', error);
        throw error;
    }
};

// 更新用户的上次登录时间
userSchema.methods.updateLastLogin = function() {
    this.lastLoginAt = Date.now();
    return this.save();
};

// 创建索引
// 注：索引定义放在创建模型之前，以免重复创建索引
userSchema.index({ username: 1 }, { unique: true, background: true });
userSchema.index({ email: 1 }, { unique: true, background: true });

// 创建用户模型
const User = mongoose.model('User', userSchema);

export { User };