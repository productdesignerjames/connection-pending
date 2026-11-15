import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { handleRoomRequest, MemoryRoomStore } from './src/rooms.js'

const localRooms = new MemoryRoomStore()

const localRoomApi: Plugin = {
  name: 'speed-meetings-local-room-api',
  configureServer(server) {
    server.middlewares.use('/.netlify/functions/rooms', async (request, response, next) => {
      try {
        const method = request.method ?? 'GET'
        const origin = `http://${request.headers.host ?? 'localhost'}`
        const url = new URL(request.url ?? '/', origin)
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = Buffer.concat(chunks).toString('utf8')
        const headers = new Headers()
        for (const [key, value] of Object.entries(request.headers)) {
          if (typeof value === 'string') headers.set(key, value)
          else if (Array.isArray(value)) headers.set(key, value.join(', '))
        }
        const apiRequest = new Request(url, {
          method,
          headers,
          ...(method === 'GET' || method === 'HEAD' || !body ? {} : { body }),
        })
        const apiResponse = await handleRoomRequest(apiRequest, localRooms)
        response.statusCode = apiResponse.status
        apiResponse.headers.forEach((value, key) => response.setHeader(key, value))
        response.end(await apiResponse.text())
      } catch (error) {
        next(error instanceof Error ? error : new Error('Room service failed.'))
      }
    })
  },
}

export default defineConfig({
  plugins: [react(), localRoomApi],
})
