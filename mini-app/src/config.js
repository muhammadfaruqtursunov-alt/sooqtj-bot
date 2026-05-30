// Backend URL — Railway server (API + image store)
export const BACKEND = import.meta.env.VITE_API_URL || ''
export const LOGO    = `${BACKEND}/api/image/logo`
export const LOGO_FB = `${BACKEND}/logo.svg`
