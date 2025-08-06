<template>
  <div class="min-h-screen bg-gradient-to-br from-accent via-accent/80 to-secondary/20">
    <!-- Заголовок -->
    <header class="bg-primary/90 backdrop-blur-sm border-b border-secondary/20 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-3 py-3 sm:px-6 sm:py-4">
        <h1 class="text-lg sm:text-2xl font-bold text-accent">UI Kit v2 - Bento Design System</h1>
        <p class="text-accent/80 mt-1 text-sm sm:text-base">Демонстрация компонентов новой UI-системы</p>
      </div>
    </header>

    <main class="max-w-7xl mx-auto p-3 sm:p-6">
      <!-- Цветовая палитра -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🎨 Цветовая палитра</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard 
            v-for="color in colorPalette" 
            :key="color.name"
            size="1x1" 
            variant="minimal"
          >
            <div class="h-full flex flex-col">
              <div :class="color.bgClass" class="flex-1 rounded-lg mb-2 sm:mb-3 min-h-[40px] sm:min-h-[60px]"></div>
              <div class="text-center">
                <h4 class="font-medium text-primary text-xs sm:text-sm">{{ color.name }}</h4>
                <p class="text-xs text-secondary">{{ color.hex }}</p>
                <p class="text-xs text-secondary/70">{{ color.category }}</p>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Кнопки v2 -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🔘 Кнопки v2</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Варианты кнопок" size="2x1">
            <div class="space-y-3 sm:space-y-4">
                                    <div class="space-y-2">
                        <div class="flex flex-wrap gap-2 sm:gap-3">
                          <ButtonV2 variant="primary" size="sm">Primary</ButtonV2>
                          <ButtonV2 variant="secondary" size="sm">Secondary</ButtonV2>
                          <ButtonV2 variant="ghost" size="sm">Ghost</ButtonV2>
                          <ButtonV2 variant="minimal" size="sm">Minimal</ButtonV2>
                        </div>
                        <div class="flex flex-wrap gap-2 sm:gap-3">
                          <ButtonV2 variant="brand-red" size="sm">Brand Red</ButtonV2>
                          <ButtonV2 variant="brand-deep-red" size="sm">Brand Deep</ButtonV2>
                        </div>
                        <div class="flex flex-wrap gap-2 sm:gap-3">
                          <ButtonV2 variant="success" size="sm">Success</ButtonV2>
                          <ButtonV2 variant="warning" size="sm">Warning</ButtonV2>
                          <ButtonV2 variant="error" size="sm">Error</ButtonV2>
                        </div>
                      </div>
              <div class="flex flex-wrap gap-2 sm:gap-3">
                <ButtonV2 variant="primary" size="sm" loading>Loading</ButtonV2>
                <ButtonV2 variant="secondary" size="sm" disabled>Disabled</ButtonV2>
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Размеры кнопок" size="2x1">
            <div class="space-y-3 sm:space-y-4">
              <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                <ButtonV2 variant="primary" size="sm">Small</ButtonV2>
                <ButtonV2 variant="primary" size="md">Medium</ButtonV2>
                <ButtonV2 variant="primary" size="lg">Large</ButtonV2>
                <ButtonV2 variant="primary" size="xl">XL</ButtonV2>
              </div>
              <ButtonV2 variant="secondary" full-width size="md">Full Width Button</ButtonV2>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Поля ввода v2 -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">📝 Поля ввода v2</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Базовые поля" size="2x2">
            <div class="space-y-3 sm:space-y-4">
              <InputV2 
                v-model="inputValues.basic" 
                label="Базовое поле"
                placeholder="Введите текст..."
                size="sm"
              />
              <InputV2 
                v-model="inputValues.required" 
                label="Обязательное поле"
                placeholder="Введите текст..."
                required
                hint="Это поле обязательно для заполнения"
                size="sm"
              />
              <InputV2 
                v-model="inputValues.error" 
                label="Поле с ошибкой"
                placeholder="Введите текст..."
                error="Это сообщение об ошибке"
                size="sm"
              />
              <InputV2 
                v-model="inputValues.disabled" 
                label="Отключенное поле"
                placeholder="Это поле отключено"
                disabled
                size="sm"
              />
            </div>
          </BentoCard>

          <BentoCard title="Размеры полей" size="2x1">
            <div class="space-y-3 sm:space-y-4">
              <InputV2 
                v-model="inputValues.small" 
                label="Маленькое поле"
                size="sm"
                placeholder="Small input..."
              />
              <InputV2 
                v-model="inputValues.medium" 
                label="Среднее поле"
                size="md"
                placeholder="Medium input..."
              />
              <InputV2 
                v-model="inputValues.large" 
                label="Большое поле"
                size="lg"
                placeholder="Large input..."
              />
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Bento Cards демонстрация -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🎯 Bento Cards</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Default Card" size="1x1" variant="default">
            <p class="text-primary/80 text-sm">Обычная карточка с базовым стилем</p>
          </BentoCard>

          <BentoCard title="Primary Card" size="1x1" variant="primary">
            <p class="text-accent/90 text-sm">Главная карточка для важного контента</p>
          </BentoCard>

          <BentoCard title="Secondary Card" size="1x1" variant="secondary">
            <p class="text-accent/90 text-sm">Вторичная карточка для дополнительной информации</p>
          </BentoCard>

          <BentoCard title="Danger Card" size="1x1" variant="danger">
            <p class="text-accent/90 text-sm">Карточка для предупреждений и ошибок</p>
          </BentoCard>

          <BentoCard title="Interactive Card" size="2x2" variant="minimal" interactive>
            <div class="h-full flex items-center justify-center">
              <div class="text-center">
                <h3 class="text-base sm:text-lg font-semibold text-primary mb-2">Интерактивная карточка</h3>
                <p class="text-secondary mb-3 sm:mb-4 text-sm">Наведите курсор для эффекта</p>
                <ButtonV2 variant="primary" size="sm">Действие</ButtonV2>
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Wide Card" size="2x1" variant="default">
            <p class="text-primary/80 text-sm">Широкая карточка для контента в одну строку</p>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- StatusBadge и Select компоненты -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🏷️ Статусы и селекторы</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Статусы оборудования" size="2x1">
            <div class="space-y-3">
              <div class="flex flex-wrap gap-2">
                <StatusBadgeV2 label="Доступно" variant="available" icon="check-circle" />
                <StatusBadgeV2 label="В использовании" variant="in-use" icon="play-circle" />
                <StatusBadgeV2 label="На обслуживании" variant="maintenance" icon="wrench" />
                <StatusBadgeV2 label="Списано" variant="retired" icon="x-circle" />
              </div>
              <div class="space-y-2">
                <div class="flex flex-wrap gap-2">
                  <StatusBadgeV2 label="Критично" variant="error" icon="alert-triangle" pulse />
                  <StatusBadgeV2 label="Предупреждение" variant="warning" icon="alert-circle" />
                  <StatusBadgeV2 label="Норма" variant="success" icon="check" />
                  <StatusBadgeV2 label="Инфо" variant="info" icon="info" />
                </div>
                <div class="flex flex-wrap gap-2">
                  <StatusBadgeV2 label="Brand Red" variant="brand-red" icon="zap" />
                  <StatusBadgeV2 label="Brand Deep" variant="brand-deep-red" icon="flame" />
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <StatusBadgeV2 label="Активен" variant="active" size="sm" />
                <StatusBadgeV2 label="Средний" variant="secondary" size="md" />
                <StatusBadgeV2 label="Большой" variant="primary" size="lg" />
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Селекторы" size="2x2">
            <div class="space-y-4">
              <SelectV2
                v-model="selectedLocation"
                :options="selectOptions"
                label="Выберите локацию"
                placeholder="Выберите склад..."
                size="sm"
              />
              <SelectV2
                v-model="multiSelectValues"
                :options="selectOptions"
                label="Множественный выбор"
                placeholder="Выберите несколько..."
                multiple
                searchable
                size="sm"
              />
              <div class="text-xs text-secondary">
                <p>Выбрано: {{ selectedLocation }}</p>
                <p>Множественный: {{ multiSelectValues.join(', ') || 'Ничего' }}</p>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- DataCard компоненты -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">📊 Карточки данных (Warehouse Stats)</h2>
        <BentoGrid columns="auto" gap="4">
          <DataCardV2
            v-for="(stat, index) in warehouseStats"
            :key="index"
            :title="stat.title"
            :value="stat.value"
            :description="stat.description"
            :icon="stat.icon"
            :change="stat.change"
            :period="stat.period"
            :status="stat.status"
            :size="index === 0 ? '2x1' : '1x1'"
            :variant="index === 0 ? 'primary' : 'default'"
            interactive
          />
        </BentoGrid>
      </section>

      <!-- Иконки и спиннеры -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">⚡ Иконки и индикаторы</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Индикаторы загрузки" size="2x1">
            <div class="space-y-3 sm:space-y-4">
              <div class="flex items-center gap-3 sm:gap-4">
                <SpinnerV2 size="sm" />
                <SpinnerV2 size="md" />
                <SpinnerV2 size="lg" />
                <SpinnerV2 size="xl" />
              </div>
              <div class="flex items-center gap-3 sm:gap-4">
                <SpinnerV2 size="md" color="primary" />
                <SpinnerV2 size="md" color="secondary" />
                <SpinnerV2 size="md" color="danger" />
              </div>
              <SpinnerV2 size="sm" show-label label="Загружаем..." />
            </div>
          </BentoCard>

          <BentoCard title="Mobile-first статус" size="2x1" variant="minimal">
            <div class="space-y-2 sm:space-y-3">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded-full"></div>
                <span class="text-primary text-xs sm:text-sm">✅ Mobile-first адаптивность</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded-full"></div>
                <span class="text-primary text-xs sm:text-sm">✅ Responsive Bento Grid</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 sm:w-3 sm:h-3 bg-primary rounded-full"></div>
                <span class="text-primary text-xs sm:text-sm">✅ Adaptive Components</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 sm:w-3 sm:h-3 bg-secondary rounded-full"></div>
                <span class="text-secondary text-xs sm:text-sm">📱 Touch-friendly UX</span>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Тест контента разной длины -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">📏 Тест адаптивности контента</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Короткий контент" size="1x1" variant="default">
            <p class="text-primary/80 text-sm">Краткий текст</p>
          </BentoCard>

          <BentoCard title="Длинный контент" size="2x1" variant="minimal">
            <div class="space-y-2">
              <p class="text-primary/80 text-sm">Это карточка с длинным контентом, который должен правильно отображаться без обрезания.</p>
              <p class="text-secondary text-xs">Дополнительная строка для проверки.</p>
              <ul class="list-disc list-inside text-xs space-y-1">
                <li>Пункт списка 1</li>
                <li>Пункт списка 2</li>
                <li>Пункт списка 3</li>
              </ul>
            </div>
          </BentoCard>

          <BentoCard title="Очень длинный контент" size="1x2" variant="secondary" scrollable>
            <div class="space-y-2">
              <p class="text-accent/90 text-sm">Этот контент очень длинный и демонстрирует скроллинг:</p>
              <div class="space-y-2">
                <p class="text-accent/80 text-xs">1. Первый параграф длинного текста</p>
                <p class="text-accent/80 text-xs">2. Второй параграф длинного текста</p>
                <p class="text-accent/80 text-xs">3. Третий параграф длинного текста</p>
                <p class="text-accent/80 text-xs">4. Четвертый параграф длинного текста</p>
                <p class="text-accent/80 text-xs">5. Пятый параграф длинного текста</p>
                <p class="text-accent/80 text-xs">6. Шестой параграф длинного текста</p>
                <p class="text-accent/80 text-xs">7. Седьмой параграф длинного текста</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Динамический контент" size="2x2" variant="primary">
            <div class="space-y-3">
              <div class="text-center">
                <div class="text-2xl sm:text-3xl font-bold text-accent">2,847</div>
                <div class="text-accent/80 text-xs sm:text-sm">Активных пользователей</div>
              </div>
              <div class="grid grid-cols-2 gap-2 text-center">
                <div>
                  <div class="text-lg font-bold text-accent">+15%</div>
                  <div class="text-accent/70 text-xs">За неделю</div>
                </div>
                <div>
                  <div class="text-lg font-bold text-accent">+42%</div>
                  <div class="text-accent/70 text-xs">За месяц</div>
                </div>
              </div>
              <div class="pt-2 border-t border-accent/20">
                <div class="text-accent/90 text-xs text-center">Обновлено: только что</div>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Modal v2 демонстрация -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🪟 Modal v2 - Enterprise Grade</h2>
        <BentoGrid columns="auto" gap="4">
          <BentoCard title="Типы модальных окон" size="2x2">
            <div class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ButtonV2 variant="primary" size="sm" @click="showBasicModal = true" full-width>
                  Базовое окно
                </ButtonV2>
                <ButtonV2 variant="secondary" size="sm" @click="showFormModal = true" full-width>
                  Форма
                </ButtonV2>
                <ButtonV2 variant="warning" size="sm" @click="showConfirmModal = true" full-width>
                  Подтверждение
                </ButtonV2>
                <ButtonV2 variant="brand-red" size="sm" @click="showFullscreenModal = true" full-width>
                  Fullscreen
                </ButtonV2>
              </div>
              <div class="text-xs text-secondary space-y-1">
                <p>✅ Focus trap & Keyboard navigation</p>
                <p>✅ Accessibility (ARIA)</p>
                <p>✅ Body scroll lock</p>
                <p>✅ Анимации входа/выхода</p>
                <p>✅ Адаптивные размеры</p>
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Особенности Modal v2" size="2x1" variant="minimal">
            <div class="space-y-2 text-sm">
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="Enterprise" variant="success" size="sm" />
                <span class="text-primary">Корпоративный уровень</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="Warehouse" variant="primary" size="sm" />
                <span class="text-primary">Для warehouse системы</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="A11Y" variant="info" size="sm" />
                <span class="text-primary">Полная доступность</span>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- Table v2 демонстрация -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🗂️ Table v2 - Enterprise Data Table</h2>
        
        <!-- Описание возможностей -->
        <BentoGrid columns="auto" gap="4" class="mb-6">
          <BentoCard title="Возможности Table v2" size="2x1" variant="minimal">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Сортировка</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Поиск</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Селекция</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Пагинация</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Loading</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Error states</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Responsive</span>
              </div>
              <div class="flex items-center gap-1">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Slots</span>
              </div>
            </div>
          </BentoCard>
          
          <BentoCard title="Замена старых таблиц" size="2x1" variant="primary">
            <div class="space-y-2 text-sm text-accent">
              <p><strong>EquipmentTable.vue:</strong> 385 строк → Table v2</p>
              <p><strong>Универсальность:</strong> Подходит для всех данных</p>
              <p><strong>Консистентность:</strong> Единый UX по всей системе</p>
              <p><strong>Производительность:</strong> Оптимизированная отрисовка</p>
            </div>
          </BentoCard>
        </BentoGrid>

        <!-- Живая демонстрация -->
        <TableV2
          :data="tableData"
          :columns="tableColumns"
          :loading="tableLoading"
          :error="tableError"
          :current-page="tablePage"
          :total-items="tableData.length"
          :page-size="10"
          selectable
          show-search
          show-pagination
          empty-title="Оборудование не найдено"
          empty-description="Попробуйте изменить критерии поиска"
          @sort="handleTableSort"
          @search="handleTableSearch"
          @select="handleTableSelect"
          @row-click="handleRowClick"
          @edit="handleEdit"
          @delete="handleDelete"
          @update:current-page="tablePage = $event"
        >
          <!-- Кастомная колонка статуса -->
          <template #cell-status="{ value }">
            <StatusBadgeV2 
              :label="value === 'available' ? 'Доступно' : 
                     value === 'in-use' ? 'Используется' :
                     value === 'maintenance' ? 'Обслуживание' : 'Списано'"
              :variant="value" 
              size="sm" 
            />
          </template>
          
          <!-- Кастомная колонка цены -->
          <template #cell-price="{ value }">
            <span class="font-mono text-primary">
              {{ new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value) }}
            </span>
          </template>
          
          <!-- Кастомные действия -->
          <template #row-actions="{ item }">
            <div class="flex items-center gap-2">
              <ButtonV2 variant="ghost" size="sm" @click.stop="handleEdit(item)">
                📝
              </ButtonV2>
              <ButtonV2 variant="ghost" size="sm" @click.stop="console.log('Просмотр', item)">
                👁️
              </ButtonV2>
              <ButtonV2 variant="error" size="sm" @click.stop="handleDelete(item)">
                🗑️
              </ButtonV2>
            </div>
          </template>
          
          <!-- Заголовок с действиями -->
          <template #actions>
            <ButtonV2 variant="primary" size="sm" @click="console.log('Добавить оборудование')">
              + Добавить
            </ButtonV2>
            <ButtonV2 variant="secondary" size="sm" @click="console.log('Экспорт')">
              📥 Экспорт
            </ButtonV2>
          </template>
        </TableV2>
        
        <!-- Демо кнопки для тестирования состояний -->
        <div class="mt-4 flex flex-wrap gap-2">
          <ButtonV2 variant="ghost" size="sm" @click="tableLoading = !tableLoading">
            {{ tableLoading ? 'Скрыть' : 'Показать' }} Loading
          </ButtonV2>
          <ButtonV2 variant="ghost" size="sm" @click="tableError = tableError ? '' : 'Ошибка загрузки данных'">
            {{ tableError ? 'Скрыть' : 'Показать' }} Error
          </ButtonV2>
          <ButtonV2 variant="ghost" size="sm" @click="tableData = tableData.length ? [] : [...tableData]">
            {{ tableData.length ? 'Очистить' : 'Восстановить' }} данные
          </ButtonV2>
        </div>
      </section>

      <!-- Form v2 демонстрация -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">📝 Form v2 - Enterprise Form System</h2>
        
        <BentoGrid columns="auto" gap="6">
          <!-- Описание возможностей -->
          <BentoCard title="Возможности Form v2" size="1x2" variant="minimal">
            <div class="space-y-3 text-sm">
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>10+ типов полей</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Валидация в реальном времени</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Автосохранение</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Grid/Vertical layouts</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Кастомные правила</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="✓" variant="success" size="sm" />
                <span>Состояния Loading/Error</span>
              </div>
            </div>
          </BentoCard>

          <!-- Живая форма -->
          <BentoCard title="Создание оборудования" size="2x2" scrollable>
            <FormV2
              v-model="equipmentForm"
              title="Добавить новое оборудование"
              description="Заполните информацию об оборудовании"
              :validation-rules="equipmentFormRules"
              :loading="formLoading"
              layout="grid"
              :columns="2"
              auto-save
              :auto-save-delay="3000"
              submit-text="Создать оборудование"
              submit-variant="primary"
              @submit="handleFormSubmit"
              @reset="handleFormReset"
              @change="handleFormChange"
              @auto-save="handleAutoSave"
            >
              <template #default="{ formData, errors, validate, setField }">
                <!-- Основная информация -->
                <FormFieldV2
                  :model-value="formData.name"
                  @update:model-value="setField('name', $event)"
                  type="input"
                  label="Название оборудования"
                  placeholder="Sony FX6, Canon C300..."
                  required
                  :error="errors.name"
                />

                <FormFieldV2
                  :model-value="formData.category"
                  @update:model-value="setField('category', $event)"
                  type="select"
                  label="Категория"
                  placeholder="Выберите категорию"
                  :options="categoryOptions"
                  required
                  :error="errors.category"
                />

                <FormFieldV2
                  :model-value="formData.serialNumber"
                  @update:model-value="setField('serialNumber', $event)"
                  type="input"
                  label="Серийный номер"
                  placeholder="FX6-123456"
                  required
                  :error="errors.serialNumber"
                  hint="Формат: буквы, цифры и дефисы"
                />

                <FormFieldV2
                  :model-value="formData.price"
                  @update:model-value="setField('price', $event)"
                  type="number"
                  label="Цена (₽)"
                  placeholder="450000"
                  required
                  :error="errors.price"
                />

                <!-- Дополнительная информация (полная ширина) -->
                <div class="md:col-span-2">
                  <FormFieldV2
                    :model-value="formData.description"
                    @update:model-value="setField('description', $event)"
                    type="textarea"
                    label="Описание"
                    placeholder="Подробное описание оборудования..."
                    :rows="3"
                    hint="Укажите особенности, комплектацию, состояние"
                  />
                </div>

                <!-- Статус и дополнительные опции -->
                <FormFieldV2
                  :model-value="formData.status"
                  @update:model-value="setField('status', $event)"
                  type="radio"
                  label="Статус"
                  :options="statusOptions"
                />

                <div class="space-y-3">
                  <FormFieldV2
                    :model-value="formData.hasWarranty"
                    @update:model-value="setField('hasWarranty', $event)"
                    type="checkbox"
                    checkbox-label="Есть гарантия"
                  />
                  
                  <FormFieldV2
                    :model-value="formData.purchaseDate"
                    @update:model-value="setField('purchaseDate', $event)"
                    type="input"
                    label="Дата покупки"
                    placeholder="2023-12-01"
                    hint="Формат: YYYY-MM-DD"
                  />
                </div>
              </template>
            </FormV2>
          </BentoCard>
        </BentoGrid>

        <!-- Состояние формы -->
        <div class="mt-4 p-4 bg-secondary/5 rounded-lg">
          <h4 class="text-sm font-medium text-primary mb-2">Состояние формы:</h4>
          <pre class="text-xs text-secondary overflow-x-auto">{{ JSON.stringify(equipmentForm, null, 2) }}</pre>
        </div>
      </section>

      <!-- SearchInput v2 демонстрация -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🔍 SearchInput v2 - Smart Search System</h2>
        
        <BentoGrid columns="auto" gap="6">
          <!-- Возможности поиска -->
          <BentoCard title="Возможности SearchInput v2" size="1x2" variant="minimal">
            <div class="space-y-3 text-sm">
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="⚡" variant="warning" size="sm" />
                <span>Автокомплит с подсветкой</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="🎯" variant="primary" size="sm" />
                <span>Кастомная фильтрация</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="🏷️" variant="secondary" size="sm" />
                <span>Группировка результатов</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="📱" variant="info" size="sm" />
                <span>Мобильная оптимизация</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="⌨️" variant="success" size="sm" />
                <span>Навигация клавиатурой</span>
              </div>
              <div class="flex items-center gap-2">
                <StatusBadgeV2 label="🔧" variant="warning" size="sm" />
                <span>Debounce и lazy loading</span>
              </div>
            </div>
          </BentoCard>

          <!-- Базовый поиск -->
          <BentoCard title="Базовый поиск" size="1x1">
            <div class="space-y-4">
              <SearchInputV2
                v-model="searchQuery"
                placeholder="Введите запрос..."
                :loading="searchLoading"
                @search="handleSearch"
                @select="handleSearchSelect"
                @clear="handleSearchClear"
              />
              <div class="text-xs text-secondary">
                Запрос: "{{ searchQuery }}"
              </div>
            </div>
          </BentoCard>

          <!-- Поиск оборудования с группировкой -->
          <BentoCard title="Поиск оборудования" size="2x1" scrollable>
            <div class="space-y-4">
              <SearchInputV2
                v-model="equipmentSearchQuery"
                placeholder="Поиск камер, микрофонов, света..."
                :results="equipmentSearchResults"
                :filter-function="smartEquipmentFilter"
                :sort-function="relevanceSort"
                group-by="category"
                :group-labels="categoryGroupLabels"
                :max-results="8"
                :debounce-delay="200"
                size="md"
                variant="filled"
                clearable
                highlight-matches
                @search="handleSearch"
                @select="handleSearchSelect"
                @clear="handleSearchClear"
              >
                <template #result="{ result, query, isHighlighted }">
                  <div class="flex items-center gap-3">
                    <div class="flex-shrink-0">
                      <IconV2 
                        :name="result.icon" 
                        size="sm" 
                        :class="isHighlighted ? 'text-primary' : 'text-secondary'"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span 
                          class="font-medium truncate text-primary"
                        >
                          {{ result.label }}
                        </span>
                        <StatusBadgeV2
                          :label="result.badge.label"
                          :variant="result.badge.variant"
                          size="xs"
                        />
                      </div>
                      <div class="text-xs text-secondary truncate mt-0.5">
                        {{ result.description }}
                      </div>
                    </div>
                    <div class="flex-shrink-0 text-xs text-secondary font-mono">
                      {{ result.meta }}
                    </div>
                  </div>
                </template>
                
                <template #no-results="{ query }">
                  <div class="text-center py-2">
                    <ButtonV2 variant="ghost" size="sm">
                      Создать "{{ query }}"
                    </ButtonV2>
                  </div>
                </template>
              </SearchInputV2>
              
              <div class="text-xs text-secondary">
                💡 Попробуйте: "Sony", "FX6-001", "camera", "микрофон"
              </div>
            </div>
          </BentoCard>

          <!-- Поиск пользователей -->
          <BentoCard title="Поиск сотрудников" size="1x1">
            <div class="space-y-4">
              <SearchInputV2
                v-model="userSearchQuery"
                placeholder="Поиск по имени или должности..."
                :results="userSearchResults"
                group-by="department"
                :group-labels="departmentGroupLabels"
                size="sm"
                variant="minimal"
                :min-search-length="2"
                @search="handleSearch"
                @select="handleSearchSelect"
              />
              
              <div class="text-xs text-secondary">
                Попробуйте: "Алексей", "Оператор"
              </div>
            </div>
          </BentoCard>

          <!-- Поиск локаций -->
          <BentoCard title="Поиск помещений" size="1x1">
            <div class="space-y-4">
              <SearchInputV2
                v-model="locationSearchQuery"
                placeholder="Студии, склады, монтажные..."
                :results="locationSearchResults"
                size="lg"
                variant="default"
                no-results-text="Помещение не найдено"
                clear-text="Очистить поиск локаций"
                @search="handleSearch"
                @select="handleSearchSelect"
              >
                <template #footer="{ query, results }">
                  <div class="flex justify-between items-center text-xs text-secondary">
                    <span>Найдено: {{ results.length }}</span>
                    <ButtonV2 variant="ghost" size="xs">
                      Показать на карте
                    </ButtonV2>
                  </div>
                </template>
              </SearchInputV2>
            </div>
          </BentoCard>
        </BentoGrid>

        <!-- Состояние поисков -->
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-3 bg-secondary/5 rounded-lg">
            <h5 class="text-xs font-medium text-primary mb-1">Базовый поиск:</h5>
            <code class="text-xs text-secondary">{{ searchQuery || 'пусто' }}</code>
          </div>
          <div class="p-3 bg-secondary/5 rounded-lg">
            <h5 class="text-xs font-medium text-primary mb-1">Оборудование:</h5>
            <code class="text-xs text-secondary">{{ equipmentSearchQuery || 'пусто' }}</code>
          </div>
          <div class="p-3 bg-secondary/5 rounded-lg">
            <h5 class="text-xs font-medium text-primary mb-1">Сотрудники:</h5>
            <code class="text-xs text-secondary">{{ userSearchQuery || 'пусто' }}</code>
          </div>
          <div class="p-3 bg-secondary/5 rounded-lg">
            <h5 class="text-xs font-medium text-primary mb-1">Помещения:</h5>
            <code class="text-xs text-secondary">{{ locationSearchQuery || 'пусто' }}</code>
          </div>
        </div>
      </section>

      <!-- Новые компоненты UI Kit v2 -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🆕 Дополнительные компоненты UI Kit v2</h2>
        
        <BentoGrid columns="auto" gap="6">
          <!-- TabsV2 -->
          <BentoCard title="TabsV2 - Smart Tabs" size="2x2">
            <div class="space-y-6">
              <!-- Default Tabs -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Default стиль</h4>
                <TabsV2
                  v-model="activeTab"
                  :tabs="equipmentTabs"
                  @tab-click="handleTabChange"
                  @tab-close="handleTabClose"
                >
                  <template #panel-overview>
                    <div class="p-4 bg-primary/5 rounded-lg">
                      <h5 class="font-medium mb-2">Обзор системы</h5>
                      <p class="text-sm text-secondary">Общая статистика и информация о системе warehouse</p>
                    </div>
                  </template>
                  
                  <template #panel-cameras>
                    <div class="p-4 bg-primary/5 rounded-lg">
                      <h5 class="font-medium mb-2">Камеры (12 единиц)</h5>
                      <p class="text-sm text-secondary">Sony FX6, Canon C300, ARRI Alexa Mini и другие</p>
                    </div>
                  </template>
                  
                  <template #panel-audio>
                    <div class="p-4 bg-success/5 rounded-lg">
                      <h5 class="font-medium mb-2">Аудиооборудование (8 единиц)</h5>
                      <p class="text-sm text-secondary">Микрофоны, рекордеры, аудиоинтерфейсы</p>
                    </div>
                  </template>
                  
                  <template #panel-lighting>
                    <div class="p-4 bg-warning/5 rounded-lg">
                      <h5 class="font-medium mb-2">Освещение (15 единиц)</h5>
                      <p class="text-sm text-secondary">LED панели, софтбоксы, стойки</p>
                    </div>
                  </template>
                  
                  <template #panel-settings>
                    <div class="p-4 bg-secondary/5 rounded-lg">
                      <h5 class="font-medium mb-2">Настройки</h5>
                      <p class="text-sm text-secondary">Конфигурация системы и пользовательские настройки</p>
                    </div>
                  </template>
                </TabsV2>
              </div>
              
              <!-- Pills Tabs -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Pills стиль</h4>
                <TabsV2
                  :tabs="[
                    { label: 'Все', value: 'all' },
                    { label: 'Доступно', value: 'available', badge: { label: '24', variant: 'success' } },
                    { label: 'В аренде', value: 'rented', badge: { label: '8', variant: 'warning' } }
                  ]"
                  variant="pills"
                  size="sm"
                />
              </div>
            </div>
          </BentoCard>

          <!-- DropdownV2 -->
          <BentoCard title="DropdownV2 - Smart Dropdown" size="1x2">
            <div class="space-y-4">
              <!-- Actions Dropdown -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Меню действий</h4>
                <DropdownV2
                  :items="dropdownItems"
                  trigger-text="Действия"
                  trigger-icon="more-vertical"
                  @select="handleDropdownSelect"
                  placement="bottom-start"
                  width="220px"
                />
              </div>
              
              <!-- User Menu -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Пользовательское меню</h4>
                <DropdownV2
                  :items="userMenuItems"
                  trigger-variant="ghost"
                  trigger-icon="user"
                  @select="handleDropdownSelect"
                  placement="bottom-end"
                >
                  <template #trigger="{ toggle }">
                    <ButtonV2 variant="ghost" @click="toggle" class="flex items-center gap-2">
                      <IconV2 name="user" size="sm" />
                      <span>Алексей П.</span>
                      <IconV2 name="chevron-down" size="xs" />
                    </ButtonV2>
                  </template>
                </DropdownV2>
              </div>
              
              <!-- Icon-only Dropdown -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Компактное меню</h4>
                <DropdownV2
                  :items="dropdownItems.slice(0, 4)"
                  trigger-icon="settings"
                  trigger-variant="minimal"
                  size="sm"
                  @select="handleDropdownSelect"
                />
              </div>
            </div>
          </BentoCard>

          <!-- TooltipV2 -->
          <BentoCard title="TooltipV2 - Smart Tooltips" size="2x1">
            <div class="space-y-6">
              <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                <!-- Basic Tooltip -->
                <TooltipV2 content="Это базовая подсказка" placement="top">
                  <ButtonV2 variant="ghost" size="sm">Hover me</ButtonV2>
                </TooltipV2>
                
                <!-- Rich Tooltip -->
                <TooltipV2 
                  title="Sony FX6 Camera" 
                  description="Профессиональная видеокамера 4K с поддержкой Cinema режима"
                  placement="bottom"
                  variant="light"
                >
                  <div class="p-2 bg-primary/10 rounded text-center cursor-help">
                    <IconV2 name="camera" size="sm" />
                  </div>
                </TooltipV2>
                
                <!-- Error Tooltip -->
                <TooltipV2 
                  content="Ошибка подключения к серверу" 
                  variant="error"
                  placement="left"
                >
                  <StatusBadgeV2 label="Ошибка" variant="error" />
                </TooltipV2>
                
                <!-- Warning Tooltip -->
                <TooltipV2 
                  content="Требуется обновление прошивки"
                  variant="warning"
                  placement="right"
                >
                  <StatusBadgeV2 label="Внимание" variant="warning" />
                </TooltipV2>
              </div>
              
              <!-- Keyboard Focus Tooltip -->
              <div>
                <h4 class="text-sm font-medium text-primary mb-3">Tooltip на focus (для accessibility)</h4>
                <TooltipV2 
                  content="Это поле обязательно для заполнения. Введите название оборудования."
                  trigger="focus"
                  placement="top"
                >
                  <InputV2 placeholder="Название оборудования*" />
                </TooltipV2>
              </div>
            </div>
          </BentoCard>

          <!-- NotificationV2 -->
          <BentoCard title="NotificationV2 - Smart Notifications" size="1x2">
            <div class="space-y-4">
              <!-- Notification Triggers -->
              <div class="grid grid-cols-2 gap-2">
                <ButtonV2 
                  variant="success" 
                  size="sm" 
                  @click="showNotificationDemo('success')"
                >
                  Success
                </ButtonV2>
                <ButtonV2 
                  variant="danger" 
                  size="sm" 
                  @click="showNotificationDemo('error')"
                >
                  Error
                </ButtonV2>
                <ButtonV2 
                  variant="warning" 
                  size="sm" 
                  @click="showNotificationDemo('warning')"
                >
                  Warning
                </ButtonV2>
                <ButtonV2 
                  variant="info" 
                  size="sm" 
                  @click="showNotificationDemo('info')"
                >
                  Info
                </ButtonV2>
              </div>
              
              <!-- Rich Notification -->
              <ButtonV2 
                variant="primary" 
                size="sm" 
                @click="showNotificationDemo('custom')"
                class="w-full"
              >
                Rich Notification
              </ButtonV2>
              
              <!-- Clear All -->
              <ButtonV2 
                variant="ghost" 
                size="sm" 
                @click="notificationSystem?.removeAllNotifications()"
                class="w-full"
              >
                Очистить все
              </ButtonV2>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <!-- BreadcrumbsV2 -->
      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🍞 BreadcrumbsV2 - Smart Navigation</h2>
        <BentoGrid columns="auto" gap="4">
          <!-- Базовые хлебные крошки -->
          <BentoCard title="Базовые хлебные крошки" size="2x1" variant="default">
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Default стиль</h4>
                <BreadcrumbsV2 
                  :items="basicBreadcrumbs"
                  @item-click="(data) => console.log('Breadcrumb clicked:', data)"
                />
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Minimal стиль</h4>
                <BreadcrumbsV2 
                  :items="basicBreadcrumbs"
                  variant="minimal"
                  size="sm"
                />
              </div>
            </div>
          </BentoCard>

          <!-- Интерактивные хлебные крошки -->
          <BentoCard title="Интерактивные" size="2x1" variant="default">
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Pills стиль</h4>
                <BreadcrumbsV2 
                  :items="interactiveBreadcrumbs"
                  variant="pills"
                  @item-click="(data) => console.log('Navigate:', data)"
                />
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Underline стиль</h4>
                <BreadcrumbsV2 
                  :items="interactiveBreadcrumbs"
                  variant="underline"
                />
              </div>
            </div>
          </BentoCard>

          <!-- Длинные хлебные крошки -->
          <BentoCard title="Коллапс на мобильных" size="2x2" variant="default">
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Автоколлапс длинных путей</h4>
                <BreadcrumbsV2 
                  :items="longBreadcrumbs"
                  :max-items="4"
                  :mobile-breakpoint="2"
                />
              </div>
              
              <div class="text-xs text-secondary space-y-1">
                <p>• На мобильных показывается только текущий элемент</p>
                <p>• Длинные пути сворачиваются с "..."</p>
                <p>• Клик на "..." разворачивает все элементы</p>
                <p>• Поддержка loading состояний</p>
              </div>
            </div>
          </BentoCard>

          <!-- Разные разделители -->
          <BentoCard title="Кастомные разделители" size="1x2" variant="default">
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Slash</h4>
                <BreadcrumbsV2 
                  :items="basicBreadcrumbs.slice(0, 3)"
                  separator="slash"
                  size="sm"
                />
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Arrow</h4>
                <BreadcrumbsV2 
                  :items="basicBreadcrumbs.slice(0, 3)"
                  separator="arrow-right"
                  size="sm"
                />
              </div>
              
              <div>
                <h4 class="text-sm font-medium text-primary mb-2">Minus</h4>
                <BreadcrumbsV2 
                  :items="basicBreadcrumbs.slice(0, 3)"
                  separator="minus"
                  size="sm"
                />
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>

      <section class="mb-8 sm:mb-12">
        <h2 class="text-lg sm:text-xl font-semibold text-primary mb-4 sm:mb-6">🚀 Практический пример</h2>
        <BentoGrid columns="auto" gap="6">
          <BentoCard title="Статистика" size="1x2" variant="primary">
            <div class="space-y-3 sm:space-y-4">
              <div class="text-center">
                <div class="text-2xl sm:text-3xl font-bold text-accent">1,247</div>
                <div class="text-accent/80 text-xs sm:text-sm">Всего пользователей</div>
              </div>
              <div class="text-center">
                <div class="text-xl sm:text-2xl font-bold text-accent">+12%</div>
                <div class="text-accent/80 text-xs sm:text-sm">За месяц</div>
              </div>
            </div>
          </BentoCard>

          <BentoCard title="Быстрые действия" size="2x1" variant="default">
            <template #actions>
              <div class="flex gap-2">
                <ButtonV2 variant="primary" size="sm">Создать</ButtonV2>
                <ButtonV2 variant="ghost" size="sm">Отмена</ButtonV2>
              </div>
            </template>
            <p class="text-primary/80 text-sm">Выберите действие для выполнения</p>
          </BentoCard>

          <BentoCard title="Форма входа" size="2x2" variant="minimal">
            <div class="space-y-3 sm:space-y-4">
              <InputV2 
                v-model="loginForm.email"
                type="email"
                label="Email"
                placeholder="your@email.com"
                size="sm"
              />
              <InputV2 
                v-model="loginForm.password"
                type="password"
                label="Пароль"
                placeholder="••••••••"
                size="sm"
              />
              <ButtonV2 variant="primary" full-width size="md">Войти</ButtonV2>
            </div>
          </BentoCard>
        </BentoGrid>
      </section>
    </main>

    <!-- Modal v2 Демонстрации -->
    <!-- Базовое модальное окно -->
    <ModalV2
      v-model="showBasicModal"
      title="Базовое модальное окно"
      description="Это простое модальное окно с заголовком и описанием."
      size="md"
    >
      <p class="text-primary">
        Это пример базового модального окна. Оно поддерживает все стандартные возможности:
        закрытие по ESC, клик вне окна, focus trap и accessibility.
      </p>
    </ModalV2>

    <!-- Модальное окно с формой -->
    <ModalV2
      v-model="showFormModal"
      title="Создание оборудования"
      size="lg"
      variant="primary"
    >
      <template #default>
        <div class="space-y-4">
          <InputV2
            v-model="loginForm.email"
            label="Название оборудования"
            placeholder="Введите название..."
            required
          />
          <SelectV2
            v-model="selectedLocation"
            :options="selectOptions"
            label="Локация"
            placeholder="Выберите локацию..."
          />
          <InputV2
            v-model="loginForm.password"
            label="Описание"
            placeholder="Описание оборудования..."
            type="textarea"
          />
        </div>
      </template>
      <template #actions>
        <ButtonV2 variant="ghost" @click="showFormModal = false">
          Отмена
        </ButtonV2>
        <ButtonV2 variant="primary" @click="showFormModal = false">
          Создать оборудование
        </ButtonV2>
      </template>
    </ModalV2>

    <!-- Модальное окно подтверждения -->
    <ModalV2
      v-model="showConfirmModal"
      title="Удалить оборудование?"
      size="sm"
      variant="error"
      :show-default-actions="true"
      confirm-text="Удалить"
      cancel-text="Отмена"
      confirm-variant="error"
      :loading="modalLoading"
      @confirm="handleModalConfirm"
      @cancel="showConfirmModal = false"
    >
      <p class="text-primary">
        Вы уверены, что хотите удалить это оборудование? 
        Это действие нельзя будет отменить.
      </p>
    </ModalV2>

    <!-- Fullscreen модальное окно -->
    <ModalV2
      v-model="showFullscreenModal"
      title="Детальный просмотр оборудования"
      size="fullscreen"
      variant="primary"
    >
      <template #default>
        <div class="h-full space-y-6">
          <BentoGrid columns="auto" gap="4">
            <BentoCard title="Основная информация" size="2x1">
              <p class="text-primary">Здесь может быть подробная информация об оборудовании...</p>
            </BentoCard>
            <BentoCard title="Технические характеристики" size="1x2">
              <div class="space-y-2 text-sm">
                <p><strong>Модель:</strong> Camera XZ-2000</p>
                <p><strong>Серийный номер:</strong> XZ2000-123456</p>
                <p><strong>Год выпуска:</strong> 2023</p>
                <p><strong>Статус:</strong> <StatusBadgeV2 label="Доступно" variant="available" size="sm" /></p>
              </div>
            </BentoCard>
            <BentoCard title="История использования" size="2x2" scrollable>
              <div class="space-y-3">
                <div v-for="i in 10" :key="i" class="border-l-2 border-primary/20 pl-3">
                  <p class="text-sm font-medium">Событие {{ i }}</p>
                  <p class="text-xs text-secondary">15.01.2024 - 20.01.2024</p>
                </div>
              </div>
            </BentoCard>
          </BentoGrid>
        </div>
      </template>
      <template #actions>
        <ButtonV2 variant="secondary" @click="showFullscreenModal = false">
          Закрыть
        </ButtonV2>
        <ButtonV2 variant="primary">
          Редактировать
        </ButtonV2>
      </template>
    </ModalV2>
    
    <!-- Notification System -->
    <NotificationV2 ref="notificationSystem" position="top-right" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import BentoGrid from '@/shared/ui-v2/layouts/BentoGrid.vue'
