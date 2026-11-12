import { createRealtimeServer } from './realtime-server'

const port = Number(process.env.PORT ?? 8787)

createRealtimeServer({ port, log: (m) => console.log(`[realtime] ${m}`) })
  .then(({ port: actual }) => {
    console.log(`[realtime] WebSocket server on ws://localhost:${actual}`)
    console.log('[realtime] open the app with ?realtime=ws (or set VITE_REALTIME=ws)')
  })
  .catch((error: Error) => {
    console.error(`[realtime] failed to start: ${error.message}`)
    process.exit(1)
  })
