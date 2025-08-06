<template>
  <!-- Notification Container using Teleport -->
  <Teleport to="body">
    <div :class="containerClass">
      <TransitionGroup
        enter-active-class="transition ease-out duration-300"
        enter-from-class="opacity-0 scale-95 translate-x-full"
        enter-to-class="opacity-100 scale-100 translate-x-0"
        leave-active-class="transition ease-in duration-200"
        leave-from-class="opacity-100 scale-100 translate-x-0"
        leave-to-class="opacity-0 scale-95 translate-x-full"
        move-class="transition-transform duration-300"
        tag="div"
        class="space-y-3"
      >
        <div
          v-for="notification in notifications"
          :key="notification.id"
          :class="getNotificationClass(notification)"
          role="alert"
          :aria-live="notification.type === 'error' ? 'assertive' : 'polite'"
        >
          <!-- Progress Bar -->
          <div
            v-if="notification.showProgress && notification.duration"
            :class="progressBarClass"
            :style="getProgressStyle(notification)"
          />
          
          <!-- Notification Content -->
          <div class="flex items-start gap-4 p-6 min-h-[80px]">
            <!-- Icon -->
            <div class="flex-shrink-0">
              <IconV2
                :name="getNotificationIcon(notification)"
                :size="iconSize"
                :class="getIconClass(notification)"
              />
            </div>
            
            <!-- Content -->
            <div class="flex-1 min-w-0 space-y-1">
              <!-- Title -->
              <h4
                v-if="notification.title"
                :class="titleClass"
              >
                {{ notification.title }}
              </h4>
              
              <!-- Message -->
              <div
                v-if="notification.message"
                :class="messageClass"
                v-html="notification.message"
              />
              
              <!-- Actions -->
              <div v-if="notification.actions?.length" class="mt-3 flex gap-2">
                <ButtonV2
                  v-for="action in notification.actions"
                  :key="action.label"
                  :variant="action.variant || 'ghost'"
                  size="sm"
                  @click="handleActionClick(notification, action)"
                >
                  {{ action.label }}
                </ButtonV2>
              </div>
            </div>
            
            <!-- Close Button -->
            <button
              v-if="notification.closable !== false"
              type="button"
              :class="closeButtonClass"
              @click="removeNotification(notification.id)"
              :aria-label="`Закрыть уведомление: ${notification.title || notification.message}`"
            >
              <IconV2 name="x" size="sm" />
            </button>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
