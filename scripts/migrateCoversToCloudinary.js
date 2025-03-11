// 将现有小说封面迁移到Cloudinary
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Novel } from '../src/models/novel.js';
import cloudinary from '../src/config/cloudinaryConfig.js';
import fs from 'fs';
import path from 'path';

// 加载环境变量
dotenv.config();

// 默认图片路径
const DEFAULT_COVER = '/images/default-cover.jpg';
const DEFAULT_TEMPLATE_PATTERN = /^\/templates\/cover-template-\d+\.jpg$/;

// 连接数据库
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('数据库连接成功'))
  .catch(err => {
    console.error('数据库连接失败:', err);
    process.exit(1);
  });

// 将本地图片上传到Cloudinary
const uploadToCloudinary = async (localPath, publicPath) => {
  try {
    // 如果是相对路径，转换为绝对路径
    const fullPath = path.isAbsolute(localPath) 
      ? localPath 
      : path.join(process.cwd(), 'public', publicPath.startsWith('/') ? publicPath.substring(1) : publicPath);
    
    console.log(`尝试上传文件: ${fullPath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
      console.error(`文件不存在: ${fullPath}`);
      return null;
    }
    
    // 上传到Cloudinary
    const result = await cloudinary.uploader.upload(fullPath, {
      folder: 'novel-covers',
      resource_type: 'image'
    });
    
    console.log(`成功上传到Cloudinary: ${result.secure_url}`);
    return result;
  } catch (error) {
    console.error(`上传失败: ${error.message}`);
    return null;
  }
};

// 迁移封面
const migrateCovers = async () => {
  try {
    // 获取所有小说
    const novels = await Novel.find();
    
    console.log(`找到 ${novels.length} 本小说需要迁移封面`);
    
    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    
    // 遍历小说
    for (const novel of novels) {
      // 跳过默认封面和模板封面
      if (novel.cover === DEFAULT_COVER || DEFAULT_TEMPLATE_PATTERN.test(novel.cover)) {
        console.log(`跳过小说 ${novel.title}: 使用默认封面或模板封面`);
        skipCount++;
        continue;
      }
      
      // 如果已经有Cloudinary URL，也跳过
      if (novel.cover && novel.cover.includes('cloudinary.com')) {
        console.log(`跳过小说 ${novel.title}: 已经使用Cloudinary`);
        skipCount++;
        continue;
      }
      
      console.log(`处理小说: ${novel.title}, 当前封面: ${novel.cover}`);
      
      // 上传到Cloudinary
      const result = await uploadToCloudinary(null, novel.cover);
      
      if (result) {
        // 更新小说封面信息
        novel.cover = result.secure_url;
        novel.coverPublicId = result.public_id;
        await novel.save();
        
        console.log(`更新小说 ${novel.title} 封面为: ${novel.cover}`);
        successCount++;
      } else {
        console.error(`小说 ${novel.title} 封面迁移失败`);
        failCount++;
      }
    }
    
    console.log('迁移完成!');
    console.log(`成功: ${successCount}, 跳过: ${skipCount}, 失败: ${failCount}`);
  } catch (error) {
    console.error('迁移过程中出错:', error);
  } finally {
    // 断开数据库连接
    mongoose.disconnect();
  }
};

// 执行迁移
migrateCovers(); 