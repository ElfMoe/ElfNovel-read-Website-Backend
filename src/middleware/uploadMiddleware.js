import multer from 'multer';
import path from 'path';
import fs from 'fs';

// 确保上传目录存在
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 设置存储引擎
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // 生成唯一文件名，避免覆盖
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'cover-' + uniqueSuffix + ext);
    }
});

// 文件过滤器，只允许图片
const fileFilter = (req, file, cb) => {
    // 检查是否为图片
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('只允许上传图片文件！'), false);
    }
};

// 创建multer实例
const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 限制10MB
    }
});

// 导出单个文件上传中间件，用于处理封面上传
export const uploadCover = upload.single('cover');

// 导出头像上传中间件
export const uploadAvatar = upload.single('avatar');

// 错误处理中间件
export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer错误
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: '文件大小不能超过10MB'
            });
        }
        return res.status(400).json({
            success: false,
            message: `上传错误: ${err.message}`
        });
    } else if (err) {
        // 其他错误
        return res.status(400).json({
            success: false,
            message: err.message || '文件上传失败'
        });
    }
    next();
}; 