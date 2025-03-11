const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * 中间件：处理模板封面请求，动态添加标题和作者信息
 */
async function handleCoverTemplateRequest(req, res, next) {
    try {
        // 添加详细日志
        console.log('封面模板请求:', req.path);
        console.log('查询参数:', req.query);
        console.log('URL:', req.url);
        
        // 检查请求是否包含title或author参数
        const { title, author } = req.query;
        
        // 如果没有请求参数，直接使用静态文件
        if (!title && !author) {
            console.log('没有标题或作者参数，使用静态文件');
            return next();
        }
        
        console.log(`处理动态封面请求 - 标题: "${title}", 作者: "${author}"`);
        
        // 修正：获取正确的模板文件路径
        // 从路径中提取文件名，不需要关心路径前缀
        const fileName = path.basename(req.path);
        const templatePath = path.join(process.cwd(), 'public', 'templates', fileName);
        
        console.log('修正后的模板文件路径:', templatePath);
        
        // 检查文件是否存在
        if (!fs.existsSync(templatePath)) {
            console.log('模板文件不存在:', templatePath);
            return next();
        }
        
        // 加载模板图片
        const templateImage = await loadImage(templatePath);
        console.log('模板图片加载成功, 尺寸:', templateImage.width, 'x', templateImage.height);
        
        // 创建canvas和上下文
        const canvas = createCanvas(templateImage.width, templateImage.height);
        const ctx = canvas.getContext('2d');
        
        // 绘制模板背景
        ctx.drawImage(templateImage, 0, 0);
        
        // 提取模板ID
        const templateIdMatch = fileName.match(/cover-template-(\d+)\.jpg/);
        const templateId = templateIdMatch ? parseInt(templateIdMatch[1]) : 1;
        console.log('使用模板ID:', templateId);
        
        // 根据模板ID设置文本颜色和背景色
        let textColor = '#FFFFFF';
        let bgColor = '#000000';
        switch(templateId) {
            case 2:
                textColor = '#000000'; // 简约白模板使用黑色文字
                bgColor = '#FFFFFF';
                break;
            case 3:
                bgColor = '#1a237e';
                break;
            case 4:
                bgColor = '#b71c1c';
                break;
            case 5:
                bgColor = '#004d40';
                break;
            case 6:
                bgColor = '#4a148c';
                break;
            default:
                bgColor = '#000000'; // 默认黑色背景
        }
        
        // 清除原有文字区域 - 位置下移一点，不到中间
        ctx.fillStyle = bgColor;
        
        // 清除中间区域 (1/3处到中间之间，垂直方向)
        const titleY = Math.floor(canvas.height * 0.33); // 从1/4下移到1/3
        ctx.fillRect(0, 0, canvas.width, canvas.height); // 清除整个画布
        
        // 重新绘制边框
        ctx.strokeStyle = templateId === 2 ? '#CCCCCC' : '#333333';
        ctx.lineWidth = 10;
        ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
        
        // 设置字体和文本对齐方式
        ctx.textAlign = 'center'; // 居中对齐文本
        ctx.fillStyle = textColor;
        
        // 绘制标题（如果有）- 垂直1/3处
        if (title) {
            // 调整字体大小 - 与作者大小接近
            ctx.font = `bold 36px "Microsoft YaHei", SimHei, SimSun, sans-serif`;
            console.log('使用字体:', ctx.font);
            
            // 处理换行
            const maxWidth = canvas.width * 0.8; // 页面宽度的80%
            if (ctx.measureText(title).width > maxWidth) {
                // 将标题分成多行
                const words = title.split('');
                let lines = [];
                let currentLine = '';
                
                // 尝试为每个字符分配行
                for (let i = 0; i < words.length; i++) {
                    const testLine = currentLine + words[i];
                    const testWidth = ctx.measureText(testLine).width;
                    
                    if (testWidth > maxWidth && i > 0) {
                        lines.push(currentLine);
                        currentLine = words[i];
                    } else {
                        currentLine = testLine;
                    }
                }
                
                // 添加最后一行
                if (currentLine !== '') {
                    lines.push(currentLine);
                }
                
                console.log(`标题分成 ${lines.length} 行:`, lines);
                
                // 计算总高度，使文本块居中
                const lineHeight = 40;
                const totalHeight = lines.length * lineHeight;
                const startY = titleY - (totalHeight / 2) + (lineHeight / 2);
                
                // 绘制每一行
                lines.forEach((line, index) => {
                    ctx.fillText(line, canvas.width / 2, startY + (index * lineHeight));
                });
            } else {
                console.log(`绘制标题: "${title}"`);
                ctx.fillText(title, canvas.width / 2, titleY);
            }
        }
        
        // 绘制作者（如果有）- 紧跟标题下方
        if (author) {
            // 减小作者字体大小
            ctx.font = `30px "Microsoft YaHei", SimHei, SimSun, sans-serif`;
            console.log(`绘制作者: "${author}"`);
            
            // 计算作者位置 - 根据标题是否换行调整
            const authorY = title && ctx.measureText(title).width > canvas.width * 0.8 
                ? titleY + 100 // 如果标题换行，给更多空间
                : titleY + 60;  // 标题没换行，紧跟其后
                
            // 在标题下方居中绘制作者名称
            ctx.fillText(author, canvas.width / 2, authorY);
        }
        
        // 设置响应头并输出图片
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'max-age=0'); // 禁用缓存，确保每次都重新生成
        console.log('准备输出动态生成的封面图片');
        
        // 将canvas输出为JPEG图片流
        const stream = canvas.createJPEGStream({
            quality: 0.95
        });
        stream.pipe(res);
        console.log('动态封面图片已输出');
        
    } catch (error) {
        console.error('处理模板封面请求失败:', error);
        next(); // 出错时继续使用静态文件
    }
}

module.exports = { handleCoverTemplateRequest }; 