<template>
  <section>
    <h2 class="text-xl font-bold text-primary mb-6">📝 Поля ввода v2</h2>
    <BentoGrid columns="2" gap="6">
      <!-- Базовые поля -->
      <BentoCard title="Базовые поля">
        <div class="space-y-4">
          <InputV2 
            v-model="basicInput"
            label="Базовое поле"
            placeholder="Введите текст..."
          />
          
          <InputV2 
            v-model="requiredInput"
            label="Обязательное поле"
            placeholder="Это поле обязательно"
            required
            help="Это поле обязательно для заполнения"
          />
          
          <InputV2 
            v-model="errorInput"
            label="Поле с ошибкой"
            placeholder="Неверное значение"
            error="Это сообщение об ошибке"
          />
          
          <InputV2 
            v-model="disabledInput"
            label="Отключенное поле"
            placeholder="Недоступно"
            disabled
          />
        </div>
      </BentoCard>

      <!-- Размеры полей -->
      <BentoCard title="Размеры полей">
        <div class="space-y-4">
          <InputV2 
            v-model="smallInput"
            label="Маленькое поле"
            size="sm"
            placeholder="Размер SM"
          />
          
          <InputV2 
            v-model="mediumInput"
            label="Среднее поле"
            size="md"
            placeholder="Размер MD"
          />
          
          <InputV2 
            v-model="largeInput"
            label="Большое поле"
            size="lg"
            placeholder="Размер LG"
          />
        </div>
      </BentoCard>
    </BentoGrid>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { BentoGrid, BentoCard, InputV2 } from '@/shared/ui-v2'

// Данные для полей
const basicInput = ref('')
const requiredInput = ref('')
const errorInput = ref('invalid text')
const disabledInput = ref('disabled value')
const smallInput = ref('')
const mediumInput = ref('')
const largeInput = ref('')
</script>