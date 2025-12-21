import WebApp from '@twa-dev/sdk';

const WEBHOOK_URL = '';

export const isTelegramEnvironment = (): boolean => {
  return WebApp.initDataUnsafe.user !== undefined;
};

export const getTelegramWebApp = () => {
  return WebApp;
};

export const sendToChat = async (message: string): Promise<void> => {
  if (!isTelegramEnvironment()) {
    console.warn('Not in Telegram environment');
    return;
  }
  
  const userId = WebApp.initDataUnsafe.user?.id;
  if (!userId) {
    throw new Error('User ID not available');
  }
  
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          chat: {
            id: userId,
          },
          web_app_data: {
            data: message,
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error('Failed to send message to webhook:', error);
    throw error;
  }
};

