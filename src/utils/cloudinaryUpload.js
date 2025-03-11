import cloudinary from '../config/cloudinaryConfig.js';
import fs from 'fs';

/**
 * 上传文件到Cloudinary
 * @param {string} filePath - 本地文件路径
 * @param {string} folder - Cloudinary中的文件夹名称
 * @returns {Promise<Object>} - 上传结果
 */
export const uploadToCloudinary = async (filePath, folder = 'novel-covers') => {
    try {
        // 上传文件到Cloudinary
        const result = await cloudinary.uploader.upload(filePath, {
            folder: folder,
            resource_type: 'auto' // 自动检测文件类型
        });
        
        // 删除本地临时文件
        fs.unlinkSync(filePath);
        
        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id
        };
    } catch (error) {
        console.error('上传到Cloudinary失败:', error);
        
        // 尝试删除本地临时文件
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (e) {
            console.error('删除临时文件失败:', e);
        }
        
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * 从Cloudinary删除文件
 * @param {string} publicId - Cloudinary中的文件公共ID
 * @returns {Promise<Object>} - 删除结果
 */
export const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return {
            success: true,
            result
        };
    } catch (error) {
        console.error('从Cloudinary删除失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}; 