/**
 * NotificationV2 - Smart Notification System для warehouse системы
 * Поддержка разных типов, позиций, действий, автозакрытие
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import IconV2 from '../atoms/Icon.vue'
import ButtonV2 from '../atoms/Button.vue'

const props = defineProps({
  // Position
  position: {
    type: String,
    default: 'top-right',
    validator: (value) => [
      'top-left', 'top-right', 'top-center',
      'bottom-left', 'bottom-right', 'bottom-center'
    ].includes(value)
  },
  
  // Max notifications
  maxNotifications: {
    type: Number,
    default: 5
  },
  
  // Default settings
  defaultDuration: {
    type: Number,
    default: 5000
  },
  
  // Styling
  size: {
    type: String,
    default: 'md',
    validator: (value) => ['sm', 'md', 'lg'].includes(value)
  }
})

const emit = defineEmits(['notification-click', 'action-click', 'notification-close'])

// State
const notifications = ref([])
const timers = ref(new Map())

// Computed
const containerClass = computed(() => {
  const baseClasses = [
    'fixed z-[9999] pointer-events-none',
    'w-full max-w-lg sm:max-w-xl md:max-w-2xl'
  ]
  
  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  }
  baseClasses.push(positionClasses[props.position] || positionClasses['top-right'])
  
  return baseClasses
})

const iconSize = computed(() => {
  const sizes = {
    sm: 'md',
    md: 'lg',
    lg: 'xl'
  }
  return sizes[props.size] || 'lg'
})

const titleClass = computed(() => {
  const baseClasses = ['font-semibold leading-tight']
  
  const sizeClasses = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-xl'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  return baseClasses
})

const messageClass = computed(() => {
  const baseClasses = ['leading-relaxed']
  
  const sizeClasses = {
    sm: 'text-sm mt-1',
    md: 'text-base mt-2',
    lg: 'text-lg mt-2'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  return baseClasses
})

const closeButtonClass = computed(() => [
  'flex-shrink-0 p-1 rounded-md transition-colors duration-150',
  'text-current/60 hover:text-current hover:bg-black/10',
  'focus:outline-none focus:ring-2 focus:ring-current/30'
])

const progressBarClass = computed(() => [
  'absolute bottom-0 left-0 h-1 bg-current/20 transition-all duration-100 ease-linear'
])

// Notification type configurations
const notificationConfig = {
  success: {
    icon: 'check-circle',
    bgClass: 'bg-green-600 text-white shadow-green-200/50',
    iconClass: 'text-white drop-shadow-sm'
  },
  error: {
    icon: 'x-circle',
    bgClass: 'bg-red-600 text-white shadow-red-200/50',
    iconClass: 'text-white drop-shadow-sm'
  },
  warning: {
    icon: 'alert-triangle',
    bgClass: 'bg-amber-500 text-white shadow-amber-200/50',
    iconClass: 'text-white drop-shadow-sm'
  },
  info: {
    icon: 'info',
    bgClass: 'bg-blue-600 text-white shadow-blue-200/50',
    iconClass: 'text-white drop-shadow-sm'
  },
  default: {
    icon: 'bell',
    bgClass: 'bg-gray-800 text-white border border-gray-600',
    iconClass: 'text-white'
  }
}

// Methods
const getNotificationClass = (notification) => {
  const config = notificationConfig[notification.type] || notificationConfig.default
  
  const baseClasses = [
    'relative pointer-events-auto rounded-lg shadow-lg backdrop-blur-sm',
    'transform transition-all duration-300 ease-out',
    'min-w-[400px] w-full shadow-xl'
  ]
  
  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }
  baseClasses.push(sizeClasses[props.size] || sizeClasses.md)
  
  // Type classes
  baseClasses.push(config.bgClass)
  
  return baseClasses
}

const getNotificationIcon = (notification) => {
  if (notification.icon) return notification.icon
  
  const config = notificationConfig[notification.type] || notificationConfig.default
  return config.icon
}

const getIconClass = (notification) => {
  const config = notificationConfig[notification.type] || notificationConfig.default
  return config.iconClass
}

const getProgressStyle = (notification) => {
  if (!notification.startTime || !notification.duration) return { width: '0%' }
  
  const elapsed = Date.now() - notification.startTime
  const progress = Math.min((elapsed / notification.duration) * 100, 100)
  
  return {
    width: `${100 - progress}%`
  }
}

const generateId = () => {
  return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

const addNotification = (notification) => {
  const id = notification.id || generateId()
  const duration = notification.duration !== undefined ? notification.duration : props.defaultDuration
  
  const newNotification = {
    ...notification,
    id,
    duration,
    startTime: duration > 0 ? Date.now() : null,
    showProgress: notification.showProgress !== false && duration > 0
  }
  
  // Remove oldest notifications if we exceed max
  if (notifications.value.length >= props.maxNotifications) {
    const toRemove = notifications.value.length - props.maxNotifications + 1
    for (let i = 0; i < toRemove; i++) {
      removeNotification(notifications.value[0].id)
    }
  }
  
  notifications.value.push(newNotification)
  
  // Auto-remove if duration is set
  if (duration > 0) {
    const timer = setTimeout(() => {
      removeNotification(id)
    }, duration)
    
    timers.value.set(id, timer)
  }
  
  return id
}

const removeNotification = (id) => {
  const index = notifications.value.findIndex(n => n.id === id)
  if (index === -1) return
  
  const notification = notifications.value[index]
  notifications.value.splice(index, 1)
  
  // Clear timer
  const timer = timers.value.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.value.delete(id)
  }
  
  emit('notification-close', notification)
}

const removeAllNotifications = () => {
  notifications.value.forEach(notification => {
    const timer = timers.value.get(notification.id)
    if (timer) {
      clearTimeout(timer)
      timers.value.delete(notification.id)
    }
  })
  
  notifications.value = []
}

const handleActionClick = (notification, action) => {
  emit('action-click', { notification, action })
  
  if (action.handler) {
    action.handler(notification)
  }
  
  if (action.closeOnClick !== false) {
    removeNotification(notification.id)
  }
}

// Convenience methods for different notification types
const success = (message, options = {}) => {
  return addNotification({
    type: 'success',
    message,
    ...options
  })
}

const error = (message, options = {}) => {
  return addNotification({
    type: 'error',
    message,
    duration: options.duration !== undefined ? options.duration : 0, // Don't auto-close errors by default
    ...options
  })
}

const warning = (message, options = {}) => {
  return addNotification({
    type: 'warning',
    message,
    ...options
  })
}

const info = (message, options = {}) => {
  return addNotification({
    type: 'info',
    message,
    ...options
  })
}

const notify = (message, options = {}) => {
  return addNotification({
    type: 'default',
    message,
    ...options
  })
}

// Expose methods
defineExpose({
  addNotification,
  removeNotification,
  removeAllNotifications,
  success,
  error,
  warning,
  info,
  notify,
  notifications: computed(() => notifications.value)
})

// Cleanup on unmount
onUnmounted(() => {
  timers.value.forEach(timer => clearTimeout(timer))
  timers.value.clear()
})
</script>

<style scoped>
/* Progress bar animation */
@keyframes progress {
  from { width: 100%; }
  to { width: 0%; }
}

.progress-bar {
  animation: progress var(--duration, 5s) linear forwards;
}
</style>