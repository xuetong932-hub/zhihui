// Starter content for new users: suggested questions for every module and level, and an optional pack of six
// beginner cards per built-in module, written for 知回 (marked as such; not model output). Each text is a
// ['中文', 'English'] pair; other interface languages come from the catalogs (i18n/<code>.js), so every language
// shows only its own text. Example sentences in the English module stay in English. Adding a pack is always the user's choice.
import { PRESET_MODULES } from './modules.js';
import { pick, translate } from './i18n.js';
export const STARTER_PREFIX = 'starter-';
export const isStarterCard = card => typeof card?.id === 'string' && card.id.startsWith(STARTER_PREFIX);

const QUESTIONS = {
  coding: {
    beginner: [
      ['变量是什么？', 'What is a variable?'],
      ['函数为什么能让代码更简洁？', 'Why do functions make code simpler?'],
      ['什么是循环？举个生活中的例子', 'What is a loop? Give an everyday example'],
      ['编程语言和我们说的话有什么不同？', 'How is a programming language different from everyday language?'],
    ],
    some: [
      ['什么是作用域？', 'What is scope?'],
      ['同步和异步有什么区别？', 'What is the difference between synchronous and asynchronous code?'],
      ['什么是递归？什么时候适合用？', 'What is recursion, and when is it useful?'],
      ['Git 的分支有什么用？', 'What are Git branches for?'],
    ],
    advanced: [
      ['闭包是如何保存变量的？', 'How does a closure keep its variables?'],
      ['时间复杂度 O(n log n) 是什么意思？', 'What does O(n log n) time complexity mean?'],
      ['进程和线程有什么区别？', 'What is the difference between a process and a thread?'],
      ['如何设计一个可扩展的缓存？', 'How would you design a scalable cache?'],
    ],
  },
  english: {
    beginner: [
      ['一般现在时什么时候用？', 'When do I use the present simple?'],
      ['a 和 an 怎么区分？', 'How do I choose between a and an?'],
      ['怎样用英语做简单的自我介绍？', 'How do I introduce myself in English?'],
      ['可数名词和不可数名词有什么区别？', 'What is the difference between countable and uncountable nouns?'],
    ],
    some: [
      ['现在完成时和一般过去时有什么区别？', 'What is the difference between the present perfect and the past simple?'],
      ['定语从句里 that 和 which 怎么选？', 'Should I use that or which in a relative clause?'],
      ['被动语态什么时候用？', 'When should I use the passive voice?'],
      ['怎样提高英语听力？', 'How can I improve my listening?'],
    ],
    advanced: [
      ['虚拟语气有哪几种情况？', 'What are the main uses of the subjunctive?'],
      ['英语写作中怎样让句子更简洁？', 'How can I make my English sentences more concise?'],
      ['动名词和不定式作宾语有什么区别？', 'When does a verb take a gerund or an infinitive?'],
      ['学术英语和日常英语有什么差别？', 'How is academic English different from everyday English?'],
    ],
  },
  work: {
    beginner: [
      ['怎样写一封清楚的工作邮件？', 'How do I write a clear work email?'],
      ['什么是 STAR 法则？', 'What is the STAR method?'],
      ['会议纪要应该记哪些内容？', 'What should meeting notes include?'],
      ['怎么给手上的工作排优先级？', 'How do I prioritise my tasks?'],
    ],
    some: [
      ['SMART 目标怎么制定？', 'How do I set SMART goals?'],
      ['怎样做一次清楚的工作汇报？', 'How do I give a clear progress report?'],
      ['如何向上级提出不同意见？', 'How can I disagree with my manager respectfully?'],
      ['OKR 是什么？', 'What are OKRs?'],
    ],
    advanced: [
      ['怎样评估一个项目的投入和产出？', 'How do I judge whether a project is worth the cost?'],
      ['如何推动跨部门合作的项目？', 'How do I drive a project across teams?'],
      ['怎样做一次有效的复盘？', 'How do I run a useful retrospective?'],
      ['如何建立个人的知识管理体系？', 'How do I build a personal knowledge system?'],
    ],
  },
  life: {
    beginner: [
      ['冷冻肉怎么解冻更安全？', 'What is the safest way to thaw frozen meat?'],
      ['轻微烫伤后第一时间该怎么做？', 'What should I do right after a minor burn?'],
      ['剩饭剩菜应该怎么保存？', 'How should I store leftovers?'],
      ['防晒霜上的 SPF 和 PA 是什么意思？', 'What do SPF and PA mean on sunscreen?'],
    ],
    some: [
      ['怎样判断食物是否变质？', 'How can I tell if food has gone bad?'],
      ['家里用电有哪些常见的安全隐患？', 'What are common electrical hazards at home?'],
      ['怎样制定家庭每月预算？', 'How do I make a monthly household budget?'],
      ['怎样养成规律的作息？', 'How can I build a regular sleep routine?'],
    ],
    advanced: [
      ['复利是怎样让存款增长的？', 'How does compound interest grow savings?'],
      ['如何看懂食品配料表？', 'How do I read a food ingredient list?'],
      ['租房合同要注意哪些条款？', 'What should I check in a rental contract?'],
      ['怎样合理安排运动和休息？', 'How should I balance exercise and rest?'],
    ],
  },
};
const CUSTOM = (name, locale) => [
  translate('{name}里最基础的概念是什么？', 'What are the most basic ideas in {name}?', { name }, locale), translate('学习{name}应该从哪里开始？', 'Where should I start learning {name}?', { name }, locale),
  translate('{name}有哪些常见的误区？', 'What are common mistakes in {name}?', { name }, locale), translate('能举一个{name}在生活中的例子吗？', 'Can you give an everyday example of {name}?', { name }, locale),
];
// English example sentences are not translated: Chinese interfaces show them with a Chinese note, all others in English.
const fixed = (zh, en, zhTW = zh) => ({ fixed: { zh, en, 'zh-TW': zhTW } });
const inLocale = (item, locale) => item.fixed ? item.fixed[locale] ?? item.fixed.en : translate(item[0], item[1], undefined, locale);
// Four suggested questions for a module at the user's level; custom modules get questions built from their name.
export function starterQuestions(module, level, locale, moduleName = '') {
  const list = QUESTIONS[module]?.[level] || QUESTIONS[module]?.beginner;
  if (list) return list.map(item => inLocale(item, locale));
  return CUSTOM(moduleName || translate('这个领域', 'this subject', undefined, locale), locale);
}

