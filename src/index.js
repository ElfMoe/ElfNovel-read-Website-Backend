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
    'http://127.0.0.1:3001',
    'https://elfnovel-read.vercel.app'  // Vercel域名
];

app.use(cors({
    origin: function(origin, callback) {
        console.log('Request source:', origin); // 添加调试日志
        // 允许没有origin的请求（如移动应用或curl等工具）
        if (!origin) return callback(null, true);
        
        // 开发环境允许所有源
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        // 检查origin是否在允许列表中
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('CORS Error: Origin not allowed', origin); // 添加调试日志
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// 设置响应头，确保凭据可以正确传递
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
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
        console.log('Registration Request Body:', req.body);
        console.log('Request content type:', req.headers['content-type']);
        
        // 检查是否缺少凭据
        if (!req.body.username || !req.body.email || !req.body.password) {
            console.error('The registration request is missing a required field:', req.body);
        }
    }
    next();
});

// 添加请求记录中间件
app.use((req, res, next) => {
    // 记录所有请求
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log('Request Header:', JSON.stringify(req.headers));
    
    // 记录请求体 (除了敏感信息)
    const sanitizedBody = { ...req.body };
    if (sanitizedBody.password) sanitizedBody.password = '[REDACTED]';
    console.log('Request Body:', JSON.stringify(sanitizedBody));
    
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
        console.log('Database connection successful');
        // 确保初始化数据库集合和索引
        initializeDatabase();
    })
    .catch((err) => console.error('Database connection failed:', err));

// 初始化数据库集合和索引
const initializeDatabase = async () => {
    try {
        const db = mongoose.connection;
        
        // 确保users集合存在
        const collections = await db.db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        console.log('Existing collection:', collectionNames);
        
        // 创建或确保索引存在
        if (db.db.collection('users')) {
            // 确保users集合有正确的索引
            await db.db.collection('users').createIndex({ username: 1 }, { unique: true, background: true });
            await db.db.collection('users').createIndex({ email: 1 }, { unique: true, background: true });
            console.log('Ensure that the users collection index exists');
        }
        
        console.log('Database initialization completed');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
};

// 测试路由
app.get('/', (req, res) => {
    res.json({ message: 'The server is running normally' });
});

// 直接在index.js中定义的评论测试路由
app.get('/api/comments-test', (req, res) => {
    res.json({ success: true, message: 'Comments Test Routing is working properly' });
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
    console.error('The global error handler catches the error:');
    console.error(err);
    
    // 返回适当的错误响应
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// 处理未找到的路由
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'The requested resource was not found'
    });
});

// 启动服务器
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`The server runs on port ${PORT}`);
}); 
