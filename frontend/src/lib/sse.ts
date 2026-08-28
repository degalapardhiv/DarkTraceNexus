const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

type SSEEventHandler = (event: string, data: any) => void;

interface SSEConnectionOptions {
  onEvent: SSEEventHandler;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pollingFallback?: () => Promise<any>;
  pollingInterval?: number;
}

export function createSSEConnection(path: string, options: SSEConnectionOptions) {
  const {
    onEvent,
    onOpen,
    onError,
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    pollingFallback,
    pollingInterval = 30000,
  } = options;

  let eventSource: EventSource | null = null;
  let reconnectAttempts = 0;
  let pollingTimer: ReturnType<typeof setInterval> | null = null;
  let destroyed = false;

  function connect() {
    if (destroyed) return;

    const url = `${API_BASE}${path}`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      reconnectAttempts = 0;
      onOpen?.();
      stopPolling();
    };

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed.event || 'message', parsed);
      } catch {
        onEvent('message', { data: e.data });
      }
    };

    eventSource.addEventListener('actor_created', (e: MessageEvent) => {
      try { onEvent('actor_created', JSON.parse(e.data)); } catch {}
    });
    eventSource.addEventListener('attribution_updated', (e: MessageEvent) => {
      try { onEvent('attribution_updated', JSON.parse(e.data)); } catch {}
    });
    eventSource.addEventListener('evidence_added', (e: MessageEvent) => {
      try { onEvent('evidence_added', JSON.parse(e.data)); } catch {}
    });
    eventSource.addEventListener('relationship_updated', (e: MessageEvent) => {
      try { onEvent('relationship_updated', JSON.parse(e.data)); } catch {}
    });
    eventSource.addEventListener('timeline_updated', (e: MessageEvent) => {
      try { onEvent('timeline_updated', JSON.parse(e.data)); } catch {}
    });
    eventSource.addEventListener('heartbeat', (e: MessageEvent) => {
      onEvent('heartbeat', { ts: Date.now() });
    });

    eventSource.onerror = (e) => {
      onError?.(e);
      eventSource?.close();
      eventSource = null;

      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = Math.min(reconnectInterval * Math.pow(1.5, reconnectAttempts - 1), 30000);
        setTimeout(connect, delay);
      } else if (pollingFallback) {
        startPolling();
      }
    };
  }

  function startPolling() {
    if (pollingTimer || !pollingFallback) return;
    pollingTimer = setInterval(async () => {
      try {
        const data = await pollingFallback();
        onEvent('poll', data);
      } catch {
        // polling failed silently
      }
    }, pollingInterval);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function destroy() {
    destroyed = true;
    eventSource?.close();
    stopPolling();
  }

  connect();

  return { destroy, reconnect: connect };
}
