// seed-from-xml.js
require("dotenv").config();
const fs = require("fs/promises");
const xml2js = require("xml2js");
const mongoose = require("mongoose");
const Product = require("./models/product.model"); // наша модель с полями image и description

// Функция для парсинга XML в JS-объект
async function parseXmlFile(path) {
  const xml = await fs.readFile(path, "utf8");
  return xml2js.parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });
}

async function run() {
  // Подключаемся к MongoDB
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  // Парсим XML-файлы
  const catalogData = await parseXmlFile("./data/import.xml");
  const offersData = await parseXmlFile("./data/offers.xml");

  // Собираем список ID свойств категории из классификатора
  const propsDefs =
    catalogData.КоммерческаяИнформация.Классификатор.Свойства.Свойство;
  const propsArr = Array.isArray(propsDefs) ? propsDefs : [propsDefs];
  const categoryPropIds = propsArr
    .filter((def) => def.Наименование === "Категория")
    .map((def) => def.Ид);

  // Извлекаем массивы товаров и предложений
  const itemsNode = catalogData.КоммерческаяИнформация.Каталог.Товары.Товар;
  const offersNode =
    offersData.КоммерческаяИнформация.ПакетПредложений.Предложения.Предложение;
  const productsArr = Array.isArray(itemsNode) ? itemsNode : [itemsNode];
  const offersArr = Array.isArray(offersNode) ? offersNode : [offersNode];

  // Собираем карту предложений по Ид
  const offerMap = {};
  offersArr.forEach((o) => {
    offerMap[o.Ид] = o;
  });

  // Маппим и формируем конечные объекты
  const merged = productsArr.map((p) => {
    const o = offerMap[p.Ид] || {};
    // Цена
    const price = o.Цены?.Цена?.ЦенаЗаЕдиницу
      ? parseFloat(o.Цены.Цена.ЦенаЗаЕдиницу)
      : 0;
    // Количество
    const quantity = o.Количество ? parseFloat(o.Количество) : 0;
    // Описание из тега <Описание>
    const description =
      p.Описание ||
      p.ЗначенияРеквизитов.ЗначениеРеквизита.find(
        (r) => r.Наименование === "Полное наименование"
      )?.Значение ||
      "";
    // Путь к картинке
    const image =
      p.Картинка ||
      p.ЗначенияРеквизитов.ЗначениеРеквизита.find(
        (r) => r.Наименование === "ОписаниеФайла"
      )?.Значение ||
      null;

    let category = null;
    const vals = p.ЗначенияСвойств?.ЗначенияСвойства;
    if (vals) {
      const valsArr = Array.isArray(vals) ? vals : [vals];
      const catVal = valsArr.find(
        (v) => categoryPropIds.includes(v.Ид) && v.Значение
      );
      if (catVal && catVal.Значение) {
        category = catVal.Значение;
      }
    }

    return {
      externalId: p.Ид,
      name: p.Наименование,
      fullName: p.Наименование,
      description,
      unit: p.БазоваяЕдиница._,
      unitCode: p.БазоваяЕдиница.Код,
      groupId: Array.isArray(p.Группы.Ид) ? p.Группы.Ид[0] : p.Группы.Ид,
      weight: parseFloat(
        p.ЗначенияРеквизитов.ЗначениеРеквизита.find(
          (r) => r.Наименование === "Вес"
        )?.Значение || 0
      ),
      price,
      currency: o.Цены?.Цена?.Валюта || null,
      quantity,
      image,
      category,
    };
  });

  // Очищаем и вставляем
  await Product.deleteMany({});
  await Product.insertMany(merged);

  console.log(`Inserted ${merged.length} products with description and image`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
