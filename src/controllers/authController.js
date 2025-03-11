import { User, Folder } from '../models/index.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import dotenv from 'dotenv';

// 重新加载环境变量
dotenv.config();

// 打印重要的环境变量(不显示敏感值)
console.log('======= 环境变量检查 =======');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('JWT_SECRET 设置:', !!process.env.JWT_SECRET);
console.log('JWT_EXPIRE 设置:', process.env.JWT_EXPIRE);
console.log('MONGODB_URI 设置:', !!process.env.MONGODB_URI);
console.log('EMAIL_USERNAME 设置:', !!process.env.EMAIL_USERNAME);
console.log('EMAIL_PASSWORD 设置:', !!process.env.EMAIL_PASSWORD);
console.log('============================');

// 如果缺少关键环境变量，输出警告
if (!process.env.JWT_SECRET || !process.env.MONGODB_URI) {
  console.error('警告: 缺少关键环境变量，应用可能无法正常工作!');
}

// 创建邮件发送器
let transporter;
try {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        },
        debug: true, // 启用调试输出
        logger: true // 启用日志记录
    });
    
    // 打印环境变量（不显示完整密码）
    console.log('邮件配置:', {
        user: process.env.EMAIL_USERNAME,
        passProvided: !!process.env.EMAIL_PASSWORD
    });
} catch (error) {
    console.error('创建邮件发送器失败:', error);
    // 创建一个假的发送器，避免程序崩溃
    transporter = {
        sendMail: async () => {
            console.log('使用假邮件发送器，邮件未真正发送');
            return { fake: true };
        }
    };
}

// 生成访问Token和刷新Token
const generateTokens = (userId) => {
    // 访问Token（短期）
    const accessToken = jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE }
    );

    // 刷新Token（长期）
    const refreshToken = jwt.sign(
        { id: userId },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRE }
    );

    return { accessToken, refreshToken };
};

// 验证刷新Token
const verifyRefreshToken = (token) => {
    try {
        return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        return null;
    }
};

// 发送验证邮件（添加错误处理）
const sendVerificationEmail = async (email, verificationToken, username) => {
    try {
        // 检查环境变量
        if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
            console.warn('邮件配置不完整，无法发送验证邮件');
            return;
        }
    
        // 修改验证链接为前端验证页面
        const frontendUrl = process.env.FRONTEND_URL || 'https://novel-reading-frontend.vercel.app/';
        const verificationUrl = `${frontendUrl}/verify?token=${verificationToken}`;
        
        const mailOptions = {
            from: process.env.EMAIL_USERNAME,
            to: email,
            subject: '请验证您的邮箱',
            html: `
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
                    <h1 style="color: #333; text-align: center;">您好 ${username}！</h1>
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p style="color: #666; font-size: 16px; line-height: 1.5;">感谢您注册我们的小说阅读网站。请点击下面的按钮验证您的邮箱：</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" 
                               style="background-color: #4f9eff; 
                                      color: white; 
                                      padding: 12px 30px; 
                                      text-decoration: none; 
                                      border-radius: 5px;
                                      font-size: 16px;">
                                验证邮箱
                            </a>
                        </div>
                        <p style="color: #666; font-size: 14px;">此链接24小时内有效。</p>
                        <p style="color: #999; font-size: 12px;">如果您没有注册账号，请忽略此邮件。</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
                        <p>这是一封自动发送的邮件，请勿直接回复。</p>
                    </div>
                </div>
            `
        };
    
        console.log(`准备发送验证邮件到 ${email}`);
        const result = await transporter.sendMail(mailOptions);
        console.log('邮件发送结果:', result);
        return result;
    } catch (error) {
        console.error('发送验证邮件过程中出错:', error);
        throw error;
    }
};

