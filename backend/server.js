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

// ==================== 数据模型 ====================

// 用户模型
const userSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
  birthday: { type: String, required: true },
  zodiac: { type: String },
  vipLevel: { type: Number, default: 0 }, // 0=普通, 1=月度, 2=年度
  vipExpireAt: { type: Date },
  reminderSettings: {
    dailyPush: { type: Boolean, default: false },
    pushTime: { type: String, default: '08:00' },
    email: { type: String },
    wechatId: { type: String }
  },
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
  memo: { type: String }, // 今日备忘
  mood: { type: String }, // 心情
  isPublic: { type: Boolean, default: true }, // 是否公开
  likeCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

checkinSchema.index({ userId: 1, date: 1 }, { unique: true });

// 点赞模型
const likeSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  checkinId: { type: mongoose.Schema.Types.ObjectId, required: true },
  createdAt: { type: Date, default: Date.now }
});
likeSchema.index({ userId: 1, checkinId: 1 }, { unique: true });

// 备忘录模型
const memoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  content: { type: String, required: true },
  date: { type: String, required: true },
  isDone: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// 订单模型（付费）
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['month', 'year', 'report'], required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  payMethod: { type: String },
  paidAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Checkin = mongoose.model('Checkin', checkinSchema);
const Like = mongoose.model('Like', likeSchema);
const Memo = mongoose.model('Memo', memoSchema);
const Order = mongoose.model('Order', orderSchema);

// ==================== 工具函数 ====================

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

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

// 生成运势解读
function generateFortuneReading(fortune) {
  const readings = [];
  
  // 综合运势解读
  if (fortune.overall >= 90) {
    readings.push({ type: 'overall', level: '大吉', text: '今日鸿运当头，诸事顺遂，把握机会可成大事。' });
  } else if (fortune.overall >= 80) {
    readings.push({ type: 'overall', level: '吉', text: '运势上扬，心情愉悦，适合开展新计划。' });
  } else if (fortune.overall >= 70) {
    readings.push({ type: 'overall', level: '平', text: '运势平稳，按部就班即可，不宜冒进。' });
  } else if (fortune.overall >= 60) {
    readings.push({ type: 'overall', level: '小凶', text: '略有阻滞，需谨慎行事，多听取他人建议。' });
  } else {
    readings.push({ type: 'overall', level: '凶', text: '运势低迷，宜守不宜攻，静待时机。' });
  }
  
  // 分项解读
  const aspects = [
    { name: '事业', score: fortune.career, key: 'career' },
    { name: '财运', score: fortune.wealth, key: 'wealth' },
    { name: '感情', score: fortune.love, key: 'love' },
    { name: '健康', score: fortune.health, key: 'health' }
  ];
  
  aspects.forEach(aspect => {
    let text = '';
    if (aspect.score >= 90) {
      text = `${aspect.name}方面极为顺利，贵人相助，把握机遇。`;
    } else if (aspect.score >= 80) {
      text = `${aspect.name}运势良好，稳步推进，成果可期。`;
    } else if (aspect.score >= 70) {
      text = `${aspect.name}平稳发展，保持现状，不宜大动。`;
    } else if (aspect.score >= 60) {
      text = `${aspect.name}略有波折，小心谨慎，避免冲动。`;
    } else {
      text = `${aspect.name}面临挑战，保守为上，寻求帮助。`;
    }
    readings.push({ type: aspect.key, level: aspect.score, text });
  });
  
  return readings;
}

