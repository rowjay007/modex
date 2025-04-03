import { Kafka, logLevel } from 'kafkajs';

if (!process.env.KAFKA_BROKERS || !process.env.KAFKA_CLIENT_ID) {
  throw new Error('Kafka configuration is missing in environment variables');
}

const brokers = process.env.KAFKA_BROKERS.split(',');

export const kafka = new Kafka({
  clientId: process.env.KAFKA_CLIENT_ID,
  brokers,
  logLevel: logLevel.INFO,
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Create producer instance
export const producer = kafka.producer({
  allowAutoTopicCreation: true,
  transactionTimeout: 30000
});

// Create consumer instance
export const consumer = kafka.consumer({
  groupId: process.env.KAFKA_GROUP_ID || 'user-management-group',
  maxWaitTimeInMs: 50,
  maxBytesPerPartition: 1048576
});

// Event topics
export const topics = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout'
};

// Helper functions for event publishing
export const eventPublisher = {
  async publish(topic: string, message: any) {
    try {
      await producer.connect();
      await producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }]
      });
    } catch (error) {
      console.error(`Error publishing message to topic ${topic}:`, error);
      throw error;
    } finally {
      await producer.disconnect();
    }
  },

  async publishBatch(messages: Array<{ topic: string; message: any }>) {
    try {
      await producer.connect();
      const kafkaMessages = messages.map(({ topic, message }) => ({
        topic,
        messages: [{ value: JSON.stringify(message) }]
      }));
      await producer.sendBatch({ topicMessages: kafkaMessages });
    } catch (error) {
      console.error('Error publishing batch messages:', error);
      throw error;
    } finally {
      await producer.disconnect();
    }
  }
};

// Helper function to initialize consumer
export const initializeConsumer = async (topicHandlers: Record<string, (message: any) => Promise<void>>) => {
  try {
    await consumer.connect();
    
    // Subscribe to all topics with handlers
    const topics = Object.keys(topicHandlers);
    await Promise.all(
      topics.map(topic => consumer.subscribe({ topic, fromBeginning: false }))
    );

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const handler = topicHandlers[topic];
          if (handler && message.value) {
            const value = JSON.parse(message.value.toString());
            await handler(value);
          }
        } catch (error) {
          console.error(`Error processing message from topic ${topic}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('Error initializing consumer:', error);
    throw error;
  }
};

// Graceful shutdown helper
export const gracefulShutdown = async () => {
  try {
    await consumer.disconnect();
    await producer.disconnect();
  } catch (error) {
    console.error('Error during Kafka shutdown:', error);
    throw error;
  }
};