const card = (title, category, summary, example) => ({ title, category, summary, example });
const CARDS = {
  coding: [
    card(['变量', 'Variables'], ['基础概念', 'Basics'],
      ['变量是给一份数据起的名字。程序通过这个名字读取和修改数据，数据变了，名字不变。', 'A variable is a name for a piece of data. The program reads and changes the data through that name; the data changes, the name stays.'],
      ['把购物车的总价存进 total，每加一件商品就更新 total。', 'Keep the cart total in total and update it whenever an item is added.']),
    card(['函数', 'Functions'], ['基础概念', 'Basics'],
      ['函数把完成某件事的一段代码打包并命名，调用时传入参数、得到结果，避免重复写同样的代码。', 'A function packages code that does one job under a name. You call it with arguments and get a result, instead of repeating the same code.'],
      ['写一个“计算折扣价”的函数，所有商品都调用它。', 'Write one “discounted price” function and use it for every product.']),
    card(['条件判断', 'Conditions'], ['基础概念', 'Basics'],
      ['条件判断（if）根据条件是否成立，选择执行不同的代码。', 'A condition (if) runs different code depending on whether something is true.'],
      ['如果余额不足就提示充值，否则完成支付。', 'If the balance is too low, ask to top up; otherwise complete the payment.']),
    card(['循环', 'Loops'], ['基础概念', 'Basics'],
      ['循环让同一段代码按次数或按条件重复执行，直到满足停止条件。', 'A loop repeats the same code a number of times, or until a stop condition is met.'],
      ['给名单里的每位同学各发一条通知。', 'Send a notice to every student on the list.']),
    card(['数组（列表）', 'Arrays (lists)'], ['数据结构', 'Data structures'],
      ['数组按顺序存放多个数据，可以用位置（下标）取出其中一项；很多语言的下标从 0 开始。', 'An array stores several values in order; you get one by its position (index). In many languages the first index is 0.'],
      ['一周七天的气温放进一个数组，第一天是下标 0。', 'Store a week of temperatures in an array; the first day is index 0.']),
    card(['Bug 与调试', 'Bugs and debugging'], ['编程习惯', 'Good habits'],
      ['Bug 是让程序结果不符合预期的错误。调试就是通过阅读报错、打印中间结果等方法找到原因并修正。', 'A bug is a mistake that makes a program behave unexpectedly. Debugging means finding the cause, for example by reading errors and printing values, and fixing it.'],
      ['总价算错时，逐件打印商品价格，找出是哪一步出错。', 'When the total is wrong, print each item’s price to find the faulty step.']),
  ],
  english: [
    card(['一般现在时', 'Present simple'], ['时态', 'Tenses'],
      ['表示习惯、经常发生的动作或客观事实。主语是第三人称单数时，动词一般加 -s 或 -es。', 'Used for habits, repeated actions and facts. With he, she or it, the verb usually adds -s or -es.'],
      ['She drinks coffee every morning.', 'She drinks coffee every morning.']),
    card(['一般过去时', 'Past simple'], ['时态', 'Tenses'],
      ['表示过去某个时间发生并已经结束的动作，常和 yesterday、last week 等连用；规则动词加 -ed。', 'Used for finished actions at a past time, often with yesterday or last week. Regular verbs add -ed.'],
      ['I visited my grandma last weekend.', 'I visited my grandma last weekend.']),
    card(['现在完成时', 'Present perfect'], ['时态', 'Tenses'],
      ['结构是 have/has + 过去分词，强调过去的动作对现在的影响，或一直持续到现在。', 'have/has + past participle. It links a past action to now, or describes something continuing up to now.'],
      fixed('I have lost my key.（钥匙现在还没找到）', 'I have lost my key. (I still can’t find it.)', 'I have lost my key.（鑰匙現在還沒找到）')),
    card(['可数与不可数名词', 'Countable and uncountable nouns'], ['名词', 'Nouns'],
      ['可数名词有单复数（an apple, two apples）；不可数名词没有复数形式，常用 some、much 修饰。', 'Countable nouns have singular and plural forms (an apple, two apples). Uncountable nouns have no plural and often take some or much.'],
      fixed('some water，a glass of water，而不是 a water。', 'some water, a glass of water — not a water.')),
    card(['冠词 a / an / the', 'Articles: a / an / the'], ['冠词', 'Articles'],
      ['a / an 用于第一次提到的、泛指的单数可数名词，元音音素前用 an；the 用于双方都知道的特指事物。', 'Use a/an for a singular countable noun mentioned for the first time or in general; an before a vowel sound. Use the for something both people know about.'],
      ['I saw a dog. The dog was very friendly.', 'I saw a dog. The dog was very friendly.']),
    card(['时间介词 at / on / in', 'Time prepositions: at / on / in'], ['介词', 'Prepositions'],
      ['at 用于具体时刻，on 用于具体某一天，in 用于月份、年份、季节等较长的时间。', 'Use at for exact times, on for days and dates, and in for months, years and seasons.'],
      fixed('at 7 o’clock，on Monday，in May。', 'at 7 o’clock, on Monday, in May.')),
  ],
  work: [
    card(['STAR 法则', 'The STAR method'], ['表达沟通', 'Communication'],
      ['用情境（Situation）、任务（Task）、行动（Action）、结果（Result）四步讲清一段经历，常用于面试和汇报。', 'Explain an experience in four steps: Situation, Task, Action, Result. Useful in interviews and reports.'],
      ['讲一次赶工项目：当时的情况、你的任务、你做了什么、最后的结果。', 'A rushed project: the situation, your task, what you did, and the outcome.']),
    card(['SMART 目标', 'SMART goals'], ['目标管理', 'Goals'],
      ['好的目标应当具体、可衡量、可实现、与工作相关、有截止时间。', 'A good goal is specific, measurable, achievable, relevant and time-bound.'],
      ['“本季度把客户回复时间缩短到 24 小时内”比“提升服务”更清楚。', '“Reply to customers within 24 hours this quarter” is clearer than “improve service”.']),
    card(['重要紧急四象限', 'Urgent–important matrix'], ['时间管理', 'Time management'],
      ['按“重要”和“紧急”两个维度把任务分成四类：优先做重要且紧急的，给重要但不紧急的预留时间。', 'Sort tasks by importance and urgency: do important and urgent tasks first, and schedule time for important but not urgent ones.'],
      ['准备下个月的考核属于重要不紧急，可以提前分几天完成。', 'Preparing next month’s review is important but not urgent; spread it over a few days.']),
    card(['番茄工作法', 'Pomodoro technique'], ['时间管理', 'Time management'],
      ['专注 25 分钟、休息 5 分钟为一个番茄，四个番茄后休息更长时间，用来减少拖延和分心。', 'Focus for 25 minutes, then rest for 5; after four rounds take a longer break. It helps with procrastination and distraction.'],
      ['写报告时开一个番茄钟，期间不看消息。', 'Start a pomodoro while writing a report and ignore messages until it ends.']),
    card(['会议纪要三要素', 'Three parts of meeting notes'], ['协作', 'Collaboration'],
      ['会议纪要至少写清结论、负责人和截止时间，并在会后尽快发给相关的人。', 'Meeting notes should record the decision, the owner and the deadline, and be sent to everyone involved soon after.'],
      ['“周五前由小王提交方案初稿。”', '“Wang will send the first draft by Friday.”']),
    card(['结论先行', 'Lead with the conclusion'], ['表达沟通', 'Communication'],
      ['汇报时先说结论，再给支撑理由；理由之间分类清楚、互不重叠。', 'In a report, state the conclusion first, then the supporting reasons, grouped clearly without overlap.'],
      ['先说“建议采用方案 B”，再列出三点原因。', 'Start with “I recommend option B”, then give three reasons.']),
  ],
  life: [
    card(['冷藏解冻更安全', 'Thaw meat in the fridge'], ['饮食安全', 'Food safety'],
      ['冷冻肉放进冷藏室慢慢解冻，温度一直较低，能减少细菌繁殖；长时间放在室温下，表面容易滋生细菌。', 'Thawing frozen meat in the fridge keeps it cold the whole time, which limits bacteria. Leaving it out at room temperature lets bacteria grow on the surface.'],
      ['前一晚把第二天要吃的肉从冷冻室移到冷藏室。', 'Move tomorrow’s meat from the freezer to the fridge the night before.']),
    card(['轻微烫伤先冲凉水', 'Cool a minor burn with water'], ['急救常识', 'First aid'],
      ['轻微、小面积的烫伤，立即用流动的凉水冲 15～20 分钟降温；不要涂牙膏、酱油。烫伤严重时及时就医。', 'For a small, minor burn, run cool water over it for 15–20 minutes. Do not apply toothpaste or soy sauce. See a doctor for serious burns.'],
      ['被热水溅到手背，马上到水龙头下冲凉水。', 'Hot water splashes your hand: hold it under the cold tap right away.']),
    card(['剩饭剩菜尽快冷藏', 'Refrigerate leftovers soon'], ['饮食安全', 'Food safety'],
      ['剩菜在室温下放久了，细菌会快速繁殖，一般建议在两小时内放进冰箱冷藏，吃前彻底加热。', 'Bacteria grow quickly in food left at room temperature. Refrigerate leftovers within about two hours and reheat them thoroughly.'],
      ['晚饭后稍微晾凉，就把剩菜分装放进冰箱。', 'After dinner, let leftovers cool briefly, then put them in the fridge.']),
    card(['正确洗手', 'Washing hands properly'], ['健康习惯', 'Healthy habits'],
      ['用肥皂或洗手液搓洗至少 20 秒，手心、手背、指缝、指尖都要洗到，再用流动水冲净。', 'Rub with soap for at least 20 seconds, covering palms, backs, between fingers and fingertips, then rinse under running water.'],
      ['饭前、如厕后、回家后都要洗手。', 'Before eating, after the toilet and when you get home.']),
    card(['插线板不要过载', 'Don’t overload power strips'], ['用电安全', 'Electrical safety'],
      ['电暖器、电水壶等大功率电器不要同时插在同一个插线板上，电流过大可能让插线板发热，甚至引起火灾。', 'Don’t plug several high-power appliances such as heaters and kettles into one power strip; too much current can overheat it and even cause a fire.'],
      ['冬天电暖器单独插在墙上的插座上。', 'Plug the heater straight into a wall socket.']),
    card(['防晒的 SPF 和 PA', 'SPF and PA on sunscreen'], ['健康习惯', 'Healthy habits'],
      ['SPF 表示防护中波紫外线（UVB，主要导致晒伤）的能力，PA 表示防护长波紫外线（UVA，主要导致晒黑和老化）的能力；阴天也有紫外线。', 'SPF shows protection against UVB (mainly sunburn); PA shows protection against UVA (mainly tanning and skin ageing). UV rays get through clouds too.'],
      ['户外活动前涂防晒，并按说明补涂。', 'Apply sunscreen before going out and reapply as directed.']),
  ],
};
export const hasStarterPack = module => PRESET_MODULES.includes(module);
// Cards ready to add to the library: ids are fixed per module and position, so a pack is never added twice.
export function starterCards(module, locale, now = new Date()) {
  const list = CARDS[module] || [], at = now.toISOString();
  return list.map((item, i) => ({ id: `${STARTER_PREFIX}${module}-${i + 1}`, module, title: inLocale(item.title, locale), summary: inLocale(item.summary, locale), category: inLocale(item.category, locale), example: inLocale(item.example, locale),
    createdAt: at, updatedAt: at, status: 'active', extraction: 'ready', important: false, reason: '', origins: [] }));
}