// ==================== API 路由 ====================

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 用户注册/登录
app.post('/api/auth', async (req, res) => {
  try {
    const { nickname, birthday } = req.body;
    
    if (!nickname || !birthday) {
      return res.status(400).json({ error: '昵称和生日不能为空' });
    }
    
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
        birthday: user.birthday,
        vipLevel: user.vipLevel,
        vipExpireAt: user.vipExpireAt,
        reminderSettings: user.reminderSettings
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
    
    // VIP 用户返回详细解读
    let reading = null;
    const isVip = user.vipLevel > 0 && (!user.vipExpireAt || user.vipExpireAt > new Date());
    if (isVip) {
      reading = generateFortuneReading(fortune);
    }
    
    res.json({
      success: true,
      date: today,
      fortune,
      reading,
      isVip,
      hasCheckedIn: !!todayCheckin
    });
  } catch (error) {
    console.error('获取运势失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取周运势
app.get('/api/fortune/:userId/week', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    // 获取本周7天运势
    const weekFortunes = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      const fortune = calculateFortune(user.birthday, dateStr);
      weekFortunes.push({
        date: dateStr,
        weekday: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()],
        isToday: i === 0,
        fortune
      });
    }
    
    // 计算周运势趋势
    const avgScore = Math.round(weekFortunes.reduce((sum, d) => sum + d.fortune.overall, 0) / 7);
    const bestDay = weekFortunes.reduce((best, d) => d.fortune.overall > best.fortune.overall ? d : best);
    const worstDay = weekFortunes.reduce((worst, d) => d.fortune.overall < worst.fortune.overall ? d : worst);
    
    res.json({
      success: true,
      weekFortunes,
      summary: {
        avgScore,
        bestDay: { date: bestDay.date, score: bestDay.fortune.overall },
        worstDay: { date: worstDay.date, score: worstDay.fortune.overall }
      }
    });
  } catch (error) {
    console.error('获取周运势失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 打卡
app.post('/api/checkin', async (req, res) => {
  try {
    const { userId, memo, mood, isPublic = true } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const existing = await Checkin.findOne({ userId, date: today });
    if (existing) {
      return res.status(400).json({ error: '今日已打卡' });
    }
    
    const fortune = calculateFortune(user.birthday, today);
    
    const checkin = new Checkin({
      userId,
      date: today,
      fortune,
      memo,
      mood,
      isPublic
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
    const { month, page = 1, limit = 20 } = req.query;
    
    let query = { userId };
    if (month) {
      query.date = { $regex: `^${month}` };
    }
    
    const checkins = await Checkin.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // 获取点赞数
    const checkinsWithLikes = await Promise.all(checkins.map(async (c) => {
      const likeCount = await Like.countDocuments({ checkinId: c._id });
      return {
        id: c._id,
        date: c.date,
        fortune: c.fortune,
        memo: c.memo,
        mood: c.mood,
        isPublic: c.isPublic,
        likeCount
      };
    }));
    
    // 统计数据
    const totalCheckins = await Checkin.countDocuments({ userId });
    const allDates = await Checkin.find({ userId }).sort({ date: -1 }).select('date fortune.overall -_id');
    
    // 计算连续天数
    let streakDays = 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const dateList = allDates.map(c => c.date);
    let checkDate = dateList.includes(today) ? today : yesterday;
    
    while (dateList.includes(checkDate)) {
      streakDays++;
      const prev = new Date(new Date(checkDate) - 86400000).toISOString().split('T')[0];
      checkDate = prev;
    }
    
    // 计算最高连续
    let maxStreak = 0;
    let currentStreak = 0;
    const sortedDates = [...dateList].sort();
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
    
    // 平均运势
    const avgScore = allDates.length > 0 
      ? Math.round(allDates.reduce((sum, c) => sum + c.fortune.overall, 0) / allDates.length)
      : 0;
    
    res.json({
      success: true,
      checkins: checkinsWithLikes,
      stats: {
        totalCheckins,
        streakDays,
        maxStreak,
        avgScore
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCheckins
      }
    });
  } catch (error) {
    console.error('获取打卡历史失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取排行榜
app.get('/api/rankings', async (req, res) => {
  try {
    const { type = 'today', limit = 10 } = req.query;
    
    let rankings = [];
    
    if (type === 'today') {
      // 今日运势排行
      const today = new Date().toISOString().split('T')[0];
      const checkins = await Checkin.find({ date: today, isPublic: true })
        .populate('userId', 'nickname')
        .sort({ 'fortune.overall': -1 })
        .limit(parseInt(limit));
      
      rankings = checkins.map((c, index) => ({
        rank: index + 1,
        nickname: c.userId?.nickname || '神秘用户',
        score: c.fortune.overall,
        date: c.date
      }));
    } else if (type === 'streak') {
      // 连续打卡排行
      const users = await User.find().select('_id nickname');
      const streaks = await Promise.all(users.map(async (user) => {
        const dates = await Checkin.find({ userId: user._id }).sort({ date: -1 }).select('date -_id');
        const dateList = dates.map(d => d.date);
        
        let streak = 0;
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        let checkDate = dateList.includes(today) ? today : yesterday;
        
        while (dateList.includes(checkDate)) {
          streak++;
          const prev = new Date(new Date(checkDate) - 86400000).toISOString().split('T')[0];
          checkDate = prev;
        }
        
        return { nickname: user.nickname, streak };
      }));
      
      rankings = streaks
        .filter(s => s.streak > 0)
        .sort((a, b) => b.streak - a.streak)
        .slice(0, limit)
        .map((s, index) => ({ rank: index + 1, ...s }));
    }
    
    res.json({ success: true, rankings });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 点赞
app.post('/api/like', async (req, res) => {
  try {
    const { userId, checkinId } = req.body;
    
    const existing = await Like.findOne({ userId, checkinId });
    if (existing) {
      // 取消点赞
      await Like.deleteOne({ userId, checkinId });
      await Checkin.findByIdAndUpdate(checkinId, { $inc: { likeCount: -1 } });
      return res.json({ success: true, liked: false });
    }
    
    // 添加点赞
    const like = new Like({ userId, checkinId });
    await like.save();
    await Checkin.findByIdAndUpdate(checkinId, { $inc: { likeCount: 1 } });
    
    res.json({ success: true, liked: true });
  } catch (error) {
    console.error('点赞失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 备忘录相关
app.get('/api/memos/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { date } = req.query;
    
    let query = { userId };
    if (date) query.date = date;
    
    const memos = await Memo.find(query).sort({ createdAt: -1 });
    res.json({ success: true, memos });
  } catch (error) {
    console.error('获取备忘录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.post('/api/memos', async (req, res) => {
  try {
    const { userId, content, date } = req.body;
    
    const memo = new Memo({ userId, content, date });
    await memo.save();
    
    res.json({ success: true, memo });
  } catch (error) {
    console.error('创建备忘录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.put('/api/memos/:memoId', async (req, res) => {
  try {
    const { memoId } = req.params;
    const { isDone } = req.body;
    
    await Memo.findByIdAndUpdate(memoId, { isDone });
    res.json({ success: true });
  } catch (error) {
    console.error('更新备忘录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

app.delete('/api/memos/:memoId', async (req, res) => {
  try {
    const { memoId } = req.params;
    await Memo.findByIdAndDelete(memoId);
    res.json({ success: true });
  } catch (error) {
    console.error('删除备忘录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新提醒设置
app.put('/api/users/:userId/reminder', async (req, res) => {
  try {
    const { userId } = req.params;
    const { dailyPush, pushTime, email } = req.body;
    
    await User.findByIdAndUpdate(userId, {
      'reminderSettings.dailyPush': dailyPush,
      'reminderSettings.pushTime': pushTime,
      'reminderSettings.email': email
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('更新提醒设置失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建订单（付费）
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, type } = req.body;
    
    const prices = { month: 9.9, year: 69, report: 19.9 };
    const amount = prices[type];
    
    const order = new Order({
      userId,
      type,
      amount,
      status: 'pending'
    });
    
    await order.save();
    
    res.json({
      success: true,
      order: {
        id: order._id,
        type,
        amount
      }
    });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 支付回调（模拟）
app.post('/api/orders/:orderId/pay', async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }
    
    // 更新订单状态
    order.status = 'paid';
    order.paidAt = new Date();
    await order.save();
    
    // 更新用户VIP
    const user = await User.findById(order.userId);
    const now = new Date();
    
    if (order.type === 'month') {
      user.vipLevel = 1;
      user.vipExpireAt = new Date(now.setMonth(now.getMonth() + 1));
    } else if (order.type === 'year') {
      user.vipLevel = 2;
      user.vipExpireAt = new Date(now.setFullYear(now.getFullYear() + 1));
    }
    
    await user.save();
    
    res.json({ success: true });
  } catch (error) {
    console.error('支付失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除用户数据
app.delete('/api/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    await User.findByIdAndDelete(userId);
    await Checkin.deleteMany({ userId });
    await Like.deleteMany({ userId });
    await Memo.deleteMany({ userId });
    await Order.deleteMany({ userId });
    
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