import BentoCard from '@/shared/ui-v2/layouts/BentoCard.vue'
import ButtonV2 from '@/shared/ui-v2/atoms/Button.vue'
import InputV2 from '@/shared/ui-v2/atoms/Input.vue'
import IconV2 from '@/shared/ui-v2/atoms/Icon.vue'
import SpinnerV2 from '@/shared/ui-v2/atoms/Spinner.vue'
import StatusBadgeV2 from '@/shared/ui-v2/atoms/StatusBadge.vue'
import SelectV2 from '@/shared/ui-v2/atoms/Select.vue'
import DataCardV2 from '@/shared/ui-v2/molecules/DataCard.vue'
import ModalV2 from '@/shared/ui-v2/molecules/Modal.vue'
import TableV2 from '@/shared/ui-v2/organisms/Table.vue'
import FormV2 from '@/shared/ui-v2/molecules/Form.vue'
import FormFieldV2 from '@/shared/ui-v2/molecules/FormField.vue'
import SearchInputV2 from '@/shared/ui-v2/atoms/SearchInput.vue'
import TabsV2 from '@/shared/ui-v2/molecules/Tabs.vue'
import DropdownV2 from '@/shared/ui-v2/molecules/Dropdown.vue'
import TooltipV2 from '@/shared/ui-v2/atoms/Tooltip.vue'
import NotificationV2 from '@/shared/ui-v2/molecules/Notification.vue'
import BreadcrumbsV2 from '@/shared/ui-v2/molecules/Breadcrumbs.vue'

