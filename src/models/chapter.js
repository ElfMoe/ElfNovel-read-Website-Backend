import mongoose from 'mongoose';

/**
 * 章节模型
 * 
 * 该模型存储小说章节的信息，包括标题、内容等
 * 与小说模型(Novel)形成一对多的关系
 */
const chapterSchema = new mongoose.Schema({
    // 关联的小说ID
    novel: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Novel',
        required: true
    },
    
    // 章节标题
    title: {
        type: String,
        required: [true, '章节标题是必需的'],
        trim: true,
        maxlength: [100, '章节标题不能超过100个字符']
    },
    
    // 章节内容
    content: {
        type: String,
        required: [true, '章节内容是必需的']
    },
    
    // 章节序号
    chapterNumber: {
        type: Number,
        required: true
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
    },
    
    // 章节字数
    wordCount: {
        type: Number,
        default: 0
    },
    
    // 阅读数
    viewCount: {
        type: Number,
        default: 0
    },
    
    // 是否为番外章节
    isExtra: {
        type: Boolean,
        default: false
    },
    
    // 章节是否收费 (后期可用于付费阅读功能)
    isPremium: {
        type: Boolean,
        default: false
    },
    
    // 章节价格 (后期可用于付费阅读功能)
    price: {
        type: Number,
        default: 0
    }
});

// 保存前计算章节字数
chapterSchema.pre('save', function(next) {
    // 如果内容被修改或是新章节，重新计算字数
    if (this.isNew || this.isModified('content')) {
        // 中文字数统计，去除空格和标点符号
        this.wordCount = this.content.replace(/\s+/g, '').length;
        this.updatedAt = Date.now();
    }
    next();
});

// 保存后更新小说模型的信息
chapterSchema.post('save', async function() {
    try {
        // 获取Novel模型
        const Novel = mongoose.model('Novel');
        
        // 确保novel ID是有效的
        if (!this.novel || !mongoose.Types.ObjectId.isValid(this.novel)) {
            console.error('保存章节后更新小说失败: 无效的小说ID', this.novel);
            return;
        }
        
        const novel = await Novel.findById(this.novel);
        
        if (novel) {
            // 更新小说的总章节数和总字数
            await novel.updateWordCount();
            
            // 如果是新增的章节且章节号大于当前章节数，更新最新章节
            if (this.chapterNumber >= novel.totalChapters) {
                novel.latestChapter = this._id;
                await novel.save();
            }
        } else {
            console.error('保存章节后更新小说失败: 未找到小说', this.novel);
        }
    } catch (error) {
        console.error('更新小说信息失败:', error);
        // 这里我们只记录错误但不抛出，以防阻止章节创建
    }
});

// 增加章节浏览量的方法
chapterSchema.methods.incrementViewCount = async function(options = {}) {
    try {
        console.log(`处理章节浏览量: 章节${this._id} (第${this.chapterNumber}章)`);
        
        // 使用ChapterViewRecord检查是否应该增加计数
        const { ChapterViewRecord } = mongoose.models;
        if (!ChapterViewRecord) {
            console.error('ChapterViewRecord模型未找到，无法增加计数');
            return this;
        }

        // 检查是否应该增加计数
        const shouldIncrement = await ChapterViewRecord.recordView(this._id, options);
        
        if (shouldIncrement) {
            console.log(`允许增加浏览量，当前值: ${this.viewCount || 0}`);
            // 确保即使viewCount为null也能正确增加
            this.viewCount = (this.viewCount || 0) + 1;
            
            // 更新数据库
            try {
                await this.save();
                console.log(`章节浏览量更新成功，新值: ${this.viewCount}`);
                
                // 更新小说的读者统计
                if (this.novel) {
                    const Novel = mongoose.model('Novel');
                    const novel = await Novel.findById(this.novel);
                    
                    if (novel) {
                        await novel.updateReadersCount();
                        console.log(`小说 ${this.novel} 的阅读量统计更新完成`);
                        
                        // 更新小说最后活动时间
                        await Novel.findByIdAndUpdate(
                            this.novel,
                            { lastActiveAt: new Date() },
                            { new: true }
                        ).exec();
                    }
                }
            } catch (error) {
                console.error(`更新章节浏览量失败: ${error.message}`);
            }
        } else {
            console.log(`不允许增加浏览量，当前值保持: ${this.viewCount || 0}`);
        }
        
        return this;
    } catch (error) {
        console.error(`增加浏览量失败: ${error.message}`);
        return this;
    }
};

