import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';
import { cacheGet, cacheSet } from '../config/redis';

// In a real implementation, we would use Firebase Admin SDK for push notifications
// or a service like OneSignal. This is a simplified implementation for demonstration.

export async function initializePushService(): Promise<void> {
  try {
    logger.info('Push notification service initialized');
  } catch (error: any) {
    logger.error('Failed to initialize push notification service', { error });
    throw error;
  }
}

export async function registerDevice(userId: number, deviceToken: string, platform: 'ios' | 'android'): Promise<boolean> {
  try {
    const key = `push:device:${userId}`;
    const devices = await cacheGet<Array<{token: string, platform: string}>>(key) || [];
    
    // Check if device is already registered
    const existingDevice = devices.find(device => device.token === deviceToken);
    if (existingDevice) {
      return true;
    }
    
    // Add new device
    devices.push({ token: deviceToken, platform });
    await cacheSet(key, devices);
    
    logger.info('Device registered for push notifications', { userId, platform });
    return true;
  } catch (error: any) {
    logger.error('Failed to register device for push notifications', { userId, deviceToken, error });
    throw new AppError(500, `Failed to register device: ${error.message}`);
  }
}

export async function unregisterDevice(userId: number, deviceToken: string): Promise<boolean> {
  try {
    const key = `push:device:${userId}`;
    const devices = await cacheGet<Array<{token: string, platform: string}>>(key) || [];
    
    // Filter out the device
    const updatedDevices = devices.filter(device => device.token !== deviceToken);
    
    if (updatedDevices.length === devices.length) {
      return false; // Device wasn't registered
    }
    
    await cacheSet(key, updatedDevices);
    
    logger.info('Device unregistered from push notifications', { userId, deviceToken });
    return true;
  } catch (error: any) {
    logger.error('Failed to unregister device from push notifications', { userId, deviceToken, error });
    throw new AppError(500, `Failed to unregister device: ${error.message}`);
  }
}

export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<{ success: boolean; messageId?: string }> {
  try {
    // In development mode, just log the notification
    if (process.env.NODE_ENV === 'development') {
      logger.info('Push notification would be sent in development mode', { deviceToken, title, body, data });
      return { success: true, messageId: `mock-${Date.now()}` };
    }
    
    // In a real implementation, we would send the notification through Firebase or another service
    logger.info('Push notification sent', { deviceToken, title });
    return { success: true, messageId: `push-${Date.now()}` };
  } catch (error: any) {
    logger.error('Failed to send push notification', { deviceToken, title, error });
    throw new AppError(500, `Failed to send push notification: ${error.message}`);
  }
}

export const pushService = {
  initialize: initializePushService,
  registerDevice,
  unregisterDevice,
  send: sendPushNotification,
};
