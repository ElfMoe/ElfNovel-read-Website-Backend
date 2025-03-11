/**
 * 数据模型索引文件
 * 
 * 统一导出所有数据模型，便于在其他文件中导入
 */

import { User } from './user.js';
import { Novel } from './novel.js';
import { Chapter } from './chapter.js';
import { ReadingHistory } from './readingHistory.js';
import { Favorite } from './favorite.js';
import { ChapterViewRecord } from './chapterViewRecord.js';
import { Folder } from './folder.js';
import { FavoriteFolder } from './favoriteFolder.js';
import Comment from './comment.js';

export {
    User,
    Novel,
    Chapter,
    ReadingHistory,
    Favorite,
    ChapterViewRecord,
    Folder,
    FavoriteFolder,
    Comment
};

// 默认导出所有模型的对象
export default {
    User,
    Novel,
    Chapter,
    ReadingHistory,
    Favorite,
    ChapterViewRecord,
    Folder,
    FavoriteFolder,
    Comment
}; 