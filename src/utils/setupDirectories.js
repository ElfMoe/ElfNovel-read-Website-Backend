import fs from 'fs';
import path from 'path';

/**
 * 确保必要的目录存在
 */
export const setupDirectories = () => {
    const directories = [
        'public',
        'public/uploads',
        'public/images',
        'public/templates'
    ];

    directories.forEach(dir => {
        const fullPath = path.join(process.cwd(), dir);
        if (!fs.existsSync(fullPath)) {
            console.log(`创建目录: ${fullPath}`);
            fs.mkdirSync(fullPath, { recursive: true });
        } else {
            console.log(`目录已存在: ${fullPath}`);
        }
    });

    // 复制默认图片和模板
    const defaultFiles = [
        { src: 'src/assets/default-cover.jpg', dest: 'public/images/default-cover.jpg' },
        { src: 'src/assets/templates/cover-template-1.jpg', dest: 'public/templates/cover-template-1.jpg' },
        { src: 'src/assets/templates/cover-template-2.jpg', dest: 'public/templates/cover-template-2.jpg' },
        { src: 'src/assets/templates/cover-template-3.jpg', dest: 'public/templates/cover-template-3.jpg' },
        { src: 'src/assets/templates/cover-template-4.jpg', dest: 'public/templates/cover-template-4.jpg' },
        { src: 'src/assets/templates/cover-template-5.jpg', dest: 'public/templates/cover-template-5.jpg' },
        { src: 'src/assets/templates/cover-template-6.jpg', dest: 'public/templates/cover-template-6.jpg' }
    ];

    defaultFiles.forEach(file => {
        const destPath = path.join(process.cwd(), file.dest);
        const srcPath = path.join(process.cwd(), file.src);
        
        if (!fs.existsSync(destPath) && fs.existsSync(srcPath)) {
            console.log(`复制文件: ${srcPath} -> ${destPath}`);
            fs.copyFileSync(srcPath, destPath);
        }
    });

    console.log('目录设置完成');
}; 