// 添加删除前钩子，确保能够正确处理章节删除
chapterSchema.pre('findOneAndDelete', async function() {
    try {
        const filter = this.getFilter();
        const chapterId = filter._id;
        
        // 如果没有ID则退出
        if (!chapterId) {
            console.log('findOneAndDelete钩子：没有章节ID，跳过');
            return;
        }
        
        console.log(`findOneAndDelete钩子：准备删除章节 ${chapterId}`);
        
        // 使用exec()确保查询执行
        const chapter = await this.model.findOne(filter).populate('novel', '_id latestChapter creator').exec();
        
        // 如果找不到章节或小说信息则退出
        if (!chapter || !chapter.novel) {
            console.log('findOneAndDelete钩子：未找到章节或小说信息，跳过');
            return;
        }
        
        const novelId = chapter.novel._id;
        const Novel = mongoose.model('Novel');
        
        console.log(`findOneAndDelete钩子：找到章节 ${chapterId}，所属小说 ${novelId}`);
        
        // 保存章节信息以供后续使用
        const chapterInfo = {
            id: chapter._id,
            novelId: chapter.novel._id,
            wordCount: chapter.wordCount || 0,
            isLatestChapter: chapter.novel.latestChapter && 
                            chapter.novel.latestChapter.toString() === chapterId.toString()
        };
        
        console.log(`findOneAndDelete钩子：保存章节信息用于后续更新:`, chapterInfo);
        
        // 将章节信息存储为钩子查询的state，这样可以在post钩子中使用
        this._chapterInfo = chapterInfo;
    } catch (error) {
        console.error('章节删除前处理失败:', error);
        // 记录错误但不阻止删除
    }
});

// 添加删除后钩子，确保在删除后更新小说
chapterSchema.post('findOneAndDelete', async function(doc, next) {
    try {
        // 如果没有文档或预处理信息，则退出
        if (!doc) {
            console.log('post findOneAndDelete钩子：没有找到被删除的文档');
            return next();
        }
        
        // 获取预处理中存储的信息
        const chapterInfo = this._chapterInfo;
        if (!chapterInfo) {
            console.log('post findOneAndDelete钩子：没有找到章节预处理信息');
            return next();
        }
        
        console.log(`post findOneAndDelete钩子：处理章节 ${doc._id} 删除后的更新`);
        
        const Novel = mongoose.model('Novel');
        const novel = await Novel.findById(chapterInfo.novelId).exec();
        
        if (!novel) {
            console.log(`post findOneAndDelete钩子：未找到小说 ${chapterInfo.novelId}`);
            return next();
        }
        
        // 如果删除的是最新章节，更新最新章节引用
        if (chapterInfo.isLatestChapter) {
            console.log(`post findOneAndDelete钩子：更新小说 ${chapterInfo.novelId} 的最新章节引用`);
            
            const latestChapter = await this.model.findOne({
                novel: chapterInfo.novelId,
                _id: { $ne: chapterInfo.id }
            }).sort({ chapterNumber: -1 }).exec();
            
            novel.latestChapter = latestChapter ? latestChapter._id : null;
            console.log(`post findOneAndDelete钩子：最新章节更新为 ${novel.latestChapter}`);
        }
        
        // 立即保存更改以更新最新章节引用
        await novel.save();
        
        // 然后更新章节统计
        console.log(`post findOneAndDelete钩子：更新小说 ${chapterInfo.novelId} 的章节统计`);
        await novel.updateWordCount();
        
        console.log(`post findOneAndDelete钩子：小说 ${chapterInfo.novelId} 更新完成`);
    } catch (error) {
        console.error('post findOneAndDelete钩子处理失败:', error);
    }
    
    next();
});

