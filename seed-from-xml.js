// seed-from-xml.js
require("dotenv").config();
const fs = require("fs/promises");
const xml2js = require("xml2js");
const mongoose = require("mongoose");
const Product = require("./models/product.model"); // ваша модель

// 1) Функция для парсинга xml в JS-объект
async function parseXmlFile(path) {
  const xml = await fs.readFile(path, "utf8");
  return xml2js.parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });
}

async function run() {
  // 2) Подключаемся к Mongo
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // 3) Парсим оба файла
  const catalogData = await parseXmlFile("./data/catalog.xml"); // ваш файл с <Товар>
  const offersData = await parseXmlFile("./data/offers.xml"); // ваш файл с <Предложение>

  // 4) Извлекаем списки
  const items = catalogData.КоммерческаяИнформация.Каталог.Товары.Товар; // может быть массив или единичный объект
  const offers =
    offersData.КоммерческаяИнформация.ПакетПредложений.Предложения.Предложение;

  // Приводим к массивам
  const productsArr = Array.isArray(items) ? items : [items];
  const offersArr = Array.isArray(offers) ? offers : [offers];

  // 5) Собираем словарь предложений по id
  const offerMap = {};
  for (const o of offersArr) {
    offerMap[o.Ид] = o;
  }

  // 6) Маппим и «пришиваем» цену/количество из offerMap
  const merged = productsArr.map((p) => {
    const o = offerMap[p.Ид] || {};
    // достаём цену
    let price = null;
    if (o.Цены && o.Цены.Цена && o.Цены.Цена.ЦенаЗаЕдиницу) {
      price = parseFloat(o.Цены.Цена.ЦенаЗаЕдиницу);
    }
    return {
      externalId: p.Ид,
      name: p.Наименование,
      unit: p.БазоваяЕдиница._, // текст внутри тега
      unitCode: p.БазоваяЕдиница.Код, // атрибут
      groupId: Array.isArray(p.Группы.Ид) ? p.Группы.Ид[0] : p.Группы.Ид,
      // пример извлечения из реквизитов
      fullName: p.ЗначенияРеквизитов.ЗначениеРеквизита.find(
        (r) => r.Наименование === "Полное наименование"
      )?.Значение,
      weight:
        +p.ЗначенияРеквизитов.ЗначениеРеквизита.find(
          (r) => r.Наименование === "Вес"
        )?.Значение || 0,
      price: price,
      currency: o.Цены?.Цена?.Валюта ?? null,
      quantity: o.Количество ? parseFloat(o.Количество) : null,
    };
  });

  // 7) Очищаем старые документы и вставляем новые
  await Product.deleteMany({});
  await Product.insertMany(merged);

  console.log(`Inserted ${merged.length} products`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