// 用户注册
export const register = async (req, res) => {
    try {
        console.log('注册请求体:', req.body);
        console.log('请求内容类型:', req.headers['content-type']);
        
        const { username, email, password, confirmPassword } = req.body;
        
        // 记录详细信息以便调试
        console.log('注册参数详情:', {
            username: username ? '已提供' : '未提供',
            email: email ? '已提供' : '未提供',
            password: password ? '已提供' : '未提供',
            confirmPassword: confirmPassword ? '已提供' : '未提供',
        });
        
        // 验证所有字段都存在
        if (!username || !email || !password) {
            console.log('缺少必要字段:', {
                username: !username,
                email: !email,
                password: !password
            });
            return res.status(400).json({
                success: false,
                message: '请提供所有必要信息'
            });
        }
        
        // 验证密码匹配（如果提供了confirmPassword字段）
        if (confirmPassword && password !== confirmPassword) {
            console.log('密码不匹配:', {
                passwordLength: password.length,
                confirmPasswordLength: confirmPassword.length
            });
            return res.status(400).json({
                success: false,
                message: '两次输入的密码不匹配'
            });
        }
        
        // 验证密码长度
        if (password.length < 6) {
            console.log('密码长度不足:', password.length);
            return res.status(400).json({
                success: false,
                message: '密码长度至少为6个字符'
            });
        }
        
        try {
            // 先查询用户名和邮箱是否已存在
            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                console.log('用户名已存在:', username);
                return res.status(400).json({
                    success: false,
                    message: '用户名已被使用'
                });
            }
            
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                console.log('邮箱已存在:', email);
                return res.status(400).json({
                    success: false,
                    message: '邮箱已被注册'
                });
            }
            
            // 创建用户实例
            const user = new User({
                username,
                email,
                password
            });
            
            // 保存用户基本信息
            try {
                await user.save();
                console.log('用户创建成功:', user._id);
                
                // 生成JWT令牌
                const token = user.getSignedJwtToken();
                console.log('JWT令牌生成成功');
                
                // 首先发送成功响应，不设置cookie（避免expires错误）
                console.log('注册成功，返回201状态码');
                res.status(201).json({
                    success: true,
                    message: '注册成功',
                    token
                });
                
                // 异步处理后续操作
                setTimeout(async () => {
                    try {
                        // 生成邮箱验证令牌
                        const verificationToken = user.generateEmailVerificationToken();
                        await user.save(); // 保存验证令牌
                        console.log('邮箱验证令牌生成成功');
                        
                        // 发送验证邮件
                        try {
                            await sendVerificationEmail(email, verificationToken, username);
                            console.log('验证邮件已成功发送');
                        } catch (emailError) {
                            console.error('发送验证邮件失败，但用户已注册并返回成功:', emailError);
                        }
                        
                        // 创建默认文件夹
                        try {
                            if (Folder && typeof Folder.createDefaultFolder === 'function') {
                                const folder = await Folder.createDefaultFolder(user._id);
                                console.log('默认文件夹创建:', folder ? '成功' : '失败');
                            } else {
                                console.log('Folder模型或createDefaultFolder方法不可用');
                            }
                        } catch (folderError) {
                            console.error('创建默认文件夹失败，但用户已注册并返回成功:', folderError);
                        }
                    } catch (asyncError) {
                        console.error('异步处理过程中出错，但用户已注册成功:', asyncError);
                    }
                }, 0);
                
            } catch (saveError) {
                // 检查是否为MongoDB的唯一性约束错误
                if (saveError.code === 11000) {
                    console.log('唯一性约束错误:', saveError);
                    return res.status(400).json({
                        success: false,
                        message: '用户名或邮箱已被使用'
                    });
                }
                
                // 其他保存错误
                console.error('保存用户时出错:', saveError);
                return res.status(500).json({
                    success: false,
                    message: '注册失败，保存用户时出错',
                    error: saveError.message
                });
            }
            
        } catch (dbError) {
            console.error('数据库操作失败:', dbError);
            return res.status(500).json({
                success: false,
                message: '注册失败，数据库操作错误',
                error: dbError.message
            });
        }
    } catch (error) {
        console.error('注册失败:', error);
        return res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: error.message
        });
    }
};