// Цветовая палитра для демонстрации
const colorPalette = [
  { name: 'Primary', hex: '#2B2D42', bgClass: 'bg-primary', category: 'Фирменные' },
  { name: 'Secondary', hex: '#8D99AE', bgClass: 'bg-secondary', category: 'Фирменные' },
  { name: 'Accent', hex: '#EDF2F4', bgClass: 'bg-accent border border-secondary/20', category: 'Фирменные' },
  { name: 'Brand Red', hex: '#EF233C', bgClass: 'bg-[var(--color-brand-red)]', category: 'Фирменные' },
  { name: 'Brand Deep Red', hex: '#D90429', bgClass: 'bg-[var(--color-brand-deep-red)]', category: 'Фирменные' },
  
  { name: 'Success', hex: '#22c55e', bgClass: 'bg-[var(--color-success)]', category: 'Семантические' },
  { name: 'Warning', hex: '#f59e0b', bgClass: 'bg-[var(--color-warning)]', category: 'Семантические' },
  { name: 'Error', hex: '#ef4444', bgClass: 'bg-[var(--color-error)]', category: 'Семантические' },
  { name: 'Info', hex: '#3b82f6', bgClass: 'bg-[var(--color-info)]', category: 'Семантические' }
]

// Значения для демонстрации полей ввода
const inputValues = ref({
  basic: '',
  required: '',
  error: 'invalid text',
  disabled: 'disabled value',
  small: '',
  medium: '',
  large: ''
})

