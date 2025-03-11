import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

/**
 * 认证中间件
 * 提供强制认证和可选认证两种方式
 */

// 强制要求用户认证的中间件
export const protect = async (req, res, next) => {
    try {
        let token;

        // 从请求头获取token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // 检查token是否存在
        if (!token) {
            return res.status(401).json({
                success: false,
                message: '请先登录'
            });
        }

        try {
            // 验证token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 检查用户是否存在
            const user = await User.findById(decoded.id);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: '用户不存在'
                });
            }

            // 将用户信息添加到请求对象
            req.user = user;
            next();
        } catch (error) {
            // token过期或无效
            return res.status(401).json({
                success: false,
                message: '登录已过期，请重新登录',
                isTokenExpired: true
            });
        }
    } catch (error) {
        console.error('认证中间件错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
};

// 可选认证中间件 - 有token则验证，无token则继续
export const optionalProtect = async (req, res, next) => {
    try {
        let token;

        // 从请求头获取token
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // 如果没有token，直接继续
        if (!token) {
            return next();
        }

        try {
            // 验证token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 检查用户是否存在
            const user = await User.findById(decoded.id);
            if (user) {
                // 将用户信息添加到请求对象
                req.user = user;
            }
            next();
        } catch (error) {
            // token无效但不阻止请求继续
            next();
        }
    } catch (error) {
        console.error('可选认证中间件错误:', error);
        // 任何错误都不阻止请求继续
        next();
    }
}; 