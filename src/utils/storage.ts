import WebApp from '@twa-dev/sdk';

const STORAGE_KEY = 'habits-app-data';

class StorageAdapter {
  private isTelegram: boolean;

  constructor() {
    this.isTelegram = this.checkTelegramEnvironment();
  }

  private checkTelegramEnvironment(): boolean {
    return !!(
      WebApp.initData &&
      WebApp.initDataUnsafe &&
      WebApp.platform !== 'unknown'
    );
  }

  async getItem(key: string): Promise<string | null> {
    if (this.isTelegram) {
      return new Promise((resolve) => {
        WebApp.CloudStorage.getItem(key, (error, value) => {
          if (error) {
            console.error('CloudStorage getItem error:', error);
            resolve(null);
          } else {
            resolve(value || null);
          }
        });
      });
    }
    return localStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.isTelegram) {
      return new Promise((resolve, reject) => {
        WebApp.CloudStorage.setItem(key, value, (error) => {
          if (error) {
            console.error('CloudStorage setItem error:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    localStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.isTelegram) {
      return new Promise((resolve, reject) => {
        WebApp.CloudStorage.removeItem(key, (error) => {
          if (error) {
            console.error('CloudStorage removeItem error:', error);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }
    localStorage.removeItem(key);
  }

  getStorageType(): 'telegram' | 'local' {
    return this.isTelegram ? 'telegram' : 'local';
  }
}

export const storage = new StorageAdapter();
export { STORAGE_KEY };