// 用户登录
export const login = async (req, res) => {
    try {
        const { identifier, password } = req.body;

        // 查找用户 - 支持使用邮箱或用户名登录
        const user = await User.findOne({
            $or: [
                { email: identifier },
                { username: identifier }
            ]
        }).select('+password');


        if (!user) {
            const response = {
                success: false,
                type: 'not_found',
                message: '账号不存在，请先注册'
            };
            return res.status(401).json(response);
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            const response = {
                success: false,
                type: 'invalid_credentials',
                message: '用户名/邮箱或密码不正确'
            };
            return res.status(401).json(response);
        }

        if (!user.isEmailVerified) {
            const response = {
                success: false,
                type: 'unverified',
                message: '请先验证您的邮箱后再登录'
            };
            return res.status(401).json(response);
        }

        const tokens = generateTokens(user._id);

        res.json({
            success: true,
            ...tokens,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isEmailVerified: user.isEmailVerified,
                penName: user.penName,
                avatar: user.avatar,
                profile: user.profile
            }
        });
    } catch (error) {
        console.error('Login error:', error); // 添加日志
        res.status(400).json({
            success: false,
            type: 'error',
            message: '登录处理失败，请稍后重试'
        });
    }
};

// 刷新Token
export const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        // 验证刷新Token
        const decoded = verifyRefreshToken(refreshToken);
        if (!decoded) {
            return res.status(401).json({
                success: false,
                message: '刷新Token无效或已过期，请重新登录'
            });
        }

        // 检查用户是否存在
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户不存在'
            });
        }

        // 生成新的Token对
        const tokens = generateTokens(user._id);

        res.json({
            success: true,
            ...tokens,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isEmailVerified: user.isEmailVerified,
                penName: user.penName,
                avatar: user.avatar,
                profile: user.profile
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: '刷新Token失败，请重新登录'
        });
    }
};

// 验证邮箱
export const verifyEmail = async (req, res) => {
    console.log('===== 开始处理邮箱验证请求 =====');
    console.log('验证令牌:', req.params.token);
    
    try {
        const { token } = req.params;
        
        if (!token) {
            console.error('缺少验证令牌');
            return res.status(400).json({
                success: false,
                message: '验证链接无效，缺少令牌'
            });
        }
        
        // 创建哈希令牌
        const hashedToken = crypto
            .createHash('sha256')
            .update(token)
            .digest('hex');
            
        console.log('哈希后的令牌:', hashedToken);
        console.log('查找匹配的用户...');

        // 查找用户
        const user = await User.findOne({
            emailVerificationToken: hashedToken,
            emailVerificationExpires: { $gt: Date.now() }
        });

        if (!user) {
            console.error('未找到匹配的用户或令牌已过期');
            return res.status(400).json({
                success: false,
                message: '验证链接无效或已过期'
            });
        }
        
        console.log('找到用户:', user.username);
        console.log('当前验证状态:', user.isEmailVerified);

        // 标记邮箱为已验证
        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        
        console.log('保存更新后的用户信息...');
        await user.save();
        console.log('用户信息已更新，验证状态:', user.isEmailVerified);

        // 生成登录token
        const tokens = generateTokens(user._id);
        console.log('已生成新的访问令牌');

        console.log('===== 邮箱验证成功完成 =====');
        res.json({
            success: true,
            message: '邮箱验证成功',
            ...tokens,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                isEmailVerified: user.isEmailVerified,
                penName: user.penName,
                avatar: user.avatar,
                profile: user.profile
            }
        });
    } catch (error) {
        console.error('===== 邮箱验证过程中出错 =====');
        console.error(error);
        res.status(400).json({
            success: false,
            message: error.message || '验证过程中出错，请稍后重试'
        });
    }
}; 