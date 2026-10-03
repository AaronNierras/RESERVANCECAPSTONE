import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const client = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('reservance_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
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
