// 文件上传 API — 本地存储（阿里云服务器）
// 优化：streaming 解析 + SHA256 内容哈希去重 + 文件魔数校验
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import Busboy from 'busboy';

const UPLOAD_DIR = path.resolve(process.cwd(), 'public/uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// 允许的扩展名 → MIME 映射
const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.json': 'application/json',
  '.csv': 'text/csv',
};

// 文件头魔数校验（防止伪造 MIME 类型）
const MAGIC: Record<string, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47],
  jpeg: [0xff, 0xd8, 0xff],
  gif: [0x47, 0x49, 0x46],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  zip: [0x50, 0x4b, 0x03, 0x04], // PK..
  gz: [0x1f, 0x8b], // gzip
};

function getMagicKey(ext: string): string | null {
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg';
    case '.gz':
      return 'gz';
    default:
      return ext.slice(1);
  }
}

function verifyMagic(head: Buffer, ext: string): boolean {
  const key = getMagicKey(ext);
  if (!key || !MAGIC[key]) return true; // 没有定义魔数的类型跳过校验
  const magic = MAGIC[key];
  if (head.length < magic.length) return false;
  return magic.every((b, i) => head[i] === b);
}

function sanitizeFilename(name: string): string {
  // 去掉路径分隔符和危险字符，只保留安全字符
  return name
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/^\.+/, '_') // 防止以点开头的隐藏文件
    .replace(/[\x00-\x1f]/g, '') // 去掉控制字符
    .slice(0, 255); // 限制长度
}

function ok(data: object): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST({ request }: { request: Request }) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return err('请使用 multipart/form-data 上传文件');
  }

  if (!request.body) {
    return err('请求体为空', 400);
  }

  // 将 Web ReadableStream 转为 Node Readable，pipe 给 busboy
  const body = Readable.fromWeb(request.body as any);

  const bb = Busboy({
    headers: {
      'content-type': contentType,
    },
    limits: {
      fileSize: MAX_SIZE,
      files: 1, // 每次只处理一个文件
    },
  });

  return new Promise<Response>((resolve) => {
    let resolved = false;

    const finalize = (res: Response) => {
      if (resolved) return;
      resolved = true;
      // 清理：消费剩余的 stream 以防内存泄漏
      body.unpipe(bb);
      try { bb.destroy(); } catch { /* ignore */ }
      resolve(res);
    };

    bb.on('file', (fieldname: string, file: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      const originalName = sanitizeFilename(info.filename);

      // 校验扩展名
      const ext = path.extname(originalName).toLowerCase();
      if (!ext || !EXT_TO_MIME[ext]) {
        finalize(err(`不支持的文件类型: ${ext || '未知'}`, 415));
        // 消费掉文件流
        file.resume();
        return;
      }

      // 写入临时文件（随机后缀，避免并发冲突）
      const tmpSuffix = crypto.randomBytes(6).toString('hex');
      const tmpPath = path.join(UPLOAD_DIR, `.tmp-${tmpSuffix}${ext}`);

      const writeStream = fs.createWriteStream(tmpPath);
      const hash = crypto.createHash('sha256');
      let fileSize = 0;
      let magicChecked = false;
      const magicBuffer: Buffer[] = [];

      file.on('data', (chunk: Buffer) => {
        fileSize += chunk.length;

        // 收集前几个字节用于魔数校验
        if (!magicChecked) {
          magicBuffer.push(chunk);
          const head = Buffer.concat(magicBuffer);
          if (head.length >= 16 || chunk === file.readableEnded) {
            magicChecked = true;
            if (!verifyMagic(head, ext)) {
              finalize(err(`文件内容与扩展名 ${ext} 不匹配`, 415));
              writeStream.destroy();
              fs.unlink(tmpPath, () => {});
              file.destroy();
              return;
            }
          }
        }

        hash.update(chunk);
        writeStream.write(chunk);
      });

      file.on('end', () => {
        writeStream.end();
      });

      file.on('error', (e: Error) => {
        writeStream.destroy();
        fs.unlink(tmpPath, () => {});
        finalize(err('文件读取失败', 500));
      });

      writeStream.on('error', (e: Error) => {
        fs.unlink(tmpPath, () => {});
        finalize(err('写入文件失败', 500));
      });

      writeStream.on('finish', () => {
        if (resolved) return;

        if (fileSize === 0) {
          fs.unlink(tmpPath, () => {});
          finalize(err('文件为空', 400));
          return;
        }

        const digest = hash.digest('hex');
        const finalExt = ext; // 用原始扩展名
        const hashFilename = `${digest}${finalExt}`;
        const finalPath = path.join(UPLOAD_DIR, hashFilename);

        // 检查是否已有相同哈希的文件（去重）
        if (fs.existsSync(finalPath)) {
          // 重复文件，删除临时文件
          fs.unlink(tmpPath, () => {});
          const existingStat = fs.statSync(finalPath);
          finalize(
            ok({
              success: true,
              url: `/uploads/${hashFilename}`,
              filename: hashFilename,
              originalName,
              size: existingStat.size,
              contentType: EXT_TO_MIME[finalExt],
              deduplicated: true,
            })
          );
          return;
        }

        // 原子性重命名
        try {
          fs.renameSync(tmpPath, finalPath);
        } catch {
          // 重命名失败（可能被并发上传完成），检查是否已有文件
          fs.unlink(tmpPath, () => {});
          if (fs.existsSync(finalPath)) {
            finalize(
              ok({
                success: true,
                url: `/uploads/${hashFilename}`,
                filename: hashFilename,
                originalName,
                size: fs.statSync(finalPath).size,
                contentType: EXT_TO_MIME[finalExt],
                deduplicated: true,
              })
            );
          } else {
            finalize(err('文件保存失败', 500));
          }
          return;
        }

        finalize(
          ok({
            success: true,
            url: `/uploads/${hashFilename}`,
            filename: hashFilename,
            originalName,
            size: fileSize,
            contentType: EXT_TO_MIME[finalExt],
            deduplicated: false,
          })
        );
      });
    });

    bb.on('filesLimit', () => {
      finalize(err('一次只能上传一个文件', 400));
    });

    bb.on('error', (e: Error) => {
      finalize(err('上传解析失败', 400));
    });

    bb.on('close', () => {
      // 如果没有收到 file 事件，说明没有上传文件
      if (!resolved) {
        finalize(err('未找到上传文件（字段名: file）', 400));
      }
    });

    body.pipe(bb);
  });
}