// Форма входа для демонстрации
const loginForm = ref({
  email: '',
  password: ''
})

// Данные для новых компонентов
const selectOptions = ref([
  { label: 'Склад А', value: 'warehouse-a' },
  { label: 'Склад Б', value: 'warehouse-b' },
  { label: 'Цех производства', value: 'production' },
  { label: 'Офисное здание', value: 'office' }
])

const selectedLocation = ref('warehouse-a')
const multiSelectValues = ref([])

const warehouseStats = ref([
  {
    title: 'Всего оборудования',
    value: 1247,
    description: 'Единиц техники в системе',
    icon: 'package',
    change: 12,
    period: 'За месяц',
    status: { label: 'Актуально', variant: 'success', icon: 'check' }
  },
  {
    title: 'Доступно сейчас',
    value: 892,
    description: 'Готово к использованию',
    icon: 'check-circle',
    change: -3,
    period: 'За неделю',
    status: { label: 'Доступно', variant: 'available' }
  },
  {
    title: 'В использовании',
    value: 255,
    description: 'Активно задействовано',
    icon: 'play-circle',
    change: 8,
    period: 'Сейчас'
  },
  {
    title: 'На обслуживании',
    value: 42,
    description: 'Техническое обслуживание',
    icon: 'wrench',
    status: { label: 'Обслуживание', variant: 'maintenance', icon: 'wrench' }
  }
])

