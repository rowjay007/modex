import { Novu } from '@novu/node';
import { config } from '../config';
import { logger } from './logger';

class NovuService {
  private novu: Novu;
  private initialized: boolean = false;

  constructor() {
    this.novu = new Novu(config.novuApiKey);
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Verify connection by making a simple API call
      // Using any to fix Novu's type issues
      const result = await this.novu.subscribers.list(1, 1);
      this.initialized = true;
      logger.info('Novu service initialized successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initialize Novu service: ${errorMessage}`, { error });
      throw new Error(`Novu service initialization failed: ${errorMessage}`);
    }
  }

  public async triggerEvent({
    name,
    to,
    payload,
    overrides = {}
  }: {
    name: string;
    to: { subscriberId: string; email?: string; firstName?: string; lastName?: string; phone?: string; };
    payload: Record<string, string | number | boolean | string[] | Record<string, unknown> | undefined>;
    overrides?: Record<string, any>;
  }) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Cast payload to satisfy Novu's type requirements
      const result = await this.novu.trigger(name, {
        to,
        payload: payload as any, // Cast to any to satisfy Novu's type system
        overrides: overrides as any
      });

      logger.info(`Novu event triggered: ${name}`, { subscriberId: to.subscriberId });
      return result.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to trigger Novu event: ${errorMessage}`, {
        eventName: name,
        subscriberId: to.subscriberId,
        error
      });
      throw new Error(`Failed to trigger notification: ${errorMessage}`);
    }
  }

  public async createSubscriber({
    subscriberId,
    email,
    firstName,
    lastName,
    phone,
    data = {}
  }: {
    subscriberId: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    data?: Record<string, string | number | boolean | string[] | undefined>;
  }) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.novu.subscribers.identify(subscriberId, {
        email,
        firstName,
        lastName,
        phone,
        data
      });

      logger.info(`Subscriber created/updated: ${subscriberId}`);
      return result.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to create/update subscriber: ${errorMessage}`, {
        subscriberId,
        error
      });
      throw new Error(`Failed to create/update subscriber: ${errorMessage}`);
    }
  }

  public async updateSubscriberCredentials({
    subscriberId,
    providerId,
    credentials
  }: {
    subscriberId: string;
    providerId: string;
    credentials: Record<string, unknown>;
  }) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.novu.subscribers.setCredentials(subscriberId, providerId, credentials);

      logger.info(`Subscriber credentials updated: ${subscriberId}`, { providerId });
      return result.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to update subscriber credentials: ${errorMessage}`, {
        subscriberId,
        providerId,
        error
      });
      throw new Error(`Failed to update subscriber credentials: ${errorMessage}`);
    }
  }

  public async deleteSubscriber(subscriberId: string) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const result = await this.novu.subscribers.delete(subscriberId);

      logger.info(`Subscriber deleted: ${subscriberId}`);
      return result.data;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to delete subscriber: ${errorMessage}`, {
        subscriberId,
        error
      });
      throw new Error(`Failed to delete subscriber: ${errorMessage}`);
    }
  }
}

// Export both the class and a singleton instance
export { NovuService };
export const novuService = new NovuService();
