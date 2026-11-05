// Simplified → Traditional Chinese (Taiwan usage) for 知回's interface text. Phrases first (Taiwan vocabulary and
// characters whose Traditional form depends on the word), then a character table covering every character the source
// text uses. Extend both when new text adds characters; tests/i18n-catalogs.test.js flags any simplified character left.
const PHRASES = [
  ['登录', '登入'], ['设置', '設定'], ['信息', '資訊'], ['视频', '影片'], ['默认', '預設'], ['文件', '檔案'], ['数据', '資料'],
  ['用户', '使用者'], ['网络', '網路'], ['链接', '連結'], ['程序', '程式'], ['支持', '支援'], ['创建', '建立'], ['项目', '專案'],
  ['账号', '帳號'], ['粘贴', '貼上'], ['日历', '日曆'], ['制作', '製作'], ['生成', '產生'], ['汇总', '彙總'], ['关系', '關係'],
  ['复习', '複習'], ['复制', '複製'], ['重复', '重複'], ['复杂', '複雜'], ['回复', '回覆'], ['答复', '答覆'], ['恢复', '恢復'],
  ['周日', '週日'], ['每周', '每週'], ['本周', '本週'], ['一周', '一週'], ['这周', '這週'], ['上周', '上週'],
  ['剩余', '剩餘'], ['其余', '其餘'], ['质量', '品質'], ['视图', '檢視'], ['屏幕', '螢幕'], ['手机号', '手機號碼'], ['注册', '註冊'], ['特征', '特徵'],
  ['反馈', '回饋'], ['点赞', '按讚'], ['调试', '除錯'], ['打印', '列印'],
];
const PAIRS = '济濟评評谈談闻聞课課团團队隊践踐沟溝职職医醫环環综綜办辦软軟银銀扩擴农農卫衛养養钱錢决決构構组組织織帮幫学學状狀况況于於听聽属屬并並户戶万萬与與业業丢丟两兩个個为為么麼义義习習书書云雲亚亞产產仅僅从從们們价價会會传傳体體余餘储儲儿兒兴興关關内內册冊写寫冻凍准準几幾凭憑击擊划劃则則刚剛创創删刪别別务務动動励勵区區单單历歷压壓参參双雙发發变變号號后後吗嗎启啟员員响響围圍国國图圖圆圓场場坏壞块塊坚堅声聲处處备備复復实實对對导導将將层層岁歲巩鞏带帶广廣库庫应應弃棄异異开開张張弹彈当當录錄忆憶态態总總惯慣担擔护護择擇损損换換据據摄攝数數断斷无無旧舊时時显顯晕暈暂暫术術机機权權条條来來标標样樣检檢档檔欢歡汇匯没沒浅淺测測浏瀏满滿温溫湾灣滚滾点點炼煉独獨现現电電画畫盖蓋盘盤码碼础礎确確种種积積称稱笔筆筛篩简簡类類粘黏约約级級线線练練细細经經结結给給络絡绝絕统統继繼续續维維编編缩縮网網联聯脑腦节節范範荐薦获獲营營虚虛补補装裝见見观觀视視览覽计計认認讨討让讓议議记記讲講许許论論设設访訪证證识識词詞试試话話该該详詳语語误誤说說请請读讀调調谨謹谱譜财財败敗账帳购購贴貼费費资資车車转轉轮輪载載较較辑輯输輸辞辭边邊达達过過运運还還这這进進连連适適选選逻邏遗遺邮郵释釋里裡钟鐘钥鑰钮鈕铺鋪链鏈销銷错錯键鍵长長门門闭閉问問间間阶階际際陆陸随隨隐隱韩韓页頁顶頂项項须須顾顧预預领領频頻颗顆题題额額风風飞飛马馬验驗骤驟麦麥黄黃齐齊';
// Added with the learning square, and characters earlier text used that the table above missed.
const MORE_PAIRS = '举舉报報栏欄侧側头頭东東阅閱执執赶趕饭飯凉涼顺順涂塗晒曬险險彻徹热熱厕廁协協轻輕伤傷饰飾灾災减減饮飲优優龙龍规規洁潔质質绍紹缓緩撑撐叠疊离離译譯纪紀负負责責扰擾墙牆紧緊谢謝净淨阴陰气氣拟擬递遞归歸宾賓赞讚馈饋冲沖';
const MAP = new Map();
for (const pairs of [PAIRS, MORE_PAIRS]) for (let i = 0; i < pairs.length; i += 2) MAP.set(pairs[i], pairs[i + 1]);
export function toTraditional(text) {
  let out = text;
  for (const [from, to] of PHRASES) out = out.replaceAll(from, to);
  return [...out].map(char => MAP.get(char) ?? char).join('');
}
export const SIMPLIFIED_CHARS = new Set(MAP.keys());
