import mongoose from 'mongoose';

/**
 * 章节阅读记录模型
 * 
 * 该模型用于记录章节的阅读记录，用于防止重复计数
 * 支持登录用户和匿名用户
 */
const chapterViewRecordSchema = new mongoose.Schema({
    // 章节ID
    chapter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Chapter',
        required: true
    },
    
    // 用户ID（已登录用户）
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    
    // 客户端标识（未登录用户）
    clientId: {
        type: String,
        default: null
    },
    
    // IP地址（作为未登录用户的辅助标识）
    ipAddress: {
        type: String,
        default: null
    },
    
    // 阅读时间
    viewedAt: {
        type: Date,
        default: Date.now,
        // 设置为24小时后过期，允许再次计数
        expires: 86400 // 24小时 = 86400秒
    }
});

// 修改索引定义，确保唯一索引正确生效
chapterViewRecordSchema.index(
    { chapter: 1, user: 1 },
    { 
        unique: true, 
        sparse: true, // 只索引非null的user值
        partialFilterExpression: { user: { $ne: null } } 
    }
);

chapterViewRecordSchema.index(
    { chapter: 1, clientId: 1, ipAddress: 1 },
    { 
        unique: true,
        sparse: true, // 只索引非null的值
        partialFilterExpression: { 
            user: null, 
            clientId: { $ne: null },
            ipAddress: { $ne: null }
        } 
    }
);

// 为viewedAt字段创建TTL索引，确保记录能正确过期
chapterViewRecordSchema.index(
    { viewedAt: 1 },
    { expireAfterSeconds: 86400 } // 24小时后过期
);

// 静态方法：记录阅读并检查是否应该增加计数
chapterViewRecordSchema.statics.recordView = async function(chapterId, options = {}) {
    const { userId, clientId, ipAddress } = options;
    
    console.log('记录章节阅读:', {
        chapterId,
        userId: userId || '未登录',
        clientId: clientId || '未设置',
        ipAddress: ipAddress || '未知'
    });
    
    // 如果没有有效的章节ID，不允许计数
    if (!chapterId || !mongoose.Types.ObjectId.isValid(chapterId)) {
        console.error('无效的章节ID，不允许计数');
        return false;
    }
    
    try {
        // 构建查询条件
        let query = { chapter: chapterId };
        
        if (userId) {
            // 已登录用户
            query.user = userId;
            console.log('使用用户ID查询:', userId);
        } else if (clientId && ipAddress) {
            // 未登录用户使用客户端ID和IP地址组合
            query.clientId = clientId;
            query.ipAddress = ipAddress;
            query.user = null;
            console.log('使用客户端ID和IP查询:', { clientId, ipAddress });
        } else if (ipAddress) {
            // 如果没有clientId但有IP地址，仅使用IP地址作为备用标识
            query.ipAddress = ipAddress;
            query.user = null;
            query.clientId = null;
            console.log('仅使用IP地址作为备用标识:', ipAddress);
        } else {
            // 如果没有足够的标识信息，不允许计数
            console.log('没有足够的标识信息，不允许计数');
            return false;
        }
        
        // 尝试查找现有记录
        console.log('查询现有记录，条件:', JSON.stringify(query));
        const existingRecord = await this.findOne(query);
        
        if (existingRecord) {
            // 记录找到，检查是否过期
            const now = new Date();
            const recordTime = new Date(existingRecord.viewedAt);
            const hoursDiff = (now - recordTime) / (1000 * 60 * 60);
            
            console.log(`找到现有记录，创建时间: ${recordTime}, 已过去 ${hoursDiff.toFixed(2)} 小时`);
            
            // 如果记录已超过24小时但未被MongoDB TTL机制删除，更新时间并允许计数
            if (hoursDiff >= 24) {
                console.log(`记录已过期 (${hoursDiff.toFixed(2)} 小时 > 24小时)，更新时间并允许计数`);
                existingRecord.viewedAt = now;
                await existingRecord.save();
                return true;
            }
            
            console.log(`记录未过期 (${hoursDiff.toFixed(2)} 小时 < 24小时)，不增加计数`);
            return false; // 未过期，不增加计数
        }
        
        // 未找到记录，创建新记录并允许计数
        console.log('未找到现有记录，创建新记录并允许计数');
        
        // 准备写入数据
        const recordData = {
            chapter: chapterId,
            viewedAt: new Date()
        };
        
        // 根据用户情况填充标识字段
        if (userId) {
            recordData.user = userId;
        } else {
            recordData.user = null;
            recordData.clientId = clientId || null;
            recordData.ipAddress = ipAddress || null;
        }
        
        try {
            const newRecord = await this.create(recordData);
            console.log(`成功创建阅读记录: ${newRecord._id}`);
            return true; // 新记录，应该增加计数
        } catch (createErr) {
            // 如果创建记录失败(可能是并发问题)，记录错误但不允许计数
            console.error('创建阅读记录失败:', createErr.message);
            return false;
        }
    } catch (error) {
        // 详细记录错误信息
        console.error('记录章节阅读失败:', error.message);
        // 出错时不允许计数，以避免重复计数
        return false;
    }
};

const ChapterViewRecord = mongoose.model('ChapterViewRecord', chapterViewRecordSchema);

export { ChapterViewRecord }; 