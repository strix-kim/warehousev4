<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">🔘 Кнопки v2</h2>
    <BentoGrid columns="2" gap="6">
      <!-- Варианты кнопок -->
      <BentoCard title="Варианты кнопок">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <ButtonV2 variant="primary">Primary</ButtonV2>
            <ButtonV2 variant="secondary">Secondary</ButtonV2>
            <ButtonV2 variant="ghost">Ghost</ButtonV2>
            <ButtonV2 variant="minimal">Minimal</ButtonV2>
          </div>
          
          <div class="flex flex-wrap gap-3">
            <ButtonV2 variant="brand-red">Brand Red</ButtonV2>
            <ButtonV2 variant="brand-deep-red">Brand Deep</ButtonV2>
          </div>
          
          <div class="flex flex-wrap gap-3">
            <ButtonV2 variant="success">Success</ButtonV2>
            <ButtonV2 variant="warning">Warning</ButtonV2>
            <ButtonV2 variant="error">Error</ButtonV2>
          </div>
          
          <div class="flex flex-wrap gap-3">
            <ButtonV2 variant="primary" :loading="true">Loading</ButtonV2>
            <ButtonV2 variant="secondary" :disabled="true">Disabled</ButtonV2>
          </div>
        </div>
      </BentoCard>

      <!-- Размеры кнопок -->
      <BentoCard title="Размеры кнопок">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-3 items-center">
            <ButtonV2 variant="primary" size="sm">Small</ButtonV2>
            <ButtonV2 variant="primary" size="md">Medium</ButtonV2>
            <ButtonV2 variant="primary" size="lg">Large</ButtonV2>
            <ButtonV2 variant="primary" size="xl">XL</ButtonV2>
          </div>
          
          <ButtonV2 variant="primary" size="md" class="w-full">Full Width Button</ButtonV2>
        </div>
      </BentoCard>

      <!-- Icon-only Buttons Test -->
      <BentoCard title="Кнопки только с иконками (тест центрирования)" size="2x1" variant="default">
        <div class="space-y-4">
          <div class="grid grid-cols-4 gap-3">
                                <ButtonV2 variant="primary" size="sm">
                      <template #icon>
                        <IconV2 name="plus" size="xs" />
                      </template>
                    </ButtonV2>
                    <ButtonV2 variant="secondary" size="md">
                      <template #icon>
                        <IconV2 name="edit" size="xs" />
                      </template>
                    </ButtonV2>
                    <ButtonV2 variant="danger" size="lg">
                      <template #icon>
                        <IconV2 name="trash-2" size="sm" />
                      </template>
                    </ButtonV2>
                    <ButtonV2 variant="ghost" size="xl">
                      <template #icon>
                        <IconV2 name="eye" size="md" />
                      </template>
                    </ButtonV2>
          </div>
          <div class="text-sm text-secondary">
            ✅ Иконки должны быть идеально центрированы без смещения влево
          </div>
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { BentoGrid, BentoCard, ButtonV2, IconV2 } from '@/shared/ui-v2'
</script>