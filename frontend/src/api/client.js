import axios from 'axios'
import { getRuntimeConfig } from '../config'
import { reportClientError } from '../utils/reportError'

const client = axios.create({
  baseURL: getRuntimeConfig().apiUrl,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  config.baseURL = getRuntimeConfig().apiUrl
  const token = localStorage.getItem('reservance_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Brave + Axios: default JSON Content-Type breaks file uploads. Let the browser set multipart boundary.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type')
    } else if (config.headers) {
      delete config.headers['Content-Type']
      delete config.headers['content-type']
    }
  }
  return config
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('reservance_token')
      localStorage.removeItem('reservance_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    } else {
      const method = String(error.config?.method || 'get').toLowerCase()
      const url = String(error.config?.url || '')
      const status = error.response?.status
      if (method !== 'get' && status !== 422 && !url.includes('/system-errors')) {
        const message = error.response?.data?.message
          || (error.response ? 'The last action could not be completed.' : 'The server could not be reached. The rest of this page is still available.')
        reportClientError(message, window.location.pathname)
      }
    }
    return Promise.reject(error)
  }
)

export default client

export function setAuth(token, user) {
  localStorage.setItem('reservance_token', token)
  localStorage.setItem('reservance_user', JSON.stringify(user))
}

export function clearAuth() {
  localStorage.removeItem('reservance_token')
  localStorage.removeItem('reservance_user')
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('reservance_user') || 'null')
  } catch {
    return null
  }
}
