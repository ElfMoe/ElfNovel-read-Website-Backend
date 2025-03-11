import mongoose from 'mongoose';
import { Folder, Favorite, FavoriteFolder } from '../models/index.js';

/**
 * 文件夹控制器
 * 
 * 处理文件夹相关的请求，包括创建、获取、更新、删除文件夹，
 * 以及管理收藏与文件夹的关联关系
 */

// 获取用户的所有文件夹
export const getFolders = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 确保用户有默认文件夹
        await Folder.createDefaultFolder(userId);
        
        // 获取所有文件夹
        const folders = await Folder.find({ user: userId })
            .sort({ isDefault: -1, order: 1, createdAt: 1 });
        
        // 获取每个文件夹中的收藏数量
        const folderCounts = await Promise.all(
            folders.map(async (folder) => {
                const count = await FavoriteFolder.countDocuments({ folder: folder._id });
                return {
                    ...folder.toObject(),
                    count
                };
            })
        );
        
        return res.status(200).json({
            success: true,
            count: folders.length,
            data: folderCounts
        });
    } catch (error) {
        console.error('获取文件夹列表失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 创建新文件夹
export const createFolder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, icon = '📁' } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: '文件夹名称不能为空'
            });
        }
        
        // 检查同名文件夹是否已存在
        const existingFolder = await Folder.findOne({ 
            user: userId, 
            name: name.trim() 
        });
        
        if (existingFolder) {
            return res.status(400).json({
                success: false,
                message: '同名文件夹已存在'
            });
        }
        
        // 创建新文件夹
        const folder = new Folder({
            user: userId,
            name: name.trim(),
            icon
        });
        
        await folder.save();
        
        return res.status(201).json({
            success: true,
            message: '文件夹创建成功',
            data: folder
        });
    } catch (error) {
        console.error('创建文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新文件夹
export const updateFolder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { name, icon, order } = req.body;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的文件夹ID'
            });
        }
        
        // 查找文件夹
        const folder = await Folder.findOne({ _id: id, user: userId });
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: '文件夹不存在或无权限修改'
            });
        }
        
        // 不允许修改默认文件夹的名称
        if (folder.isDefault && name && name !== folder.name) {
            return res.status(400).json({
                success: false,
                message: '不能修改默认文件夹的名称'
            });
        }
        
        // 检查新名称是否与其他文件夹重复
        if (name && name !== folder.name) {
            const existingFolder = await Folder.findOne({ 
                user: userId, 
                name: name.trim(),
                _id: { $ne: id }
            });
            
            if (existingFolder) {
                return res.status(400).json({
                    success: false,
                    message: '同名文件夹已存在'
                });
            }
            
            folder.name = name.trim();
        }
        
        // 更新其他字段
        if (icon) folder.icon = icon;
        if (order !== undefined && !folder.isDefault) folder.order = order;
        
        await folder.save();
        
        return res.status(200).json({
            success: true,
            message: '文件夹更新成功',
            data: folder
        });
    } catch (error) {
        console.error('更新文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 删除文件夹
export const deleteFolder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的文件夹ID'
            });
        }
        
        // 查找文件夹
        const folder = await Folder.findOne({ _id: id, user: userId });
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: '文件夹不存在或无权限删除'
            });
        }
        
        // 不允许删除默认文件夹
        if (folder.isDefault) {
            return res.status(400).json({
                success: false,
                message: '不能删除默认文件夹'
            });
        }
        
        // 删除文件夹与收藏的关联
        await FavoriteFolder.deleteMany({ folder: id });
        
        // 删除文件夹
        await folder.deleteOne();
        
        return res.status(200).json({
            success: true,
            message: '文件夹删除成功'
        });
    } catch (error) {
        console.error('删除文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取文件夹中的收藏
export const getFolderFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { limit = 20, page = 1 } = req.query;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的文件夹ID'
            });
        }
        
        // 查找文件夹
        const folder = await Folder.findOne({ _id: id, user: userId });
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: '文件夹不存在或无权限访问'
            });
        }
        
        // 如果是默认文件夹，返回所有收藏
        if (folder.isDefault) {
            return await getAllFavorites(req, res);
        }
        
        // 获取文件夹中的收藏
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const favoriteRelations = await FavoriteFolder.find({ folder: id, user: userId })
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate({
                path: 'favorite',
                populate: {
                    path: 'novel',
                    select: 'title authorName cover shortDescription status totalChapters updatedAt'
                }
            });
        
        // 提取收藏数据
        const favorites = favoriteRelations.map(rel => rel.favorite);
        
        // 计算总数
        const total = await FavoriteFolder.countDocuments({ folder: id, user: userId });
        
        return res.status(200).json({
            success: true,
            count: favorites.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: favorites
        });
    } catch (error) {
        console.error('获取文件夹收藏失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 获取所有收藏（用于默认文件夹）
const getAllFavorites = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        // 获取所有收藏
        const favorites = await Favorite.find({ user: userId })
            .sort({ addedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('novel', 'title authorName cover shortDescription status totalChapters updatedAt');
        
        // 计算总数
        const total = await Favorite.countDocuments({ user: userId });
        
        return res.status(200).json({
            success: true,
            count: favorites.length,
            total,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            data: favorites
        });
    } catch (error) {
        console.error('获取所有收藏失败:', error);
        throw error;
    }
};

// 获取收藏所在的文件夹
export const getFavoriteFolders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的收藏ID'
            });
        }
        
        // 查找收藏
        const favorite = await Favorite.findOne({ _id: id, user: userId });
        
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: '收藏不存在或无权限访问'
            });
        }
        
        // 获取收藏所在的文件夹
        const relations = await FavoriteFolder.find({ favorite: id, user: userId })
            .populate('folder', 'name icon isDefault');
        
        const folders = relations.map(rel => rel.folder);
        
        // 确保默认文件夹也在列表中
        const defaultFolder = await Folder.findOne({ user: userId, isDefault: true });
        
        if (defaultFolder && !folders.some(f => f._id.toString() === defaultFolder._id.toString())) {
            folders.unshift(defaultFolder);
        }
        
        return res.status(200).json({
            success: true,
            count: folders.length,
            data: folders
        });
    } catch (error) {
        console.error('获取收藏文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 添加收藏到文件夹
export const addToFolder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteId, folderId } = req.body;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(favoriteId) || !mongoose.Types.ObjectId.isValid(folderId)) {
            return res.status(400).json({
                success: false,
                message: '无效的收藏ID或文件夹ID'
            });
        }
        
        // 查找收藏和文件夹
        const favorite = await Favorite.findOne({ _id: favoriteId, user: userId });
        const folder = await Folder.findOne({ _id: folderId, user: userId });
        
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: '收藏不存在或无权限访问'
            });
        }
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: '文件夹不存在或无权限访问'
            });
        }
        
        // 默认文件夹不需要手动添加，所有收藏都自动在默认文件夹中
        if (folder.isDefault) {
            return res.status(400).json({
                success: false,
                message: '不能手动添加到默认文件夹，所有收藏都自动在默认文件夹中'
            });
        }
        
        // 添加收藏到文件夹
        const relation = await FavoriteFolder.addToFolder(userId, favoriteId, folderId);
        
        return res.status(200).json({
            success: true,
            message: '添加成功',
            data: relation
        });
    } catch (error) {
        console.error('添加收藏到文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 从文件夹中移除收藏
export const removeFromFolder = async (req, res) => {
    try {
        const userId = req.user.id;
        const { favoriteId, folderId } = req.params;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(favoriteId) || !mongoose.Types.ObjectId.isValid(folderId)) {
            return res.status(400).json({
                success: false,
                message: '无效的收藏ID或文件夹ID'
            });
        }
        
        // 查找收藏和文件夹
        const favorite = await Favorite.findOne({ _id: favoriteId, user: userId });
        const folder = await Folder.findOne({ _id: folderId, user: userId });
        
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: '收藏不存在或无权限访问'
            });
        }
        
        if (!folder) {
            return res.status(404).json({
                success: false,
                message: '文件夹不存在或无权限访问'
            });
        }
        
        // 不能从默认文件夹中移除收藏
        if (folder.isDefault) {
            return res.status(400).json({
                success: false,
                message: '不能从默认文件夹中移除收藏'
            });
        }
        
        // 从文件夹中移除收藏
        const removed = await FavoriteFolder.removeFromFolder(userId, favoriteId, folderId);
        
        if (!removed) {
            return res.status(404).json({
                success: false,
                message: '收藏不在该文件夹中'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: '移除成功'
        });
    } catch (error) {
        console.error('从文件夹移除收藏失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
};

// 更新收藏的文件夹
export const updateFavoriteFolders = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { folderIds } = req.body;
        
        // 验证ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: '无效的收藏ID'
            });
        }
        
        // 检查folderIds是否为数组
        if (!Array.isArray(folderIds)) {
            return res.status(400).json({
                success: false,
                message: 'folderIds必须是数组'
            });
        }
        
        // 查找收藏
        const favorite = await Favorite.findOne({ _id: id, user: userId });
        
        if (!favorite) {
            return res.status(404).json({
                success: false,
                message: '收藏不存在或无权限访问'
            });
        }
        
        // 验证所有文件夹ID
        const validFolderIds = [];
        for (const folderId of folderIds) {
            if (!mongoose.Types.ObjectId.isValid(folderId)) {
                continue;
            }
            
            const folder = await Folder.findOne({ _id: folderId, user: userId });
            if (folder && !folder.isDefault) {
                validFolderIds.push(folderId);
            }
        }
        
        // 获取当前的文件夹关联
        const currentRelations = await FavoriteFolder.find({ favorite: id, user: userId });
        const currentFolderIds = currentRelations.map(rel => rel.folder.toString());
        
        // 计算需要添加和删除的关联
        const toAdd = validFolderIds.filter(fid => !currentFolderIds.includes(fid));
        const toRemove = currentFolderIds.filter(fid => !validFolderIds.includes(fid));
        
        // 添加新关联
        for (const folderId of toAdd) {
            await FavoriteFolder.addToFolder(userId, id, folderId);
        }
        
        // 删除旧关联
        for (const folderId of toRemove) {
            await FavoriteFolder.removeFromFolder(userId, id, folderId);
        }
        
        // 获取更新后的文件夹列表
        const updatedRelations = await FavoriteFolder.find({ favorite: id, user: userId })
            .populate('folder', 'name icon isDefault');
        
        const folders = updatedRelations.map(rel => rel.folder);
        
        return res.status(200).json({
            success: true,
            message: '文件夹更新成功',
            data: folders
        });
    } catch (error) {
        console.error('更新收藏文件夹失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试'
        });
    }
}; 