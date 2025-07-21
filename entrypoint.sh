#!/bin/sh

# Если в /app/data есть XML-файлы, запускаем seed
if ls /app/data/*.xml 1> /dev/null 2>&1; then
  echo "[entrypoint] Найдены XML-файлы — запускаем seed-скрипт"
  npm run seed-xml
  echo "[entrypoint] Seed завершён"
else
  echo "[entrypoint] XML-файлы не найдены — пропускаем seed"
fi

# Затем запускаем основную команду контейнера
exec "$@"