// Состояния для демонстрации Modal v2
const showBasicModal = ref(false)
const showFormModal = ref(false)
const showConfirmModal = ref(false)
const showFullscreenModal = ref(false)
const modalLoading = ref(false)

const handleModalConfirm = () => {
  modalLoading.value = true
  setTimeout(() => {
    modalLoading.value = false
    showConfirmModal.value = false
    alert('Действие подтверждено!')
  }, 2000)
}

// Данные для демонстрации Table v2
const tableColumns = [
  { key: 'name', title: 'Название', sortable: true, type: 'text' },
  { key: 'category', title: 'Категория', sortable: true, type: 'text' },
  { key: 'location', title: 'Локация', sortable: false, type: 'text' },
  { key: 'status', title: 'Статус', sortable: false, type: 'status' },
  { key: 'price', title: 'Цена', sortable: true, type: 'number' }
]

const tableData = ref([
  {
    id: 1,
    name: 'Camera Sony FX6',
    category: 'Видеокамеры',
    location: 'Склад А',
    status: 'available',
    price: 450000
  },
  {
    id: 2,
    name: 'Микрофон Rode NTG4+',
    category: 'Аудио',
    location: 'Склад Б',
    status: 'in-use',
    price: 25000
  },
  {
    id: 3,
    name: 'Штатив Manfrotto',
    category: 'Аксессуары',
    location: 'Цех производства',
    status: 'maintenance',
    price: 15000
  },
  {
    id: 4,
    name: 'LED Panel Aputure 300D',
    category: 'Освещение',
    location: 'Склад А',
    status: 'available',
    price: 85000
  },
  {
    id: 5,
    name: 'Monitor Atomos Ninja V',
    category: 'Мониторы',
    location: 'Офисное здание',
    status: 'retired',
    price: 45000
  }
])