const esc = value => String(value).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);
// The "starter card pack" panel shown on the home page and in an empty library. modules: [{id, name}] still to add.
// After adding, it offers to practise straight away (extra practice, so no card dates are changed).
// dismissible: the home page offers "以后再说", which hides the panel there for good (the empty library still shows it).
export function starterPackPanel({ modules, locale, added = 0, dismissible = false }) {
  if (added) return `<section class="panel starter-pack"><span class="eyebrow">${pick('入门卡片包', 'Starter cards')}</span><h3>${pick('已添加 {added} 张入门卡片', '{added} starter cards added', { added })}</h3><p>${pick('现在就可以练一练；之后它们会和你自己的卡片一样，按时安排复习。', 'Practise them now; after that they are scheduled like your own cards.')}</p><button class="primary-button" data-starter-practise>${pick('现在练一练', 'Practise now')} →</button></section>`;
  if (!modules.length) return '';
  return `<section class="panel starter-pack"><span class="eyebrow">${pick('入门卡片包', 'Starter cards')}</span><h3>${pick('先领取入门卡片，马上体验复习', 'Add starter cards and try a review now')}</h3><p>${pick('每个模块 6 张由知回编写的基础知识卡片，不调用模型。添加后可以随时修改或删除。', 'Six basic cards per module, written for KnowBack; no model needed. Edit or delete them any time.')}</p>
    <div class="starter-pack-modules">${modules.map(item => `<button class="secondary-button" data-starter-add="${esc(item.id)}">＋ ${esc(item.name)}</button>`).join('')}${modules.length > 1 ? `<button class="primary-button" data-starter-add="all">${pick('全部添加', 'Add all')}</button>` : ''}</div>
    ${dismissible ? `<button class="text-button starter-dismiss" data-starter-dismiss>${pick('以后再说', 'Not now')}</button>` : ''}</section>`;
}
