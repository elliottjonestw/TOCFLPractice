import { bulkReadingQuestions } from './bulkQuestions';

export type TocflLevel = 'A' | 'B' | 'C';
export type TestMode = 'reading' | 'listening';

export type Visual =
  | { kind: 'image'; src: string; alt: string; caption?: string }
  | { kind: 'scene'; emoji: string; label: string; detail?: string }
  | { kind: 'notice'; eyebrow?: string; title: string; body: string; footer?: string }
  | { kind: 'table'; title: string; columns: string[]; rows: string[][] };

export type Option = { id: string; text: string; visual?: Visual };
export type QuestionType =
  | 'single-choice'
  | 'cloze'
  | 'reading-comprehension'
  | 'image-choice'
  | 'picture-description'
  | 'picture-cloze'
  | 'word-bank-cloze'
  | 'sentence-insertion';

export type QuestionGroup = {
  id: string;
  title: string;
  passage?: string;
  visual?: Visual;
};

/**
 * Authoring template
 *
 * - Use `visual` for a picture, notice, table, or an image URL.
 * - Use `groupId` to attach several questions to one shared passage or visual.
 * - Use `blanks` + an answer map only for `word-bank-cloze`. Each selected
 *   option is automatically unavailable for the other blanks.
 * - Listening will use the same model with mode: 'listening' and audio below.
 */
export type Question = {
  id: string;
  mode: TestMode;
  level: TocflLevel;
  type: QuestionType;
  section: string;
  prompt: string;
  passage?: string;
  visual?: Visual;
  groupId?: string;
  blanks?: string[];
  insertionSentence?: string;
  options: Option[];
  answer: string | Record<string, string>;
  explanation: string;
  audio?: { src: string; transcript?: string };
};

const starterReadingGroups: QuestionGroup[] = [
  {
    id: 'b-market-notice',
    title: '閱讀材料（一）',
    visual: {
      kind: 'notice',
      eyebrow: '綠生活超市',
      title: '水果不包裝，生活更環保！',
      body: '為減少塑膠垃圾，本店不再提供水果袋和盒子。請先把水果放進籃子，交給店員秤重；確認價格貼紙後，再到櫃檯結帳。',
      footer: '沒有價格貼紙，不能結帳。',
    },
  },
  {
    id: 'b-housing-table',
    title: '閱讀材料（二）',
    visual: {
      kind: 'table',
      title: '三國社會住宅簡表',
      columns: ['國家', '社會住宅占比', '主要規劃單位'],
      rows: [['甲國', '8%', '地方政府'], ['乙國', '6%', '中央政府'], ['丙國', '9%', '地方政府']],
    },
  },
];

