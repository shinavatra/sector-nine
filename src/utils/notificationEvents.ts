export const NOTIFICATIONS_CHANGED_EVENT = 'sector-nine:notifications-changed'

export const notifyNotificationsChanged = (unreadCount?: number) => {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, {
    detail: typeof unreadCount === 'number' ? { unreadCount } : {},
  }))
}

export const subscribeToNotificationChanges = (listener: (unreadCount?: number) => void) => {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ unreadCount?: number }>).detail
    listener(detail?.unreadCount)
  }
  window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handler)
  return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handler)
}
