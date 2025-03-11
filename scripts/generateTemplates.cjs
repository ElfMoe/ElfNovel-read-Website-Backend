const fs = require('fs');
const path = require('path');
const { createCanvas, registerFont } = require('canvas');

// 确保目录存在
const templatesDir = path.join(process.cwd(), 'public', 'templates');
const imagesDir = path.join(process.cwd(), 'public', 'images');

// 创建目录（如果不存在）
[templatesDir, imagesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    console.log(`创建目录: ${dir}`);
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 设置中文字体
// 使用系统安装的字体，提供多个备选字体，确保至少一个能支持中文
const chineseFontFamily = '"Microsoft YaHei", "SimHei", "PingFang SC", "STHeiti", "Source Han Sans CN", sans-serif';

// 模板配置
const templates = [
  { id: 1, name: '简约黑', bgColor: '#000000', textColor: '#FFFFFF', borderColor: '#333333' },
  { id: 2, name: '简约白', bgColor: '#FFFFFF', textColor: '#000000', borderColor: '#CCCCCC' },
  { id: 3, name: '深蓝', bgColor: '#1a237e', textColor: '#FFFFFF', borderColor: '#0d47a1' },
  { id: 4, name: '红色系', bgColor: '#b71c1c', textColor: '#FFFFFF', borderColor: '#7f0000' },
  { id: 5, name: '青绿', bgColor: '#004d40', textColor: '#FFFFFF', borderColor: '#00251a' },
  { id: 6, name: '紫色梦幻', bgColor: '#4a148c', textColor: '#FFFFFF', borderColor: '#12005e' },
];

// 封面尺寸
const width = 400;
const height = 600;

// 生成每个模板的封面图片
templates.forEach(template => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // 绘制背景
  ctx.fillStyle = template.bgColor;
  ctx.fillRect(0, 0, width, height);
  
  // 绘制边框
  ctx.strokeStyle = template.borderColor;
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, width - 10, height - 10);
  
  // 不显示模板名称，直接绘制说明文字
  ctx.fillStyle = template.textColor;
  ctx.textAlign = 'center';
  
  // 计算1/3位置 - 稍微下移
  const titleY = Math.floor(height * 0.33);
  
  // 小说标题说明文字 - 更适合的大小
  ctx.font = `bold 36px ${chineseFontFamily}`;
  ctx.fillText('小说标题将显示在此处', width / 2, titleY);
  
  // 作者名称说明文字 - 紧跟标题下方
  ctx.font = `30px ${chineseFontFamily}`;
  ctx.fillText('作者名称将显示在此处', width / 2, titleY + 60);
  
  // 保存为JPG文件
  const filePath = path.join(templatesDir, `cover-template-${template.id}.jpg`);
  const buffer = canvas.toBuffer('image/jpeg');
  fs.writeFileSync(filePath, buffer);
  
  console.log(`已生成模板 ${template.id}: ${template.name} -> ${filePath}`);
});

// 创建默认封面
const defaultCanvas = createCanvas(width, height);
const defaultCtx = defaultCanvas.getContext('2d');

// 绘制默认封面
defaultCtx.fillStyle = '#f5f5f5';
defaultCtx.fillRect(0, 0, width, height);

// 绘制边框
defaultCtx.strokeStyle = '#cccccc';
defaultCtx.lineWidth = 10;
defaultCtx.strokeRect(5, 5, width - 10, height - 10);

// 绘制文字
defaultCtx.fillStyle = '#757575';
defaultCtx.textAlign = 'center';

// 计算1/3位置
const titleY = Math.floor(height * 0.33);
defaultCtx.font = `bold 36px ${chineseFontFamily}`;
defaultCtx.fillText('小说封面未设置', width / 2, titleY);

// 保存默认封面
const defaultFilePath = path.join(imagesDir, 'default-cover.jpg');
const defaultBuffer = defaultCanvas.toBuffer('image/jpeg');
fs.writeFileSync(defaultFilePath, defaultBuffer);

console.log(`已生成默认封面: ${defaultFilePath}`);
console.log('所有封面模板生成完成！'); 