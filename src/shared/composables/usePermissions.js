// usePermissions.js
// Composable для управления разрешениями пользователей на изменение данных
// Система разрешений:
// - Admin: может менять статусы всех заданий
// - Engineer (закрепленный за точкой монтажа): может менять статусы только в своих точках
// - Остальные: только просмотр

import { computed } from 'vue'
import { useAuthStore } from '@/app/store/auth-store'

export function usePermissions() {
  const authStore = useAuthStore()

  // Базовые проверки ролей
  const isAdmin = computed(() => authStore.isAdmin)
  const currentUser = computed(() => authStore.user)
  const currentRole = computed(() => authStore.role)

  /**
   * Может ли пользователь изменять статусы заданий в точке монтажа
   * @param {Object} mountPoint - точка монтажа
   * @returns {boolean}
   */
  const canEditTaskStatus = (mountPoint) => {
    // Если пользователь не авторизован
    if (!currentUser.value) {
      console.log('🔒 [Permissions] Пользователь не авторизован')
      return false
    }

    // Администратор может всё
    if (isAdmin.value) {
      console.log('👑 [Permissions] Администратор имеет полный доступ')
      return true
    }

    // Проверяем является ли пользователь ответственным инженером за эту точку монтажа
    if (!mountPoint?.responsible_engineers) {
      console.log('⚠️ [Permissions] Нет информации об ответственных инженерах')
      return false
    }

    const isResponsibleEngineer = mountPoint.responsible_engineers.includes(currentUser.value.id)
    
    if (isResponsibleEngineer) {
      console.log('🔧 [Permissions] Пользователь является ответственным инженером за эту точку монтажа')
      return true
    }

    console.log('❌ [Permissions] Пользователь не имеет прав на редактирование в этой точке монтажа')
    return false
  }

  /**
   * Может ли пользователь добавлять новые задания
   * @param {Object} mountPoint - точка монтажа
   * @returns {boolean}
   */
  const canAddTask = (mountPoint) => {
    // Те же права что и на редактирование статуса
    return canEditTaskStatus(mountPoint)
  }

  /**
   * Может ли пользователь удалять задания
   * @param {Object} mountPoint - точка монтажа
   * @returns {boolean}
   */
  const canDeleteTask = (mountPoint) => {
    // Только администраторы могут удалять задания
    if (isAdmin.value) {
      console.log('👑 [Permissions] Администратор может удалять задания')
      return true
    }

    console.log('❌ [Permissions] Только администраторы могут удалять задания')
    return false
  }

  /**
   * Может ли пользователь редактировать точку монтажа
   * @param {Object} mountPoint - точка монтажа
   * @returns {boolean}
   */
  const canEditMountPoint = (mountPoint) => {
    // Те же права что и на редактирование статуса
    return canEditTaskStatus(mountPoint)
  }

  /**
   * Может ли пользователь удалять точки монтажа
   * @param {Object} mountPoint - точка монтажа
   * @returns {boolean}
   */
  const canDeleteMountPoint = (mountPoint) => {
    // Только администраторы могут удалять точки монтажа
    return isAdmin.value
  }

  /**
   * Получить текстовое объяснение почему нет прав доступа
   * @param {Object} mountPoint - точка монтажа
   * @returns {string}
   */
  const getPermissionMessage = (mountPoint) => {
    if (!currentUser.value) {
      return 'Необходимо авторизоваться для выполнения этого действия'
    }

    if (isAdmin.value) {
      return '' // Админы имеют все права
    }

    if (!mountPoint?.responsible_engineers?.includes(currentUser.value.id)) {
      return 'Только ответственные инженеры за эту точку монтажа или администраторы могут изменять статусы заданий'
    }

    return ''
  }

  /**
   * Получить роль пользователя для отображения
   * @returns {string}
   */
  const getUserRoleDisplay = () => {
    if (!currentUser.value) return 'Не авторизован'
    
    switch (currentRole.value) {
      case 'admin':
        return 'Администратор'
      case 'engineer':
        return 'Инженер'
      case 'manager':
        return 'Менеджер'
      default:
        return currentRole.value || 'Пользователь'
    }
  }

  return {
    // Базовая информация
    isAdmin,
    currentUser,
    currentRole,
    
    // Проверки разрешений
    canEditTaskStatus,
    canAddTask,
    canDeleteTask,
    canEditMountPoint,
    canDeleteMountPoint,
    
    // Утилиты
    getPermissionMessage,
    getUserRoleDisplay
  }
}
