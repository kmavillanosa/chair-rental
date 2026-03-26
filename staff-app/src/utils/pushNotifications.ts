import api from '../api/axios';

type NotificationConfigResponse = {
  enabled: boolean;
  publicKey: string | null;
};

export async function registerPushNotifications(token: string) {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return false;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  try {
    const { data } = await api.get<NotificationConfigResponse>('/notifications/config', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!data.enabled || !data.publicKey) {
      return false;
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js');
    const permission =
      Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

    if (permission !== 'granted') {
      return false;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    await api.post(
      '/notifications/subscribe',
      { subscription },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    return true;
  } catch (error) {
    console.warn('Push notification registration failed.', error);
    return false;
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}
