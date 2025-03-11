import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import authorRoutes from './routes/authorRoutes.js';
import novelRoutes from './routes/novelRoutes.js';
import folderRoutes from './routes/folderRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import testRoutes from './routes/test.js';
import { setupDirectories } from './utils/setupDirectories.js';

// 使用CommonJS方式导入中间件
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { handleCoverTemplateRequest } = require('./middleware/coverTemplateMiddleware.cjs');
const cookieParser = require('cookie-parser');

const app = express();

// 配置环境变量
dotenv.config();

// 中间件
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001'
];

app.use(cors({
    origin: function(origin, callback) {
        // 允许没有origin的请求（如移动应用或curl等工具）
        if (!origin) return callback(null, true);
        
        // 在开发环境中，可以允许所有源
        // 在生产环境中应该移除这一行
        return callback(null, origin);
    },
    credentials: true, // 允许跨域请求带上凭据
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 设置响应头，确保凭据可以正确传递
app.use((req, res, next) => {
    // 确保Access-Control-Allow-Credentials存在于所有响应中
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

// 日志中间件
app.use(morgan('dev'));

// Cookie解析中间件
app.use(cookieParser());

// 静态文件服务
app.use('/uploads', express.static('public/uploads'));
// 模板封面中间件 - 处理动态封面请求
app.use('/templates', handleCoverTemplateRequest);
app.use('/templates', express.static('public/templates'));
app.use('/images', express.static('public/images'));

// 解析JSON请求体
app.use(express.json({ limit: '30mb' }));

// 解析URL编码的表单数据
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// 添加调试中间件来记录请求体
app.use((req, res, next) => {
    if (req.path.includes('/auth/register')) {
        console.log('注册请求体:', req.body);
        console.log('请求内容类型:', req.headers['content-type']);
        
        // 检查是否缺少凭据
        if (!req.body.username || !req.body.email || !req.body.password) {
            console.error('注册请求缺少必要字段:', req.body);
        }
    }
    next();
});

// 添加请求记录中间件
app.use((req, res, next) => {
    // 记录所有请求
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('请求头:', JSON.stringify(req.headers));
    
    // 记录请求体 (除了敏感信息)
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    console.log('请求体:', JSON.stringify(sanitizedBody));
    
    // 保存原始结束函数
    const originalEnd = res.end;
    
    // 重写结束函数，添加响应日志
    res.end = function(chunk, encoding) {
        console.log(`${new Date().toISOString()} - 响应: ${res.statusCode}`);
        return originalEnd.call(this, chunk, encoding);
    };
    
    next();
});

// 初始化目录
setupDirectories();

// 连接数据库
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('数据库连接成功');
        // 确保初始化数据库集合和索引
        initializeDatabase();
    })
    .catch((err) => console.error('数据库连接失败:', err));

// 初始化数据库集合和索引
const initializeDatabase = async () => {
    try {
        const db = mongoose.connection;
        
        // 确保users集合存在
        const collections = await db.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log('已存在的集合:', collectionNames);
        
        // 创建或确保索引存在
        if (db.db.collection('users')) {
            // 确保users集合有正确的索引
            await db.db.collection('users').createIndex({ username: 1 }, { unique: true, background: true });
            await db.db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
            console.log('已确保users集合索引存在');
        }
        
        console.log('数据库初始化完成');
    } catch (error) {
        console.error('初始化数据库时出错:', error);
    }
};

// 测试路由
app.get('/', (req, res) => {
    res.json({ message: '服务器运行正常' });
});

// 直接在index.js中定义的评论测试路由
app.get('/api/comments-test', (req, res) => {
    res.json({ success: true, message: '评论测试路由正常工作' });
});

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/author', authorRoutes);
app.use('/api/novels', novelRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/test', testRoutes);

// 添加明确的错误处理
app.use((err, req, res, next) => {
    console.error('全局错误处理器捕获到错误:');
    console.error(err);
    
    // 返回适当的错误响应
    res.status(err.status || 500).json({
        success: false,
        message: err.message || '服务器内部错误',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 处理未找到的路由
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: '未找到请求的资源'
    });
});

// 启动服务器
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
}); 