const tableLoading = ref(false)
const tableError = ref('')
const tablePage = ref(1)
const tableSelected = ref([])

const handleTableSort = (sortData) => {
  console.log('Сортировка:', sortData)
}

const handleTableSearch = (query) => {
  console.log('Поиск:', query)
}

const handleTableSelect = (selected) => {
  tableSelected.value = selected
  console.log('Выбрано:', selected)
}

const handleRowClick = (item) => {
  console.log('Клик по строке:', item)
}

const handleEdit = (item) => {
  console.log('Редактировать:', item)
}

const handleDelete = (item) => {
  console.log('Удалить:', item)
}

// Данные для демонстрации Form v2
const equipmentForm = ref({
  name: '',
  category: '',
  location: '',
  serialNumber: '',
  purchaseDate: '',
  price: null,
  description: '',
  status: 'available',
  hasWarranty: false,
  tags: []
})

const formLoading = ref(false)

const equipmentFormRules = {
  name: [
    { rule: 'required', message: 'Название оборудования обязательно' },
    { rule: 'minLength', value: 3, message: 'Минимум 3 символа' }
  ],
  category: [
    { rule: 'required', message: 'Выберите категорию' }
  ],
  serialNumber: [
    { rule: 'required', message: 'Серийный номер обязателен' },
    { rule: 'pattern', value: '^[A-Z0-9-]+$', message: 'Только буквы, цифры и дефисы' }
  ],
  price: [
    { rule: 'required', message: 'Укажите цену' },
    { rule: 'number', message: 'Введите корректную цену' },
    { rule: 'min', value: 0, message: 'Цена не может быть отрицательной' }
  ]
}

