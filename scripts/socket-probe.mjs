/**
 * HORUS stream probe — connects as a client to horus-stream :3030 and
 * dumps the first events seen per channel (6 s window).
 */
import { io } from 'socket.io-client';

const socket = io('http://localhost:3030', { path: '/', transports: ['polling', 'websocket'], timeout: 8000 });
const seen = {};
const counts = {};

socket.onAny((ev, ...args) => {
  counts[ev] = (counts[ev] ?? 0) + 1;
  if (!seen[ev]) seen[ev] = args[0];
});

socket.on('connect', () => {
  console.log('connected:', socket.id);
  socket.emit('cue', { lat: 48.85, lng: 2.35, operator: 'PROBE', note: 'probe cue Paris' },
    (r) => console.log('cue ack:', JSON.stringify(r)));
});

socket.on('connect_error', (e) => console.error('connect_error:', e.message));

setTimeout(() => {
  console.log('--- channel counts (6s) ---');
  for (const [k, v] of Object.entries(counts)) console.log(` ${k}: ${v}`);
  console.log('--- first payload per key channel ---');
  for (const k of ['hello', 'agents', 'agent_report', 'echo_scan', 'spaceweather', 'netweather', 'mil', 'quakes', 'event']) {
    if (seen[k] !== undefined) {
      const s = JSON.stringify(seen[k]);
      console.log(` ${k}: ${s.length > 260 ? s.slice(0, 260) + '…' : s}`);
    } else {
      console.log(` ${k}: (none yet)`);
    }
  }
  socket.close();
  process.exit(0);
}, 6000);
