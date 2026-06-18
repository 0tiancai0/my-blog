// 文件上传 API — 本地存储（阿里云服务器）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// 上传目录（项目根目录下的 public/uploads）
const UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');

// 确保上传目录存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// 最大文件大小 10MB
const MAX_SIZE = 10 * 1024 * 1024;

// 允许的文件类型
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/markdown',
  'application/zip', 'application/gzip', 'application/x-tar',
  'application/json', 'text/csv',
];

export async function POST({ request }: { request: Request }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return new Response(
      JSON.stringify({ error: '请使用 multipart/form-data 上传文件' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: '无法解析表单数据' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: '未找到上传文件（字段名: file）' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (file.size > MAX_SIZE) {
    return new Response(
      JSON.stringify({ error: `文件过大，最大允许 ${MAX_SIZE / 1024 / 1024}MB` }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type) && file.type !== '') {
    return new Response(
      JSON.stringify({ error: `不支持的文件类型: ${file.type}` }),
      { status: 415, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 生成唯一文件名
    const ext = path.extname(file.name);
    const baseName = path.basename(file.name, ext);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const safeFilename = `${baseName}-${randomSuffix}${ext}`;
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    // 写入文件
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const url = `/uploads/${safeFilename}`;

    return new Response(
      JSON.stringify({
        success: true,
        url,
        filename: safeFilename,
        originalName: file.name,
        size: file.size,
        contentType: file.type,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(
      JSON.stringify({ error: '上传失败，请稍后重试' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
