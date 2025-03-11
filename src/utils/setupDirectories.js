import fs from 'fs';
import path from 'path';

/**
 * 确保必要的目录存在
 */
export const setupDirectories = () => {
    const directories = [
        path.join(process.cwd(), 'public'),
        path.join(process.cwd(), 'public/uploads'),
        path.join(process.cwd(), 'public/templates'),
        path.join(process.cwd(), 'public/images')
    ];
    
    // 确保每个目录都存在
    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            console.log(`创建目录: ${dir}`);
            fs.mkdirSync(dir, { recursive: true });
        }
    });
    
    // 确保默认封面存在
    const defaultCover = path.join(process.cwd(), 'public/images/default-cover.jpg');
    if (!fs.existsSync(defaultCover)) {
        console.log('默认封面不存在，需要创建');
        // 如果服务器重启，应该运行脚本生成封面
        try {
            // 尝试运行脚本生成封面
            console.log('正在生成默认封面和模板...');
            require('child_process').execSync('node scripts/generateTemplates.cjs', {
                stdio: 'inherit'
            });
            console.log('封面生成成功');
        } catch (error) {
            console.error('生成封面失败，请手动运行脚本:', error);
        }
    } else {
        console.log('默认封面已存在');
    }
    
    // 检查所有模板封面
    for (let i = 1; i <= 6; i++) {
        const templateCover = path.join(process.cwd(), `public/templates/cover-template-${i}.jpg`);
        if (!fs.existsSync(templateCover)) {
            console.log(`模板封面 ${i} 不存在，请运行脚本生成封面`);
        }
    }
    
    console.log('目录设置完成');
}; 