const categoryOptions = [
  { label: 'Видеокамеры', value: 'cameras' },
  { label: 'Аудиооборудование', value: 'audio' },
  { label: 'Освещение', value: 'lighting' },
  { label: 'Аксессуары', value: 'accessories' }
]

const statusOptions = [
  { label: 'Доступно', value: 'available' },
  { label: 'В использовании', value: 'in-use' },
  { label: 'На обслуживании', value: 'maintenance' },
  { label: 'Списано', value: 'retired' }
]

const handleFormSubmit = (formData) => {
  formLoading.value = true
  console.log('Отправка формы:', formData)
  
  // Имитация отправки на сервер
  setTimeout(() => {
    formLoading.value = false
    alert('Оборудование успешно создано!')
  }, 2000)
}

const handleFormReset = () => {
  console.log('Сброс формы')
}

const handleFormChange = (data) => {
  console.log('Изменение формы:', data)
}

const handleAutoSave = (formData) => {
  console.log('Автосохранение:', formData)
}

// Данные для демонстрации SearchInput v2
const searchQuery = ref('')
const equipmentSearchQuery = ref('')
const userSearchQuery = ref('')
const locationSearchQuery = ref('')

const searchLoading = ref(false)

// Демо данные для поиска
const equipmentSearchResults = [
  {
    label: 'Sony FX6 Camera',
    value: 'sony-fx6',
    description: 'Профессиональная видеокамера 4K',
    icon: 'camera',
    badge: { label: 'Доступно', variant: 'success' },
    meta: '№ FX6-001',
    category: 'cameras',
    type: 'equipment'
  },
  {
    label: 'Canon C300 Mark III',
    value: 'canon-c300',
    description: 'Кинокамера высокого разрешения',
    icon: 'camera',
    badge: { label: 'В аренде', variant: 'warning' },
    meta: '№ C300-015',
    category: 'cameras',
    type: 'equipment'
  },
  {
    label: 'ARRI Alexa Mini',
    value: 'arri-alexa',
    description: 'Цифровая кинокамера премиум класса',
    icon: 'camera',
    badge: { label: 'Обслуживание', variant: 'error' },
    meta: '№ AL-003',
    category: 'cameras',
    type: 'equipment'
  },
  {
    label: 'Rode PodMic',
    value: 'rode-podmic',
    description: 'Подкастинговый микрофон',
    icon: 'microphone',
    badge: { label: 'Доступно', variant: 'success' },
    meta: '№ PM-012',
    category: 'audio',
    type: 'equipment'
  },
  {
    label: 'Shure SM7B',
    value: 'shure-sm7b',
    description: 'Студийный динамический микрофон',
    icon: 'microphone',
    badge: { label: 'Доступно', variant: 'success' },
    meta: '№ SM7-008',
    category: 'audio',
    type: 'equipment'
  },
  {
    label: 'ARRI SkyPanel S60',
    value: 'arri-skypanel',
    description: 'LED панель 2x1',
    icon: 'lightbulb',
    badge: { label: 'В аренде', variant: 'warning' },
    meta: '№ SP-025',
    category: 'lighting',
    type: 'equipment'
  }
]

const userSearchResults = [
  {
    label: 'Алексей Петров',
    value: 'alexey-petrov',
    description: 'Режиссер, Продюсер',
    icon: 'user',
    badge: { label: 'Онлайн', variant: 'success' },
    meta: 'ID: 1001',
    department: 'production'
  },
  {
    label: 'Мария Сидорова',
    value: 'maria-sidorova',
    description: 'Оператор-постановщик',
    icon: 'user',
    badge: { label: 'Занята', variant: 'warning' },
    meta: 'ID: 1002',
    department: 'camera'
  },
  {
    label: 'Дмитрий Козлов',
    value: 'dmitry-kozlov',
    description: 'Звукорежиссер',
    icon: 'user',
    badge: { label: 'Оффлайн', variant: 'secondary' },
    meta: 'ID: 1003',
    department: 'audio'
  }
]

