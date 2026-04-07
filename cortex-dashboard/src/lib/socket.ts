import { io } from 'socket.io-client'
import { getAuthHeader } from '../store/authStore'

const SOCKET_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  auth: (cb) => {
    cb({ token: getAuthHeader() })
  },
})
