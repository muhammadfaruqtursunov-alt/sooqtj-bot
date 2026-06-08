export function useTelegram() {
  const tg = window.Telegram?.WebApp
  const initData = tg?.initData || ''
  const user = tg?.initDataUnsafe?.user || { id: 0, first_name: 'Мухаммад' }

  return {
    tg,
    initData,
    user,
    ready: () => tg?.ready(),
    expand: () => tg?.expand(),
    close: () => tg?.close(),
  }
}
