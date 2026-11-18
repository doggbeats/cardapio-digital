// Alarme de novo pedido. Os navegadores só permitem tocar áudio depois de um
// gesto do usuário, então o AudioContext é criado no primeiro clique/tecla e
// reutilizado pelos alertas em tempo real.

type AudioContextWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

let sharedContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedContext) return sharedContext;

  const AudioContextClass =
    window.AudioContext ?? (window as AudioContextWindow).webkitAudioContext;
  if (!AudioContextClass) return null;

  try {
    sharedContext = new AudioContextClass();
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/** Chamado no primeiro gesto do usuário para liberar a reprodução de áudio. */
export function unlockOrderAlarm() {
  const context = getContext();
  if (!context) return;

  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }

  // Um blip silencioso garante o desbloqueio em navegadores mais restritivos.
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  gain.gain.value = 0.0001;
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.01);
}

/** Toca um alarme alto e insistente para um novo pedido. */
export function playNewOrderAlarm() {
  const context = getContext();
  if (!context) return;

  const start = () => {
    const now = context.currentTime + 0.03;

    // Seis apitos em dois tons, bem audíveis mesmo com ruído ao fundo.
    [0, 0.42, 0.84, 1.26, 1.68, 2.1].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const highTone = index % 2 === 0;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(highTone ? 1046.5 : 784, now + offset);
      oscillator.frequency.setValueAtTime(highTone ? 1318.5 : 988, now + offset + 0.16);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.6, now + offset + 0.02);
      gain.gain.setValueAtTime(0.6, now + offset + 0.28);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.36);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + 0.37);
    });
  };

  if (context.state === "running") {
    start();
    return;
  }

  void context.resume().then(start).catch(() => undefined);
}

/** Solicita ao usuário permissão para notificações do navegador. */
export async function requestNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Exibe a notificação de chegada de pedido quando a permissão foi concedida. */
export function notifyNewOrderArrival(body: string, tag: string) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    Notification.permission !== "granted"
  ) {
    return;
  }

  const notification = new Notification("Novo pedido na Brasa & Pão", {
    body,
    tag,
    requireInteraction: true,
  });
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}
