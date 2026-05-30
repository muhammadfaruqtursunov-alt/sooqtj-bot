// Infer a fine-grained category from a product name (Russian keywords).
// Used by ClientPage catalog grouping and AdminPage manual-order picker.

const RULES = [
  [/чайник|kettle/,                           '☕ Чайники'],
  [/кофе|coffee|капсул/,                       '☕ Кофемашины'],
  [/миксер|mixer/,                             '🥣 Миксеры'],
  [/блендер|blender/,                          '🥤 Блендеры'],
  [/мясорубк|grinder/,                         '🥩 Мясорубки'],
  [/соковыжим|juicer|сокодав/,                 '🍹 Соковыжималки'],
  [/тостер|toaster|сэндвич/,                   '🍞 Тостеры'],
  [/мультиварк|multicook|пароварк|скороварк/,  '🍲 Мультиварки'],
  [/микровол|microwave/,                       '⚡ Микроволновки'],
  [/духов|oven|плит|варочн/,                   '🔥 Плиты и духовки'],
  [/холодильник|fridge/,                       '❄️ Холодильники'],
  [/стиральн|wash/,                            '👕 Стиральные машины'],
  [/посудомо|dishwash/,                        '🍽 Посудомойки'],
  [/пылесос|vacuum/,                           '🧹 Пылесосы'],
  [/утюг|iron|отпариват/,                      '👔 Утюги и отпариватели'],
  [/фен|стайлер|выпрям|плойк|щипц/,            '💇 Фены и стайлеры'],
  [/бритв|триммер|эпилят|epilat/,              '🪒 Бритвы и триммеры'],
  [/весы|scale/,                               '⚖️ Весы'],
  [/телевизор|tv\b|televiz/,                   '📺 Телевизоры'],
  [/наушник|headphone|airpod|earphone/,        '🎧 Наушники'],
  [/колонк|speaker|акустик/,                   '🔊 Колонки'],
  [/телефон|phone|смартфон/,                   '📱 Телефоны'],
  [/часы|watch|smartwatch/,                    '⌚ Часы'],
  [/планшет|tablet|ipad/,                      '📲 Планшеты'],
  [/ноутбук|laptop|notebook/,                  '💻 Ноутбуки'],
  [/вентилятор|fan\b/,                         '🌀 Вентиляторы'],
  [/обогрев|heater|конвектор/,                 '🔥 Обогреватели'],
  [/кондицион|conditioner|сплит/,              '❄️ Кондиционеры'],
  [/увлажн|humidif|очистител/,                 '💧 Увлажнители и очистители'],
]

export function inferCategory(p) {
  const name = String(
    p['Название (RU)'] || p['Название'] || p.name || p['col2'] || ''
  ).toLowerCase()
  for (const [re, label] of RULES) {
    if (re.test(name)) return label
  }
  const explicit = String(p['Категория'] || p.category || p['col3'] || '').trim()
  return explicit || 'Прочее'
}
