# Novel Reading Platform - Backend

## 🔗 Related Repositories
- **Frontend Repository**: [novel-reading-frontend](https://github.com/CJ020328/novel-reading-frontend)

## 🌍 Live Demo
- **Frontend (User Interface)**: [https://novel-reading-frontend.vercel.app/]
- **Backend (API Server)**: [https://novel-reading-website-backend.onrender.com/]


## Overview
This is the backend service for a novel reading platform, a personal side project that demonstrates modern Node.js development practices and architectural patterns. Built with Express.js and MongoDB, it implements a robust RESTful API that handles user authentication, content management, and real-time interactions.

## Technical Highlights
- **Clean Architecture**: Implements a layered architecture separating concerns between controllers, services, and data access
- **Advanced Authentication**: JWT-based authentication with refresh token rotation and secure session management
- **RESTful API Design**: Following REST best practices with proper resource naming and HTTP method usage
- **Real-time Features**: WebSocket integration for live notifications and updates
- **Caching Strategy**: Implements intelligent caching using Redis for improved performance
- **Security Measures**: Comprehensive security implementation including XSS protection, rate limiting, and input validation
- **Scalable Design**: Modular structure ready for horizontal scaling

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Caching**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **File Storage**: Cloudinary
- **Email Service**: Nodemailer with Gmail SMTP
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest and Supertest
- **Logging**: Winston
- **Process Management**: PM2

## API Features
1. **Authentication System**
   - JWT-based authentication
   - Refresh token mechanism
   - Email verification
   - OAuth integration ready

2. **Novel Management**
   - CRUD operations for novels
   - Chapter management
   - Content versioning
   - Draft system

3. **User System**
   - Role-based access control
   - Profile management
   - Reading history tracking
   - Favorites management
   - Author dashboard metrics

4. **Search & Discovery**
   - Full-text search
   - Advanced filtering
   - Tag-based search
   - Recommendation engine
   - Trending calculation

5. **Community Features**
   - Comment system
   - User interactions

## Project Structure
```
server/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── validation/      # Input validation schemas
├── tests/               # Test files
├── docs/               # API documentation
└── scripts/            # Utility scripts
```

## API Documentation
All API endpoints follow RESTful conventions:

### Authentication Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh-token
- GET /api/auth/verify-email/:token
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### Novel Endpoints
- GET /api/novels
- POST /api/novels
- GET /api/novels/:id
- PUT /api/novels/:id
- DELETE /api/novels/:id
- GET /api/novels/:id/chapters
- POST /api/novels/:id/chapters

### User Endpoints
- GET /api/users/profile
- PUT /api/users/profile
- GET /api/users/favorites
- POST /api/users/favorites/:novelId
- GET /api/users/history

## Installation & Setup

1. Clone the repository
```bash
git clone https://github.com/CJ020328/Novel-Reading-Website-Backend.git
cd Novel-Reading-Website-Backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start development server
```bash
npm run dev
```

5. Run tests
```bash
npm test
```

## Environment Variables
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/novel-reading
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Performance Optimizations
- Implemented database indexing for faster queries
- Cache frequently accessed data with Redis
- Implemented pagination for large data sets
- Used compression middleware for response size reduction
- Implemented rate limiting for API protection

## Security Measures
- JWT token rotation
- Rate limiting on sensitive endpoints
- Input validation and sanitization
- XSS protection
- CORS configuration
- Helmet security headers
- Password hashing with bcrypt

## Error Handling
- Centralized error handling middleware
- Structured error responses
- Validation error handling
- Async error catching
- Detailed error logging

---

# 小说阅读平台 - 后端

## 🔗 相关仓库
- **前端仓库**: [novel-reading-frontend](https://github.com/CJ020328/novel-reading-frontend)

## 🌍 在线访问
- **前端（用户界面）**: [https://novel-reading-frontend.vercel.app/]
- **后端（API 服务器）**: [https://novel-reading-website-backend.onrender.com/]

## 概述
这是小说阅读平台的后端服务，作为个人项目展示了现代Node.js开发实践和架构模式。使用Express.js和MongoDB构建，实现了一个强大的RESTful API，处理用户认证、内容管理和实时交互。

## 技术亮点
- **清晰架构**：实现分层架构，分离控制器、服务和数据访问关注点
- **高级认证**：基于JWT的认证，具有刷新令牌轮换和安全会话管理
- **RESTful API设计**：遵循REST最佳实践，合理的资源命名和HTTP方法使用
- **实时功能**：集成WebSocket实现实时通知和更新
- **缓存策略**：使用Redis实现智能缓存以提升性能
- **安全措施**：全面的安全实现，包括XSS防护、速率限制和输入验证
- **可扩展设计**：模块化结构，支持水平扩展

## 技术栈
- **运行时**：Node.js
- **框架**：Express.js
- **数据库**：MongoDB配合Mongoose ODM
- **缓存**：Redis
- **认证**：JWT（JSON Web Tokens）
- **文件存储**：Cloudinary
- **邮件服务**：Nodemailer配合Gmail SMTP
- **API文档**：Swagger/OpenAPI
- **测试**：Jest和Supertest
- **日志**：Winston
- **进程管理**：PM2

## API功能
1. **认证系统**
   - 基于JWT的认证
   - 刷新令牌机制
   - 邮箱验证
   - OAuth集成就绪

2. **小说管理**
   - 小说的CRUD操作
   - 章节管理
   - 内容版本控制
   - 草稿系统

3. **用户系统**
   - 基于角色的访问控制
   - 个人资料管理
   - 阅读历史跟踪
   - 收藏管理
   - 作者仪表盘指标

4. **搜索与发现**
   - 全文搜索
   - 高级筛选
   - 标签搜索
   - 推荐引擎
   - 热度计算

5. **社区功能**
   - 评论系统
   - 用户互动

## 项目结构
```
server/
├── src/
│   ├── config/           # 配置文件
│   ├── controllers/      # 请求处理器
│   ├── middleware/       # 自定义中间件
│   ├── models/          # 数据库模型
│   ├── routes/          # API路由
│   ├── services/        # 业务逻辑
│   ├── utils/           # 工具函数
│   └── validation/      # 输入验证架构
├── tests/               # 测试文件
├── docs/               # API文档
└── scripts/            # 实用脚本
```

## API文档
所有API端点遵循RESTful约定：

### 认证端点
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh-token
- GET /api/auth/verify-email/:token
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

### 小说端点
- GET /api/novels
- POST /api/novels
- GET /api/novels/:id
- PUT /api/novels/:id
- DELETE /api/novels/:id
- GET /api/novels/:id/chapters
- POST /api/novels/:id/chapters

### 用户端点
- GET /api/users/profile
- PUT /api/users/profile
- GET /api/users/favorites
- POST /api/users/favorites/:novelId
- GET /api/users/history

## 安装与设置

1. 克隆仓库
```bash
git clone https://github.com/CJ020328/Novel-Reading-Website-Backend.git
cd Novel-Reading-Website-Backend
```

2. 安装依赖
```bash
npm install
```

3. 设置环境变量
```bash
cp .env.example .env
# 编辑.env配置文件
```

4. 启动开发服务器
```bash
npm run dev
```

5. 运行测试
```bash
npm test
```

## 环境变量
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/novel-reading
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## 性能优化
- 实现数据库索引以加快查询
- 使用Redis缓存频繁访问的数据
- 为大数据集实现分页
- 使用压缩中间件减少响应大小
- 实现API保护的速率限制

## 安全措施
- JWT令牌轮换
- 敏感端点的速率限制
- 输入验证和清理
- XSS防护
- CORS配置
- Helmet安全头
- 使用bcrypt的密码哈希

## 错误处理
- 集中式错误处理中间件
- 结构化错误响应
- 验证错误处理
- 异步错误捕获
- 详细错误日志 