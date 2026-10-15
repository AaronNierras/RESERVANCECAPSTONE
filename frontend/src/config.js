/**
 * Runtime endpoints for school LAN / any PC.
 * Prefer the same hostname as the page so:
 * - http://127.0.0.1:5173 → API/realtime on 127.0.0.1
 * - http://TEACHER-IP:5173 → API/realtime on that IP
 * Hardcoding a LAN IP breaks teacher login on the same PC when that IP is unreachable locally.
 */
export function getRuntimeConfig() {
  const runtime = (typeof window !== 'undefined' && window.RESERVANCE_RUNTIME) || {}
  const host =
    typeof window !== 'undefined' && window.location?.hostname
      ? window.location.hostname
      : '127.0.0.1'

  const apiUrl = `http://${host}:8000/api`
  const realtimeUrl = `http://${host}:3001`
  const realtimeSecret =
    runtime.realtimeSecret || import.meta.env.VITE_REALTIME_SECRET || 'reservance-dev-secret'

  return { apiUrl, realtimeUrl, realtimeSecret }
}

export function getApiBase() {
  return getRuntimeConfig().apiUrl.replace(/\/api\/?$/, '')
}