// 添加普通删除钩子，处理直接删除的情况
chapterSchema.post('remove', async function() {
    try {
        console.log(`remove钩子：章节 ${this._id} 被删除`);
        
        if (!this.novel || !mongoose.Types.ObjectId.isValid(this.novel)) {
            console.error('删除章节后更新小说失败: 无效的小说ID', this.novel);
            return;
        }
        
        const Novel = mongoose.model('Novel');
        
        // 显式使用exec()确保查询执行
        const novel = await Novel.findById(this.novel).exec();
        
        if (!novel) {
            console.log(`remove钩子：未找到小说 ${this.novel}，无法更新`);
            return;
        }
        
        // 如果删除的是最新章节，更新最新章节引用
        let needsSave = false;
        if (novel.latestChapter && novel.latestChapter.toString() === this._id.toString()) {
            console.log(`remove钩子：正在删除的是最新章节，更新最新章节引用`);
            
            const latestChapter = await this.constructor.findOne({
                novel: this.novel,
                _id: { $ne: this._id }
            }).sort({ chapterNumber: -1 }).exec();
            
            novel.latestChapter = latestChapter ? latestChapter._id : null;
            needsSave = true;
            
            console.log(`remove钩子：最新章节引用已更新为 ${latestChapter ? latestChapter._id : 'null'}`);
        }
        
        // 如果需要更新最新章节引用，先保存这些更改
        if (needsSave) {
            console.log(`remove钩子：保存最新章节引用更新`);
            await novel.save();
        }
        
        // 更新小说的总章节数和总字数
        console.log(`remove钩子：更新小说 ${this.novel} 的字数统计`);
        try {
            await novel.updateWordCount();
            console.log(`remove钩子：小说 ${this.novel} 的字数统计更新完成`);
        } catch (updateError) {
            console.error(`remove钩子：更新小说 ${this.novel} 的字数统计失败:`, updateError);
            throw updateError; // 重新抛出错误以便记录
        }
    } catch (error) {
        console.error('章节删除后更新小说失败:', error);
    }
});

// 添加对deleteMany操作的支持
chapterSchema.post('deleteMany', async function() {
    try {
        const filter = this.getFilter();
        console.log('deleteMany钩子：批量删除章节，过滤条件：', filter);
        
        if (!filter.novel) {
            console.log('deleteMany钩子：没有指定小说ID，跳过更新');
            return;
        }
        
        const novelId = filter.novel;
        const Novel = mongoose.model('Novel');
        
        // 显式使用exec()确保查询执行
        const novel = await Novel.findById(novelId).exec();
        
        if (!novel) {
            console.log(`deleteMany钩子：未找到小说 ${novelId}，无法更新`);
            return;
        }
        
        // 查找是否还有章节
        const remainingChaptersCount = await this.model.countDocuments({ novel: novelId }).exec();
        console.log(`deleteMany钩子：小说 ${novelId} 剩余章节数：${remainingChaptersCount}`);
        
        // 如果没有剩余章节，清空最新章节引用
        if (remainingChaptersCount === 0 && novel.latestChapter) {
            console.log(`deleteMany钩子：小说 ${novelId} 没有剩余章节，清空最新章节引用`);
            novel.latestChapter = null;
            await novel.save();
        } 
        // 如果有章节，更新最新章节引用
        else if (remainingChaptersCount > 0) {
            // 查找最新章节
            const latestChapter = await this.model.findOne({ novel: novelId })
                .sort({ chapterNumber: -1 }).exec();
            
            if (latestChapter && 
                (!novel.latestChapter || novel.latestChapter.toString() !== latestChapter._id.toString())) {
                console.log(`deleteMany钩子：更新小说 ${novelId} 的最新章节引用为 ${latestChapter._id}`);
                novel.latestChapter = latestChapter._id;
                await novel.save();
            }
        }
        
        // 更新字数统计
        console.log(`deleteMany钩子：更新小说 ${novelId} 的字数统计`);
        try {
            await novel.updateWordCount();
            console.log(`deleteMany钩子：小说 ${novelId} 字数统计更新完成`);
        } catch (error) {
            console.error(`deleteMany钩子：更新小说 ${novelId} 字数统计失败:`, error);
            throw error;
        }
    } catch (error) {
        console.error('批量删除章节后更新小说失败:', error);
    }
});

const Chapter = mongoose.model('Chapter', chapterSchema);

export { Chapter }; 