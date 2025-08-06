#!/bin/bash

echo "🔍 Поиск неиспользуемых файлов в проекте..."
echo "================================================"

# Список файлов, которые всегда считаются используемыми (точки входа, страницы, index.js)
EXCLUDED_FILES=(
    "src/main.js"
    "src/App.vue"
    "src/app/layout.vue"
    "src/app/router.js"
    "src/pages/*.vue"
    "src/features/*/index.js"
    "src/shared/index.js"
)

# Создаем временный файл для исключений
echo "" > excluded_patterns.txt
for pattern in "${EXCLUDED_FILES[@]}"; do
    echo "$pattern" >> excluded_patterns.txt
done

# Функция для проверки, является ли файл исключением
is_excluded() {
    local file="$1"
    while IFS= read -r pattern; do
        if [[ "$file" == $pattern ]]; then
            return 0  # Исключен
        fi
    done < excluded_patterns.txt
    return 1  # Не исключен
}

# Проверяем каждый файл
echo "Проверяем файлы на использование..."
echo ""

DEAD_FILES=()
TOTAL_FILES=0

while IFS= read -r file; do
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    # Пропускаем исключенные файлы
    if is_excluded "$file"; then
        echo "✅ $file (исключен - точка входа/страница/index.js)"
        continue
    fi
    
    # Получаем имя файла без расширения для поиска импортов
    filename=$(basename "$file")
    name_without_ext="${filename%.*}"
    
    # Ищем импорты этого файла во всех .js и .vue файлах
    if grep -r --include="*.js" --include="*.vue" --include="*.ts" -l "$name_without_ext" src/ > /dev/null 2>&1; then
        echo "✅ $file (используется)"
    else
        echo "❌ $file (НЕ ИСПОЛЬЗУЕТСЯ!)"
        DEAD_FILES+=("$file")
    fi
done < all_files.txt

echo ""
echo "================================================"
echo "📊 РЕЗУЛЬТАТЫ АНАЛИЗА:"
echo "================================================"
echo "Всего файлов: $TOTAL_FILES"
echo "Неиспользуемых файлов: ${#DEAD_FILES[@]}"

if [ ${#DEAD_FILES[@]} -gt 0 ]; then
    echo ""
    echo "🚨 НАЙДЕНЫ НЕИСПОЛЬЗУЕМЫЕ ФАЙЛЫ:"
    echo "================================================"
    for file in "${DEAD_FILES[@]}"; do
        echo "  - $file"
    done
    echo ""
    echo "💡 РЕКОМЕНДАЦИИ:"
    echo "  - Проверьте эти файлы перед удалением"
    echo "  - Возможно, они используются динамически"
    echo "  - Или являются заготовками для будущего функционала"
else
    echo ""
    echo "🎉 Все файлы используются! Мертвых файлов не найдено."
fi

# Очистка
rm -f all_files.txt excluded_patterns.txt 