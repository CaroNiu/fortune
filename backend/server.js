const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 连接 MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fortune';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB 已连接'))
  .catch(err => console.error('MongoDB 连接失败:', err));

// 用户模型
const userSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
  birthday: { type: String, required: true },
  zodiac: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// 打卡记录模型
const checkinSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  fortune: {
    overall: Number,
    career: Number,
    wealth: Number,
    love: Number,
    health: Number,
    luckyColor: String,
    luckyNumber: Number,
    luckyTime: String,
    suitable: String,
    avoid: String
  },
  createdAt: { type: Date, default: Date.now }
});

// 添加唯一索引，防止重复打卡
checkinSchema.index({ userId: 1, date: 1 }, { unique: true });

const User = mongoose.model('User', userSchema);
const Checkin = mongoose.model('Checkin', checkinSchema);

// ==================== 工具函数 ====================

// 简单哈希函数
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 计算运势
function calculateFortune(birthday, date) {
  const colors = ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '粉色', '金色', '银色'];
  const suitableList = ['签约', '出行', '投资', '表白', '理发', '搬家', '开业', '旅游', '学习', '健身'];
  const avoidList = ['冲动消费', '争吵', '熬夜', '高风险投资', '迟到', '暴饮暴食', '拖延', '借钱', '八卦'];
  const times = ['卯时(5-7点)', '辰时(7-9点)', '巳时(9-11点)', '午时(11-13点)', '未时(13-15点)', '申时(15-17点)'];
  
  const seed = birthday + date;
  const hash = simpleHash(seed);
  
  return {
    overall: 60 + (hash % 41),
    career: 50 + ((hash * 7) % 51),
    wealth: 50 + ((hash * 11) % 51),
    love: 50 + ((hash * 13) % 51),
    health: 50 + ((hash * 17) % 51),
    luckyColor: colors[hash % colors.length],
    luckyNumber: (hash % 99) + 1,
    luckyTime: times[hash % times.length],
    suitable: suitableList[hash % suitableList.length],
    avoid: avoidList[(hash * 3) % avoidList.length]
  };
}

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 用户注册/登录（简单版，根据昵称+生日找用户）
app.post('/api/auth', async (req, res) => {
  try {
    const { nickname, birthday } = req.body;
    
    if (!nickname || !birthday) {
      return res.status(400).json({ error: '昵称和生日不能为空' });
    }
    
    // 查找或创建用户
    let user = await User.findOne({ nickname, birthday });
    
    if (!user) {
      user = new User({ nickname, birthday });
      await user.save();
    }
    
    res.json({
      success: true,
      user: {
        id: user._id,
        nickname: user.nickname,
        birthday: user.birthday
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取今日运势
app.get('/api/fortune/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const fortune = calculateFortune(user.birthday, today);
    
    // 检查今日是否已打卡
    const todayCheckin = await Checkin.findOne({ userId, date: today });
    
    res.json({
      success: true,
      date: today,
      fortune,
      hasCheckedIn: !!todayCheckin
    });
  } catch (error) {
    console.error('获取运势失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 打卡
app.post('/api/checkin', async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 检查是否已打卡
    const existing = await Checkin.findOne({ userId, date: today });
    if (existing) {
      return res.status(400).json({ error: '今日已打卡' });
    }
    
    // 计算运势并保存
    const fortune = calculateFortune(user.birthday, today);
    
    const checkin = new Checkin({
      userId,
      date: today,
      fortune
    });
    
    await checkin.save();
    
    res.json({
      success: true,
      message: '打卡成功',
      fortune
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: '今日已打卡' });
    }
    console.error('打卡失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取打卡历史
app.get('/api/checkins/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month } = req.query; // 可选：筛选某月，格式：2026-03
    
    let query = { userId };
    if (month) {
      query.date = { $regex: `^${month}` };
    }
    
    const checkins = await Checkin.find(query)
      .sort({ date: -1 })
      .select('date fortune -_id');
    
    // 计算统计数据
    const totalCheckins = await Checkin.countDocuments({ userId });
    
    // 计算连续打卡天数
    const allDates = await Checkin.find({ userId })
      .sort({ date: -1 })
      .select('date -_id');
    
    let streakDays = 0;
    let maxStreak = 0;
    let currentStreak = 0;
    let prevDate = null;
    
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    // 计算当前连续天数
    const dateList = allDates.map(c => c.date);
    let checkDate = dateList.includes(today) ? today : yesterday;
    
    while (dateList.includes(checkDate)) {
      streakDays++;
      const prev = new Date(new Date(checkDate) - 86400000).toISOString().split('T')[0];
      checkDate = prev;
    }
    
    // 计算最高连续天数
    const sortedDates = dateList.sort();
    for (let i = 0; i < sortedDates.length; i++) {
      if (i === 0) {
        currentStreak = 1;
      } else {
        const diff = (new Date(sortedDates[i]) - new Date(sortedDates[i-1])) / 86400000;
        if (diff === 1) {
          currentStreak++;
        } else {
          maxStreak = Math.max(maxStreak, currentStreak);
          currentStreak = 1;
        }
      }
    }
    maxStreak = Math.max(maxStreak, currentStreak);
    
    // 计算平均运势
    const allFortunes = await Checkin.find({ userId }).select('fortune.overall -_id');
    const avgScore = allFortunes.length > 0 
      ? Math.round(allFortunes.reduce((sum, c) => sum + c.fortune.overall, 0) / allFortunes.length)
      : 0;
    
    res.json({
      success: true,
      checkins: checkins.map(c => ({
        date: c.date,
        fortune: c.fortune
      })),
      stats: {
        totalCheckins,
        streakDays,
        maxStreak,
        avgScore
      }
    });
  } catch (error) {
    console.error('获取打卡历史失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户数据（GDPR/隐私合规）
app.delete('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await User.findByIdAndDelete(userId);
    await Checkin.deleteMany({ userId });
    
    res.json({ success: true, message: '用户数据已删除' });
  } catch (error) {
    console.error('删除用户失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ==================== 启动服务 ====================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务器运行在端口 ${PORT}`);
});

module.exports = app;
