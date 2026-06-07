import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hot-blooded-qa';

export async function connectDatabase(): Promise<void> {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`MongoDB 连接成功: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);
  } catch (error) {
    console.error('MongoDB 连接失败:', error);
    throw error;
  }
}

// 连接事件监听
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB 连接断开');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB 连接错误:', err);
});

// 优雅关闭
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB 连接已关闭');
  process.exit(0);
});