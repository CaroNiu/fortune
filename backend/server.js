const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// ==================== AI 运势知识缓存 ====================
const knowledgeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时缓存

// 智谱 API Key
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || 'e6b4f344fe7446c0af70e87803a01824.syp20SPK7tPx82ww';

// 调用智谱 AI 生成运势知识
async function generateAIKnowledge(theme, userBirthday, today, fortuneScore) {
  const cacheKey = `${theme}_${userBirthday}_${today}`;
  
  // 检查缓存
  if (knowledgeCache.has(cacheKey)) {
    const cached = knowledgeCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
  }
  
  const themes = {
    career: { name: '事业', chinese: '乾卦主事，官星高照', western: '第十宫官禄宫', emoji: '💼' },
    wealth: { name: '财运', chinese: '财星入库，禄马交驰', western: '第二宫财帛宫、第八宫偏财宫', emoji: '💰' },
    love: { name: '感情', chinese: '红鸾星动，桃花绽放', western: '第五宫恋爱宫、第七宫夫妻宫', emoji: '💕' },
    health: { name: '健康', chinese: '阴阳平衡，五行调和', western: '第六宫健康宫、第一宫命宫', emoji: '🏃' }
  };
  
  const t = themes[theme];
  
  const prompt = `你是一位精通中西方命理学的运势解读专家。请为用户生成今日${t.name}运势的深度解读。

用户信息：
- 生日：${userBirthday}
- 今日日期：${today}
- 今日${t.name}运势评分：${fortuneScore}/100

请严格按照以下 JSON 格式返回（不要返回 markdown 代码块，只返回纯 JSON）：
{
  "chinese": {
    "title": "中国传统命理角度的一句话标题（10字以内）",
    "concept": "相关概念（如易经卦象、五行、八字等）",
    "interpretation": "详细解读（100-150字，结合用户生日和今日运势）",
    "advice": "今日行动建议（3条，每条10字以内）"
  },
  "western": {
    "title": "西方占星角度的一句话标题（10字以内）",
    "concept": "相关概念（如星座、宫位、行星相位等）",
    "interpretation": "详细解读（100-150字，结合星座和今日运势）",
    "advice": "今日行动建议（3条，每条10字以内）"
  },
  "synthesis": "中西合璧总结（50字左右，给出最核心的建议）"
}

要求：
1. 内容要有深度，不能是泛泛而谈的套话
2. 中国传统命理要结合八字、五行、易经等专业概念
3. 西方占星要结合星座、宫位、行星运行等专业概念
4. 根据运势评分调整语气：高分要鼓励把握机会，低分要提醒谨慎行事
5. 所有建议要具体可操作，不能是"保持乐观"这种空话`;

  try {
    const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: '你是一位精通中西方命理学的运势解读专家，擅长将中国传统命理（八字、易经、五行）与西方占星（星座、宫位、行星）相结合，给出专业、有深度的运势分析。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    }, {
      headers: {
        'Authorization': `Bearer ${ZHIPU_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
    
    const content = response.data.choices[0].message.content;
    
    // 解析 JSON（处理可能存在的 markdown 代码块）
    let jsonStr = content;
    if (content.includes('```json')) {
      jsonStr = content.match(/```json\n?([\s\S]*?)```/)?.[1] || content;
    } else if (content.includes('```')) {
      jsonStr = content.match(/```\n?([\s\S]*?)```/)?.[1] || content;
    }
    
    const data = JSON.parse(jsonStr.trim());
    
    // 存入缓存
    knowledgeCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  } catch (error) {
    console.error('AI 调用失败:', error.message);
    // 返回默认内容
    return generateDefaultKnowledge(theme, fortuneScore);
  }
}