const locationSearchResults = [
  {
    label: 'Студия А - Основная',
    value: 'studio-a',
    description: 'Большая студия 200м², циклорама',
    icon: 'building',
    badge: { label: 'Свободна', variant: 'success' },
    meta: 'Этаж 2'
  },
  {
    label: 'Студия B - Малая',
    value: 'studio-b',
    description: 'Компактная студия 80м²',
    icon: 'building',
    badge: { label: 'Занята', variant: 'error' },
    meta: 'Этаж 2'
  },
  {
    label: 'Склад оборудования',
    value: 'warehouse',
    description: 'Основной склад техники',
    icon: 'archive',
    badge: { label: 'Доступен', variant: 'success' },
    meta: 'Этаж 1'
  },
  {
    label: 'Монтажная 1',
    value: 'edit-room-1',
    description: 'DaVinci Resolve, Avid Pro Tools',
    icon: 'monitor',
    badge: { label: 'Занята', variant: 'warning' },
    meta: 'Этаж 3'
  }
]

const categoryGroupLabels = {
  cameras: 'Видеокамеры',
  audio: 'Аудиооборудование',
  lighting: 'Освещение',
  accessories: 'Аксессуары'
}

const departmentGroupLabels = {
  production: 'Продакшн',
  camera: 'Операторы',
  audio: 'Звук',
  post: 'Пост-продакшн'
}

// Обработчики поиска
const handleSearch = (query) => {
  console.log('Поиск:', query)
  searchLoading.value = true
  
  setTimeout(() => {
    searchLoading.value = false
  }, 800)
}

const handleSearchSelect = (data) => {
  console.log('Выбран результат:', data)
}

const handleSearchClear = () => {
  console.log('Поиск очищен')
}

// Кастомная функция фильтрации для умного поиска
const smartEquipmentFilter = (item, query) => {
  const q = query.toLowerCase()
  const label = item.label.toLowerCase()
  const description = item.description.toLowerCase()
  const meta = item.meta.toLowerCase()
  
  // Поиск по названию, описанию, номеру
  return label.includes(q) || description.includes(q) || meta.includes(q)
}

// Кастомная сортировка по релевантности
const relevanceSort = (a, b, query) => {
  const q = query.toLowerCase()
  
  // Приоритет: точное совпадение > начало строки > содержание
  const aLabel = a.label.toLowerCase()
  const bLabel = b.label.toLowerCase()
  
  const aExact = aLabel === q
  const bExact = bLabel === q
  if (aExact && !bExact) return -1
  if (!aExact && bExact) return 1
  
  const aStarts = aLabel.startsWith(q)
  const bStarts = bLabel.startsWith(q)
  if (aStarts && !bStarts) return -1
  if (!aStarts && bStarts) return 1
  
  // Далее по статусу (доступные первыми)
  const aAvailable = a.badge?.variant === 'success'
  const bAvailable = b.badge?.variant === 'success'
  if (aAvailable && !bAvailable) return -1
  if (!aAvailable && bAvailable) return 1
  
  return aLabel.localeCompare(bLabel)
}

// Данные для демонстрации TabsV2
const activeTab = ref('overview')
const equipmentTabs = [
  { label: 'Обзор', value: 'overview', icon: 'home' },
  { label: 'Камеры', value: 'cameras', icon: 'camera', badge: { label: '12', variant: 'primary' } },
  { label: 'Аудио', value: 'audio', icon: 'microphone', badge: { label: '8', variant: 'success' } },
  { label: 'Освещение', value: 'lighting', icon: 'lightbulb', badge: { label: '15', variant: 'warning' } },
  { label: 'Настройки', value: 'settings', icon: 'settings', disabled: false }
]

// Данные для демонстрации DropdownV2
const dropdownItems = [
  { label: 'Создать оборудование', value: 'create', icon: 'plus' },
  { label: 'Импорт данных', value: 'import', icon: 'upload' },
  { type: 'divider' },
  { type: 'header', label: 'Экспорт' },
  { label: 'Экспорт в Excel', value: 'export-excel', icon: 'file-text', shortcut: 'Ctrl+E' },
  { label: 'Экспорт в PDF', value: 'export-pdf', icon: 'file', shortcut: 'Ctrl+P' },
  { type: 'divider' },
  { label: 'Настройки', value: 'settings', icon: 'settings' },
  { label: 'Удалить все', value: 'delete-all', icon: 'trash', variant: 'danger' }
]

const userMenuItems = [
  { label: 'Профиль', value: 'profile', icon: 'user' },
  { label: 'Настройки', value: 'settings', icon: 'settings' },
  { type: 'divider' },
  { label: 'Справка', value: 'help', icon: 'help-circle', href: '/help', target: '_blank' },
  { type: 'divider' },
  { label: 'Выйти', value: 'logout', icon: 'log-out', variant: 'danger' }
]

// Notification system
const notificationSystem = ref(null)

// Данные для Breadcrumbs
const basicBreadcrumbs = [
  { label: 'Главная', href: '/', icon: 'home' },
  { label: 'Оборудование', href: '/equipment' },
  { label: 'Видеокамеры', href: '/equipment/cameras' },
  { label: 'Sony FX6', disabled: true }
]

const interactiveBreadcrumbs = [
  { 
    label: 'Система', 
    icon: 'settings',
    click: () => console.log('Navigate to System')
  },
  { 
    label: 'Пользователи', 
    click: () => console.log('Navigate to Users')
  },
  { 
    label: 'Роли и права',
    click: () => console.log('Navigate to Roles') 
  },
  { 
    label: 'Администраторы',
    loading: true
  }
]

const longBreadcrumbs = [
  { label: 'Root', icon: 'home' },
  { label: 'Projects' },
  { label: 'Video Production' },
  { label: 'Equipment Management' },
  { label: 'Camera Department' },
  { label: 'Sony Equipment' },
  { label: 'FX Series' },
  { label: 'FX6 Model Configuration' }
]

// Обработчики
const handleTabChange = (data) => {
  console.log('Tab changed:', data)
  activeTab.value = data.value
}

const handleTabClose = (data) => {
  console.log('Tab closed:', data)
}

const handleDropdownSelect = (data) => {
  console.log('Dropdown selected:', data)
  
  // Демонстрация уведомлений
  if (data.value === 'create') {
    notificationSystem.value?.success('Оборудование создано успешно!')
  } else if (data.value === 'delete-all') {
    notificationSystem.value?.error('Операция удаления отменена', {
      actions: [
        { label: 'Повторить', variant: 'error', handler: () => console.log('Retry') },
        { label: 'Отмена', variant: 'ghost' }
      ]
    })
  } else if (data.value === 'export-excel') {
    notificationSystem.value?.info('Экспорт начат...', {
      title: 'Экспорт данных',
      duration: 3000
    })
  }
}

const showNotificationDemo = (type) => {
  const messages = {
    success: 'Операция выполнена успешно!',
    error: 'Произошла ошибка при выполнении операции',
    warning: 'Внимание! Проверьте введенные данные',
    info: 'Новая версия системы доступна для обновления'
  }
  
  if (type === 'custom') {
    notificationSystem.value?.addNotification({
      type: 'success',
      title: 'Оборудование добавлено',
      message: 'Sony FX6 Camera успешно добавлена в систему',
      icon: 'camera',
      actions: [
        { label: 'Посмотреть', variant: 'primary', handler: () => console.log('View') },
        { label: 'Редактировать', variant: 'ghost', handler: () => console.log('Edit') }
      ],
      duration: 0 // Не закрывать автоматически
    })
  } else {
    notificationSystem.value?.[type](messages[type])
  }
}
</script>