const starterReadingQuestions: Question[] = [
  // Band A: visual question formats
  {
    id: 'a-01', mode: 'reading', level: 'A', type: 'image-choice', section: '看句子選圖片',
    prompt: '小王和朋友們一起在游泳池游泳。',
    options: [
      { id: 'A', text: '圖 A', visual: { kind: 'image', src: '/images/questions/chef-kitchen.png', alt: '一位廚師正在餐廳廚房做飯' } },
      { id: 'B', text: '圖 B', visual: { kind: 'image', src: '/images/questions/friends-swimming.png', alt: '三位朋友在游泳池游泳' } },
      { id: 'C', text: '圖 C', visual: { kind: 'image', src: '/images/questions/bus-stop.png', alt: '一位乘客在公車站等公車' } },
    ],
    answer: 'B', explanation: '句子說大家在游泳池游泳，所以應選游泳池的圖片。',
  },
  {
    id: 'a-02', mode: 'reading', level: 'A', type: 'picture-description', section: '看圖片選句子',
    prompt: '請選出最符合圖片內容的句子。',
    visual: { kind: 'image', src: '/images/questions/chinese-class.png', alt: '老師在教室裡上課，三位學生在聽' },
    options: [{ id: 'A', text: '教室裡有三位學生。' }, { id: 'B', text: '學生正在踢足球。' }, { id: 'C', text: '老師在餐廳做飯。' }],
    answer: 'A', explanation: '圖中是老師和三位學生在教室裡。',
  },
  {
    id: 'a-03', mode: 'reading', level: 'A', type: 'picture-cloze', section: '看圖選詞',
    groupId: 'a-restaurant-scene',
    prompt: '張先生 ______ 她吃法國菜。',
    visual: { kind: 'image', src: '/images/questions/restaurant-dinner.png', alt: '一位客人在餐廳請朋友吃飯' },
    options: [{ id: 'A', text: '請' }, { id: 'B', text: '送' }, { id: 'C', text: '買' }],
    answer: 'A', explanation: '「請某人吃飯」是邀請、招待別人吃飯。',
  },
  {
    id: 'a-04', mode: 'reading', level: 'A', type: 'word-bank-cloze', section: '選詞填空',
    prompt: '請用下方選項完成短文。每一個選項只能用一次。',
    passage: '我的室友跟我一樣大，__1__。因為我們都喜歡旅行，所以去年我們 __2__。那裡的天氣不冷也不熱，__3__。旅行的時候，我們照了 __4__。暑假快到了，我們正在想 __5__！',
    blanks: ['__1__', '__2__', '__3__', '__4__', '__5__'],
    options: [
      { id: 'A', text: '可是常常下雪' }, { id: 'B', text: '都是二十歲' },
      { id: 'C', text: '很多照片' }, { id: 'D', text: '也不常下雨' },
      { id: 'E', text: '這次要去哪裡玩' }, { id: 'F', text: '一起去歐洲玩' },
    ],
    answer: { '__1__': 'B', '__2__': 'F', '__3__': 'D', '__4__': 'C', '__5__': 'E' },
    explanation: '每個空格要依上下文配對，且六個選項只能各使用一次。',
  },
  {
    id: 'a-05', mode: 'reading', level: 'A', type: 'reading-comprehension', section: '短文理解',
    prompt: '根據通知，中文課是什麼時候？',
    passage: '通知：明天上午的中文課改到下午兩點，在三樓教室上課。',
    options: [{ id: 'A', text: '上午十點' }, { id: 'B', text: '下午兩點' }, { id: 'C', text: '下午三點' }],
    answer: 'B', explanation: '通知說課程改到下午兩點。',
  },

  // Band B: grouped text and visual material
  {
    id: 'b-01', mode: 'reading', level: 'B', type: 'cloze', section: '選詞填空',
    prompt: '請選出最適合填入空格的詞。',
    passage: '這家咖啡店不但環境安靜，__1__ 每天下午都有新鮮的麵包出爐，因此附近的學生很喜歡來這裡讀書。',
    options: [{ id: 'A', text: '雖然' }, { id: 'B', text: '而且' }, { id: 'C', text: '或者' }, { id: 'D', text: '所以' }],
    answer: 'B', explanation: '「不但……而且……」用來連接兩項優點。',
  },
  {
    id: 'b-02', mode: 'reading', level: 'B', type: 'reading-comprehension', section: '圖表／公告閱讀', groupId: 'b-market-notice',
    prompt: '這家超市取消水果包裝的目的是什麼？',
    options: [{ id: 'A', text: '維持水果的新鮮度' }, { id: 'B', text: '方便客人自助選購' }, { id: 'C', text: '降低成本' }, { id: 'D', text: '減少塑膠垃圾' }],
    answer: 'D', explanation: '公告第一句說明目的是減少塑膠垃圾。',
  },
  {
    id: 'b-03', mode: 'reading', level: 'B', type: 'reading-comprehension', section: '圖表／公告閱讀', groupId: 'b-market-notice',
    prompt: '根據公告，買水果時要怎麼做？',
    options: [{ id: 'A', text: '自己秤重後直接結帳' }, { id: 'B', text: '先把水果交給店員秤重' }, { id: 'C', text: '選盒裝水果' }, { id: 'D', text: '先拿塑膠袋' }],
    answer: 'B', explanation: '公告指示顧客先把水果放進籃子，再交給店員秤重。',
  },
  {
    id: 'b-04', mode: 'reading', level: 'B', type: 'reading-comprehension', section: '表格閱讀', groupId: 'b-housing-table',
    prompt: '根據這張表，三個國家的共同點是什麼？',
    options: [{ id: 'A', text: '占比都不到百分之十' }, { id: 'B', text: '都由中央政府規劃' }, { id: 'C', text: '占比完全相同' }, { id: 'D', text: '都由地方政府規劃' }],
    answer: 'A', explanation: '三個國家的社會住宅占比分別是 8%、6%、9%。',
  },
  {
    id: 'b-05', mode: 'reading', level: 'B', type: 'reading-comprehension', section: '閱讀理解',
    prompt: '根據這篇短文，下列哪一項正確？',
    passage: '為了減少一次性杯子的使用，市立圖書館從下個月開始不再提供紙杯。館內設有飲水機，讀者可以自備水瓶。忘記帶水瓶的人，也能向服務台借用可重複使用的杯子。',
    options: [{ id: 'A', text: '圖書館會停止提供飲水。' }, { id: 'B', text: '讀者必須買水瓶。' }, { id: 'C', text: '讀者可以借用重複使用的杯子。' }, { id: 'D', text: '紙杯只能在服務台使用。' }],
    answer: 'C', explanation: '最後一句明確說明可向服務台借用杯子。',
  },

  // Band C: advanced passage and insertion formats
  {
    id: 'c-01', mode: 'reading', level: 'C', type: 'cloze', section: '篇章結構',
    prompt: '請選出最適合填入空格的詞。',
    passage: '許多人將遠端工作視為提升效率的萬靈丹；__1__，彈性的工作地點也可能模糊了休息與工作的界線。',
    options: [{ id: 'A', text: '換言之' }, { id: 'B', text: '不過' }, { id: 'C', text: '因此' }, { id: 'D', text: '此外' }],
    answer: 'B', explanation: '後句提出相反觀點，應使用轉折語「不過」。',
  },
  {
    id: 'c-02', mode: 'reading', level: 'C', type: 'sentence-insertion', section: '句子插入',
    prompt: '請選出最適合插入這個句子的位置。',
    insertionSentence: '年輕人以為手裡的包包越貴、腳下的鞋越頂級，越能彰顯自己的個性。',
    passage: '早期時尚的開端，始自金字塔尖端的消費者。設計師為上流社會設計服裝。I 到了五、六十年代，街頭文化創造了新的時代風格。\n\n可惜，那樣充滿叛逆的時代已然遠去。反觀現在的年輕族群，穿搭的主軸不是來自原創，而是向奢華靠攏。II 殊不知他們的價值觀和創造力已被精品名牌吞噬。III 人在年輕時期總有許多稀奇古怪的想法。IV 下次看到青少年穿著怪異的服裝，請不要制止。',
    options: [{ id: 'I', text: '位置 I' }, { id: 'II', text: '位置 II' }, { id: 'III', text: '位置 III' }, { id: 'IV', text: '位置 IV' }],
    answer: 'II', explanation: '插入句延續「向奢華靠攏」的說法，接著才是對精品名牌的批評。',
  },
  {
    id: 'c-03', mode: 'reading', level: 'C', type: 'reading-comprehension', section: '閱讀理解',
    prompt: '作者對「資料公開」的主要看法是什麼？',
    passage: '公共資料的開放常被理解為透明治理的同義詞，但資料是否真正可用，取決於它是否有足夠脈絡。若沒有清楚的蒐集方法、更新頻率與限制說明，再龐大的資料集也可能導向草率的結論。公開本身並非終點，而是讓公眾得以追問與檢驗的起點。',
    options: [{ id: 'A', text: '資料規模比說明重要。' }, { id: 'B', text: '政府不應公開原始資料。' }, { id: 'C', text: '資料公開需有脈絡，才能支持檢驗。' }, { id: 'D', text: '公開資料能避免所有錯誤。' }],
    answer: 'C', explanation: '文章強調脈絡與說明，讓公開成為檢驗的起點。',
  },
];

export const levelDetails: Record<TocflLevel, { name: string; label: string; description: string }> = {
  A: { name: 'Band A', label: '入門・基礎', description: '看圖、短文、選詞與生活情境' },
  B: { name: 'Band B', label: '進階・高階', description: '選詞填空、公告、圖表與篇章閱讀' },
  C: { name: 'Band C', label: '流利・精通', description: '篇章結構、句子插入與深度理解' },
};

// The starter records above document every supported format. The active bank is
// deliberately kept in a separate data file so the 300 questions stay editable.
export const readingGroups: QuestionGroup[] = starterReadingGroups;
export const readingQuestions: Question[] = bulkReadingQuestions;
