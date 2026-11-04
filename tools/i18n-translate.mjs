// Fills i18n/<code>.js with machine translations of i18n/source.json, using the free 智谱 GLM-4-Flash model.
// Only missing entries are sent. Each result must keep the same {placeholders}, HTML tags and the name 知回, or it is
// retried and finally left out (the app then shows English for it). Translations still need a native speaker's review.
// The key comes from ZHIPU_API_KEY or the gitignored server.local.json and is never printed.
// Usage: node tools/i18n-translate.mjs <code> [<code>...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toTraditional } from './zh-hant.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const LANGS = {
  'zh-TW': '繁體中文（台灣用語，例如「軟體」「資訊」「影片」）', ja: '日本語（です・ます調、アプリのUIとして自然に）', ko: '한국어（해요체/합니다체, 앱 UI로 자연스럽게）',
  ms: 'Bahasa Melayu (Malaysia)', es: 'español (neutro, tú)', fr: 'français (vous)', pt: 'português do Brasil (você)', de: 'Deutsch (du)',
};
const key = process.env.ZHIPU_API_KEY || (() => { try { return JSON.parse(readFileSync(root + 'server.local.json', 'utf8')).ZHIPU_API_KEY; } catch { return ''; } })();
if (!key) { console.error('No ZHIPU_API_KEY.'); process.exit(1); }
const source = JSON.parse(readFileSync(root + 'i18n/source.json', 'utf8'));
const placeholders = text => (text.match(/\{\w+\}/g) || []).sort().join();
const tags = text => (text.match(/<\/?[a-z][a-z0-9]*/gi) || []).sort().join();
// Characters that exist only in Simplified Chinese: a Traditional or Japanese result containing them was copied from the
// Chinese source instead of translated.
const SIMPLIFIED = /[们这来国说时会对过发问学习复图识网页关现进还开见长门间实点题记设语读认话让应给经没确选择请数据录类样边钮载链调务库谱导维态览账号码统证错误输准从个为与么么头动机现点产业东两两临丽举义乐书买乱争亏亚产亲亿仅从仓们优伙会伤伦伪体佣侠侧侦俩债倾储儿兑兰关兴养兽内册写军农冯冲决况冻净凉减凑凤处凭击凿刘则刚创删别刮制刹刽剂剑剧劝办务动劳势勋区医华协单卖卢卫却厂厅历压厌厕厘厢厨县叁参双发变叙叠叫叹吓吗启吴呐员呜咏响哑唤啰啸喷嘱团园围图圆圣场坏块坚坛坝坟坠垒垦垫墙壮声壳处备复够头夸夹夺奋奖妆妇妈妩姗姜娄娇娱婴孙学宁宝实宠审宪宫宽宾对寻导寿将尔尘尝层岁岂岗岛岭峡币师帐帘带帮库应庙庞废开异弃张弥弯归当录彻径忆忧怀态怜总恋恒恳恶恼悦惊惩惫惯愤愿戏战户扑执扩扫扬扰抚抛抢护报担拟拥拦择挂挡挣挤挥损捡换据掷搁搂摄摆摇撑数斋断无旧时旷显晋晒晓暂术机杀杂权条来杨极构枪柜标栏树样桥档梦检楼横欢欧歼毁毕气汇汉汤沟沪泪泽洁洒浅测济浏浓涂涛润涨渐温湾湿满滚滞灭灯灵灾灿炉点炼烂烦烧热焕爱爷牵牺状犹狭独狮猎献环现玛琐电画畅疗疟疮疯痒症瘫皱盏盐监盘睁矫矿码砖础硕确碍礼祸离种积称稳穷窃窍竞笔笼筑签简粮紧纠红纤约级纪纯纲纳纵纷纸纹纺线练组细织终绍经绑绕绘给络绝统继绩绪续维绵综绿缓编缘缩缴网罗罚罢职联聪肃肠肤肿胀胁胆胜胶脏脑脚脸腊舍舰艰艺节芦苏苹范荐荣药莱获营萧著蓝虑虚虫虽蚀蛮衅补衬袜装见观规视览觉触誉计订认讨让训议讯记讲许论设访证评识诉词译试诗诚话询该详语误说请诸诺读课谁调谅谈谋谓谢谨谱贝负贡财责贤败货质贩贪贫购贯贴贵贷费贸贺赏赖赚赛赠赢赶趋跃践踪轨轮软轻载较辅辆辈辉输辩边辽达迁过迈还进远违连迟适选逊递逻遗邮郁邻郑释针钉钓钟钢钥钱钻铁铃铜铭银铺链销锁锅错锤键镇镜长门闪闭问闯闲间闷闹闻阀阅队阳阴阵阶际陆陈险随隐隶难雾霁静韩页顶项顺须顾顿预领频题颜额风飘飞饥饭饮饰饱饿馆驱驳驶驾骂骑验骗骤鱼鲜鸟鸡鸣鸭鹅黄齐齿龙]/;
// Japanese shares many simplified-looking kanji (学 会 来 点 数), so it is checked only against characters Japanese never uses.
const SIMPLIFIED_ONLY_CN = /[复们这说时对过发问习复图识网页关现进还开见门间题记设语读认话让给经没确选择请据录类样边钮载链调务库谱导维态览账码统证错误输从个为么头动产业东两书买亲优伤侧储兴养决况净减处击则刚创删别剂剑剧劝办劳势华协单卖卫厅历压县变启员响团园围圆圣场坏块坚备够奖妇孙宁实审宪宾寻导层岁岛币师帐带帮库应废张归录彻忆总恶惊战扩扫扬拟拥换摄无显术杀杂权极构标栏树档梦检欢毕气汉泽洁测济浓涂渐满灭灵灾烦烧热爱环现电疗盐监盘矿码础确离种积稳竞笔简粮紧红约级纪纯纳纵纸练组细织终绍经绘给络绝统继续维绿缓编缘网罗职肠脑艺节药获营蓝虑补观规视览觉计订认讨让训议讯记讲许论设访证评识诉词译试诗诚话询该详语误说请诸读课谁调谈谢谱贝负贡财责贤败货质购贯贴贵费贸贺赏赛赢趋跃践轮软轻载较辅辆输边达过进远违连迟适选递逻遗邮释针钟钢钱铁银链销锁错键镇镜闭闻阅队阳阴阶际陆险隐难雾顶项顺须顾预领频颜额风飞饭馆驾验鱼鸟齐龙]/;
const HAN = /[㐀-鿿]/g;
const scriptOk = (code, zh, out) => {
  const text = out.replaceAll('知回', '');
  if (code === 'ko') return !/[\u3400-\u9fff]/.test(text);
  if (code === 'zh-TW') return !SIMPLIFIED.test(text);
  // Traditional-only forms Japanese never uses (日本語 has 説 数 体 対 会 国 学 図 処 伝 instead).
  if (code === 'ja' && /[們這說與數據體對從會來國學讓關應實當點邊雙聽讀觀寫雖經絕繼續聯腦營虛裝覽證譯轉遲釋錢鐵閱險隱驗齊擔擇圖團處傳變歡覺價舊號劃壓廣戰斷樣檢歷滿獨畫稱穩總聲藝觸]/.test(text)) return false;
  if (code === 'ja') return !(text === zh && /[\u3400-\u9fff]{3,}/.test(zh.replaceAll('知回', ''))) && !(text === zh && SIMPLIFIED.test(zh)) && !SIMPLIFIED_ONLY_CN.test(text);
  return !/[㐀-鿿]/.test(text);
};
const valid = (en, out, code) => typeof out === 'string' && out.trim() && placeholders(en) === placeholders(out) && tags(en) === tags(out) && (!en.includes('知回') || out.includes('知回')) && scriptOk(code, source[en], out);
const readCatalog = code => { const file = `${root}i18n/${code}.js`; if (!existsSync(file)) return {}; return JSON.parse(readFileSync(file, 'utf8').replace(/^[\s\S]*?export default /, '').replace(/;\s*$/, '')); };
const writeCatalog = (code, table) => {
  const sorted = Object.fromEntries(Object.keys(source).filter(en => code === 'zh-TW' ? en in table : valid(en, table[en], code)).map(en => [en, table[en]]));
  writeFileSync(`${root}i18n/${code}.js`, `// ${code} interface text, keyed by the English source (i18n/source.json). Machine-translated; review by a native speaker.\nexport default ${JSON.stringify(sorted, null, 1)};\n`);
};
async function ask(code, batch) {
  const items = batch.map(([en, zh], i) => ({ i, en, zh }));
  const system = `You translate the interface of 知回 (Knowledge Review), a learning app: ask AI questions, answers become knowledge cards, spaced review (FSRS).
Translate each item's English "en" into ${LANGS[code]}. The Chinese "zh" is the original wording, for meaning only: never copy it, always write in the target language and script.
Rules: keep every {placeholder} from "en" exactly, with the same names (they may differ from "zh"); keep HTML tags, attributes, URLs and line breaks; keep the product name 知回 unchanged; keep brand names (Google, Apple, Supabase, DeepSeek, Qwen, Bilibili, YouTube, Word, Markdown, JSON, PNG, FSRS) unchanged; keep it short like UI text; no explanations.
Reply with one JSON object only: {"0": "...", "1": "...", ...} using the item numbers.`;
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'glm-4-flash-250414', temperature: 0.2, max_tokens: 4096, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(items) }] }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const text = (await response.json()).choices?.[0]?.message?.content || '';
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
}
// Traditional Chinese comes from the Chinese source through a character table, not the model (which keeps simplified
// characters). Placeholder names follow the English text, matched by order when the Chinese uses different names.
function traditional() {
  const table = {};
  for (const [en, zh] of Object.entries(source)) {
    const names = zh.match(/\{\w+\}/g) || [], target = en.match(/\{\w+\}/g) || [];
    let text = toTraditional(zh);
    if (names.join() !== target.join() && names.length === target.length) { let k = 0; text = text.replace(/\{\w+\}/g, () => target[k++]); }
    table[en] = text;
  }
  writeCatalog('zh-TW', table);
  console.log(`zh-TW: ${Object.keys(table).length} converted from Chinese`);
}
for (const code of process.argv.slice(2)) {
  if (code === 'zh-TW') { traditional(); continue; }
  if (!LANGS[code]) { console.error(`Unknown language ${code}`); continue; }
  const table = readCatalog(code);
  for (let round = 0; round < 3; round++) {
    const missing = Object.entries(source).filter(([en]) => !valid(en, table[en], code));
    if (!missing.length) break;
    console.log(`${code} round ${round + 1}: ${missing.length} to translate`);
    const size = round === 0 ? 20 : 6;
    for (let i = 0; i < missing.length; i += size) {
      const batch = missing.slice(i, i + size);
      try {
        const out = await ask(code, batch);
        batch.forEach(([en], k) => { if (valid(en, out[k] ?? out[String(k)], code)) table[en] = out[k] ?? out[String(k)]; });
      } catch (error) { console.log(`  batch at ${i} failed: ${error.message}`); await new Promise(resolve => setTimeout(resolve, 3000)); }
      writeCatalog(code, table);
    }
  }
  const left = Object.keys(source).filter(en => !valid(en, table[en], code));
  console.log(`${code}: ${Object.keys(source).length - left.length}/${Object.keys(source).length} translated${left.length ? `, ${left.length} left in English` : ''}`);
}
