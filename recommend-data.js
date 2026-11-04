// Curated recommendations for the four built-in modules, checked by hand on 2026-11-04: every link was opened and the
// creator, book or paper confirmed (Bilibili and Douban search, YouTube and Goodreads pages, Crossref for DOIs).
// Picked for wide reach and reliability; follower counts, ratings and citations change, so none are shown.
// Creators and books differ by region (cn: Bilibili, Douban; global: YouTube, Goodreads). Papers are shared unless
// they carry a region. "guide" marks an authoritative guideline or report rather than a research paper.
export const CURATED = {
  coding: {
    creators: {
      cn: [
        { name: '黑马程序员', url: 'https://space.bilibili.com/37974444', zh: '传智教育官方账号，Java、Python、前端等完整入门课程。', en: 'Official channel of Itcast: full beginner courses in Java, Python and web front end.' },
        { name: '尚硅谷', url: 'https://space.bilibili.com/302417610', zh: '尚硅谷官方账号，后端、大数据、前端的系统视频教程。', en: 'Official Atguigu channel: structured video courses on back end, big data and front end.' },
      ],
      global: [
        { name: 'CS50', url: 'https://www.youtube.com/@cs50', zh: '哈佛大学计算机导论公开课，从零讲到编程思维。', en: 'Harvard\'s introduction to computer science, from zero to thinking like a programmer.' },
        { name: 'freeCodeCamp.org', url: 'https://www.youtube.com/@freecodecamp', zh: '免费的长篇完整课程，覆盖几乎所有主流语言和框架。', en: 'Free full-length courses covering nearly every mainstream language and framework.' },
      ],
    },
    books: {
      cn: [
        { name: '《Python编程：从入门到实践（第3版）》', url: 'https://book.douban.com/subject/36365320/', zh: '最常被推荐的 Python 入门书，边讲边做项目。', en: 'The most often recommended Python starter, built around small projects.' },
        { name: '《深入理解计算机系统（第3版）》', url: 'https://book.douban.com/subject/26912767/', zh: '经典 CSAPP，从程序员视角理解计算机如何运行代码。', en: 'The classic CS:APP: how a computer runs your code, seen by a programmer.' },
      ],
      global: [
        { name: 'The Pragmatic Programmer', url: 'https://www.goodreads.com/book/show/4099', zh: '关于如何做一名务实程序员的经典建议集。', en: 'Classic, practical advice on the craft of programming.' },
        { name: 'Clean Code', url: 'https://www.goodreads.com/book/show/3735293', zh: '如何写出清晰、易读、易维护的代码。', en: 'How to write code that is clear, readable and easy to maintain.' },
      ],
    },
    papers: [
      { name: 'Attention Is All You Need (2017)', url: 'https://arxiv.org/abs/1706.03762', zh: '提出 Transformer，现代大语言模型的起点。', en: 'Introduced the Transformer, the starting point of today\'s large language models.' },
      { name: 'No Silver Bullet (Brooks, 1987)', url: 'https://doi.org/10.1109/MC.1987.1663532', zh: '软件工程名篇：为什么没有让开发效率倍增的"银弹"。', en: 'Software engineering classic on why no single technique multiplies productivity.' },
      { name: 'Go To Statement Considered Harmful (Dijkstra, 1968)', url: 'https://doi.org/10.1145/362929.362947', zh: '推动结构化编程的经典短文。', en: 'The short letter that pushed programming toward structured code.' },
    ],
  },
  english: {
    creators: {
      cn: [
        { name: '英语兔', url: 'https://space.bilibili.com/483162496', zh: 'B 站知名英语 UP 主，用动画把语法和发音讲清楚。', en: 'A leading Bilibili English channel that explains grammar and pronunciation with animation.' },
        { name: '外研社英语学习', url: 'https://space.bilibili.com/382669549', zh: '外语教学与研究出版社官方账号，教材讲解和学习方法。', en: 'Official channel of the Foreign Language Teaching and Research Press: textbook lessons and study methods.' },
      ],
      global: [
        { name: 'BBC Learning English', url: 'https://www.youtube.com/@bbclearningenglish', zh: 'BBC 官方英语教学频道，语法、词汇、新闻英语。', en: 'BBC\'s official English channel: grammar, vocabulary and English through the news.' },
        { name: 'English with Lucy', url: 'https://www.youtube.com/@EnglishwithLucy', zh: '英式英语发音、口语和词汇。', en: 'British English pronunciation, speaking and vocabulary.' },
      ],
    },
    books: {
      cn: [
        { name: '《剑桥中级英语语法》', url: 'https://book.douban.com/subject/1232201/', zh: 'English Grammar in Use 外研社版，语法自学首选。', en: 'The FLTRP edition of English Grammar in Use, the standard self-study grammar.' },
        { name: 'Word Power Made Easy', url: 'https://book.douban.com/subject/1756614/', zh: '用词根词缀系统扩充词汇的经典书。', en: 'The classic for building vocabulary through roots and affixes.' },
      ],
      global: [
        { name: 'English Grammar in Use', url: 'https://www.goodreads.com/book/show/1623567', zh: 'Raymond Murphy 的经典语法自学书。', en: 'Raymond Murphy\'s classic self-study grammar.' },
        { name: 'Word Power Made Easy', url: 'https://www.goodreads.com/book/show/827597', zh: '用词根词缀系统扩充词汇的经典书。', en: 'The classic for building vocabulary through roots and affixes.' },
      ],
    },
    papers: [
      { name: 'How Large a Vocabulary Is Needed for Reading and Listening? (Nation, 2006)', url: 'https://doi.org/10.3138/cmlr.63.1.59', zh: '读懂和听懂英语分别需要多少词汇量。', en: 'How many words you need to read and to listen in English.' },
      { name: 'Distributed Practice in Verbal Recall Tasks (Cepeda et al., 2006)', url: 'https://doi.org/10.1037/0033-2909.132.3.354', zh: '间隔复习效果的大型综述，也是知回复习方式的依据。', en: 'Major review of spaced practice, the basis of how 知回 schedules reviews.' },
      { name: 'Principles and Practice in Second Language Acquisition (Krashen)', url: 'https://www.sdkrashen.com/content/books/principles_and_practice.pdf', zh: '"可理解输入"理论的原著，作者官网免费提供。', en: 'The original "comprehensible input" theory, free on the author\'s site.' },
    ],
  },
  work: {
    creators: {
      cn: [
        { name: '小Lin说', url: 'https://space.bilibili.com/520819684', zh: 'B 站百大 UP 主，把经济、金融和商业讲得通俗易懂。', en: 'A Bilibili top-100 creator who makes economics, finance and business easy to follow.' },
        { name: 'Excel自学成才', url: 'https://space.bilibili.com/431886272', zh: '实用 Excel 技巧，适合办公自学。', en: 'Practical Excel techniques for teaching yourself office skills.' },
      ],
      global: [
        { name: 'Harvard Business Review', url: 'https://www.youtube.com/@harvardbusinessreview', zh: '哈佛商业评论官方频道，管理、沟通与职业发展。', en: 'HBR\'s official channel on management, communication and careers.' },
        { name: 'Ali Abdaal', url: 'https://www.youtube.com/@aliabdaal', zh: '效率、学习方法和工作习惯。', en: 'Productivity, study methods and work habits.' },
      ],
    },
    books: {
      cn: [
        { name: '《金字塔原理》', url: 'https://book.douban.com/subject/33391219/', zh: '麦肯锡经典：先说结论，再分层论证。', en: 'The McKinsey classic: lead with the answer, then support it in layers.' },
        { name: '《高效能人士的七个习惯》', url: 'https://book.douban.com/subject/5325618/', zh: '影响最广的个人效能经典之一。', en: 'One of the most widely read classics on personal effectiveness.' },
      ],
      global: [
        { name: 'Deep Work', url: 'https://www.goodreads.com/book/show/25744928', zh: '在分心的环境里如何专注地做重要的事。', en: 'How to focus on what matters in a distracted world.' },
        { name: 'The 7 Habits of Highly Effective People', url: 'https://www.goodreads.com/book/show/36072', zh: '影响最广的个人效能经典之一。', en: 'One of the most widely read classics on personal effectiveness.' },
      ],
    },
    papers: [
      { name: 'Psychological Safety and Learning Behavior in Work Teams (Edmondson, 1999)', url: 'https://doi.org/10.2307/2666999', zh: '"心理安全感"概念的奠基论文，团队管理必读。', en: 'The founding paper on psychological safety, essential for team leadership.' },
      { name: 'Managing Oneself (Drucker, HBR)', url: 'https://hbr.org/2005/01/managing-oneself', zh: '德鲁克经典文章：认识自己的长处与工作方式。', en: 'Drucker\'s classic on knowing your strengths and how you work.' },
      { name: 'Google re:Work', url: 'https://rework.withgoogle.com/', kind: 'guide', zh: 'Google 公开的团队与管理研究和实践指南（含 Project Aristotle）。', en: 'Google\'s published research and guides on teams and management, including Project Aristotle.' },
    ],
  },
  life: {
    creators: {
      cn: [
        { name: '老爸评测', url: 'https://space.bilibili.com/347667464', zh: 'B 站百大 UP 主，送检实测日用品的安全和真假宣传。', en: 'A Bilibili top-100 creator who lab-tests everyday products for safety and false claims.' },
        { name: '丁香医生', url: 'https://space.bilibili.com/15982391', zh: '专业医学团队做的健康科普。', en: 'Health explainers by a professional medical team.' },
      ],
      global: [
        { name: 'Kurzgesagt – In a Nutshell', url: 'https://www.youtube.com/@kurzgesagt', zh: '用动画讲科学和身边的问题，资料来源公开。', en: 'Animated science explainers with published sources.' },
        { name: 'Andrew Huberman', url: 'https://www.youtube.com/@hubermanlab', zh: '斯坦福神经科学家谈睡眠、运动和健康习惯。', en: 'A Stanford neuroscientist on sleep, exercise and health habits.' },
      ],
    },
    books: {
      cn: [
        { name: '《我们为什么要睡觉？》', url: 'https://book.douban.com/subject/35332778/', zh: '睡眠科学家写给大众的睡眠指南。', en: 'A sleep scientist\'s guide to sleep for general readers.' },
        { name: '《小狗钱钱》', url: 'https://book.douban.com/subject/35295592/', zh: '高评分的理财入门书，讲储蓄和投资的基本道理。', en: 'A highly rated first book on money: saving and investing basics.' },
      ],
      global: [
        { name: 'Atomic Habits', url: 'https://www.goodreads.com/book/show/40121378', zh: '用微小的改变建立好习惯。', en: 'Building good habits through tiny changes.' },
        { name: 'The Psychology of Money', url: 'https://www.goodreads.com/book/show/41881472', zh: '关于金钱和理财决策的心理学。', en: 'The psychology behind money and financial decisions.' },
      ],
    },
    papers: [
      { name: '中国居民膳食指南（2022）', url: 'http://dg.cnsoc.org/', kind: 'guide', region: 'cn', zh: '中国营养学会发布的官方膳食指南。', en: 'The official dietary guidelines from the Chinese Nutrition Society.' },
      { name: 'Dietary Guidelines for Americans', url: 'https://www.dietaryguidelines.gov/', kind: 'guide', region: 'global', zh: '美国农业部和卫生部发布的膳食指南。', en: 'The dietary guidelines published by the US Departments of Agriculture and Health.' },
      { name: 'WHO Guidelines on Physical Activity and Sedentary Behaviour (2020)', url: 'https://www.who.int/publications/i/item/9789240015128', kind: 'guide', zh: '世界卫生组织：各年龄段每周该运动多少。', en: 'The WHO on how much activity each age group needs per week.' },
      { name: 'Sleep Time Duration Recommendations (Hirshkowitz et al., 2015)', url: 'https://doi.org/10.1016/j.sleh.2014.12.010', zh: '美国国家睡眠基金会：各年龄段推荐睡眠时长。', en: 'National Sleep Foundation recommendations on sleep duration by age.' },
    ],
  },
};
// Items of one kind for a module and region; papers without a region apply everywhere.
export function curatedItems(moduleId, kind, region) {
  const group = CURATED[moduleId]?.[kind];
  if (!group) return [];
  return Array.isArray(group) ? group.filter(item => !item.region || item.region === region) : group[region] || [];
}