// 默认知识内容（AI 失败时使用）
function generateDefaultKnowledge(theme, score) {
  const defaults = {
    career: {
      chinese: { title: '官星高照', concept: '乾卦、官星', interpretation: '今日事业运势' + (score >= 80 ? '极佳，贵人相助，适合推进重要项目。' : score >= 60 ? '平稳，按部就班即可。' : '略显低迷，宜守不宜攻。'), advice: ['主动沟通', '整理计划', '避免冲突'] },
      western: { title: '第十宫闪耀', concept: '官禄宫、土星', interpretation: '从占星角度看，今日' + (score >= 80 ? '太阳照耀事业宫，领导力提升。' : score >= 60 ? '事业宫位平稳，适合日常事务。' : '事业宫受克，需谨慎决策。'), advice: ['展现能力', '团队协作', '把握时机'] },
      synthesis: score >= 80 ? '今日事业运旺，中西命理皆显示进取有利，把握机会。' : score >= 60 ? '事业平稳，宜稳中求进，不宜冒进。' : '事业低迷，保守为上，静待时机。'
    },
    wealth: {
      chinese: { title: '财星入库', concept: '正财、偏财', interpretation: '今日财运' + (score >= 80 ? '亨通，正财偏财皆旺。' : score >= 60 ? '平稳，小财可得。' : '不佳，守财为上。'), advice: ['理性消费', '把握投资', '量入为出'] },
      western: { title: '第二宫活跃', concept: '财帛宫、金星', interpretation: '财运宫位显示今日' + (score >= 80 ? '金星加持，财富机遇显现。' : score >= 60 ? '财运平稳，适合储蓄。' : '财务需谨慎，避免冲动消费。'), advice: ['稳健理财', '避免冒险', '开源节流'] },
      synthesis: score >= 80 ? '财运亨通，适合理财投资，但需保持理性。' : score >= 60 ? '财运平稳，宜储蓄不宜冒进。' : '财运低迷，保守理财，避免大额支出。'
    },
    love: {
      chinese: { title: '桃花绽放', concept: '红鸾、天喜', interpretation: '今日感情运' + (score >= 80 ? '极佳，单身者桃花旺，有伴者感情升温。' : score >= 60 ? '平稳，日常相处和谐。' : '波动，需多包容理解。'), advice: ['主动表达', '倾听对方', '制造惊喜'] },
      western: { title: '金星加持', concept: '第五宫、第七宫', interpretation: '爱情宫位显示今日' + (score >= 80 ? '金星能量强，魅力提升。' : score >= 60 ? '感情平稳，适合约会。' : '情绪波动，需多沟通。'), advice: ['展现魅力', '真诚沟通', '理解包容'] },
      synthesis: score >= 80 ? '感情运势高涨，主动表达心意会有好结果。' : score >= 60 ? '感情平稳，适合经营关系。' : '感情波动，多沟通少争执。'
    },
    health: {
      chinese: { title: '阴阳平衡', concept: '五行、经络', interpretation: '今日健康运' + (score >= 80 ? '良好，精力充沛，适合运动。' : score >= 60 ? '平稳，注意作息规律。' : '需注意，避免过度劳累。'), advice: ['规律作息', '适度运动', '饮食均衡'] },
      western: { title: '第六宫守护', concept: '健康宫、火星', interpretation: '健康宫位显示今日' + (score >= 80 ? '体能充沛，适合挑战。' : score >= 60 ? '状态平稳，保持健康习惯。' : '需注意休息，避免透支。'), advice: ['充足睡眠', '适度休息', '放松身心'] },
      synthesis: score >= 80 ? '健康状况良好，精力充沛，适合积极活动。' : score >= 60 ? '健康平稳，保持规律作息即可。' : '健康需关注，多休息少熬夜。'
    }
  };
  return defaults[theme];
}

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

// 获取 AI 运势知识
app.get('/api/knowledge/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { theme } = req.query; // career, wealth, love, health
    
    if (!['career', 'wealth', 'love', 'health'].includes(theme)) {
      return res.status(400).json({ error: '无效的运势主题' });
    }
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const fortune = calculateFortune(user.birthday, today);
    const score = fortune[theme];
    
    // 调用 AI 生成知识
    const knowledge = await generateAIKnowledge(theme, user.birthday, today, score);
    
    res.json({
      success: true,
      theme,
      score,
      knowledge
    });
  } catch (error) {
    console.error('获取运势知识失败:', error);
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
