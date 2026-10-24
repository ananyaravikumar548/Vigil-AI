import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/api';

export interface TelemetryData {
  patient_id: string;
  hr: number;
  map: number;
  o2sat: number;
  resp: number;
  timestamp: string;
}

export type TelemetryStatus = 'live' | 'connecting' | 'offline';

export function useTelemetry(patientId: string | null) {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [status, setStatus] = useState<TelemetryStatus>('offline');

  useEffect(() => {
    if (!patientId) {
      setTelemetry(null);
      setStatus('offline');
      return;
    }

    const wsBase = API_BASE_URL.replace(/^http/, 'ws').replace(/\/api$/, '');
    const wsUrl = `${wsBase}/ws/telemetry/${encodeURIComponent(patientId)}`;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setStatus('connecting');
      socket = new WebSocket(wsUrl);
      socket.onopen = () => { if (!cancelled) setStatus('live'); };
      socket.onmessage = (event) => {
        if (cancelled) return;
        try {
          const packet = JSON.parse(event.data) as TelemetryData | { error: string };
          if ('error' in packet) {
            setStatus('offline');
            socket?.close();
          } else {
            setTelemetry(packet);
          }
        } catch {
          setStatus('offline');
        }
      };
      socket.onerror = () => socket?.close();
      socket.onclose = () => {
        if (cancelled) return;
        setStatus('offline');
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [patientId]);

  return { telemetry, status };
}
