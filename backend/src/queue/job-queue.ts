export interface MediaJobPayload {
  mediaId: string;
  storageKey: string;
  mediaType: 'image' | 'video';
  userId: string;
}

export type JobHandler<T> = (data: T) => Promise<void>;

export interface IJobQueue<T> {
  add(jobName: string, data: T): Promise<void>;
  registerWorker(handler: JobHandler<T>): void;
}

/**
 * In-memory asynchronous persistent-capable queue for development and testing
 * Executes off-event-loop asynchronously via setImmediate with error handling
 */
export class LocalJobQueue<T> implements IJobQueue<T> {
  private handlers: JobHandler<T>[] = [];
  private queue: Array<{ name: string; data: T }> = [];
  private isProcessing = false;

  async add(jobName: string, data: T): Promise<void> {
    this.queue.push({ name: jobName, data });
    setImmediate(() => this.processNext());
  }

  registerWorker(handler: JobHandler<T>): void {
    this.handlers.push(handler);
    setImmediate(() => this.processNext());
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || this.handlers.length === 0) {
      return;
    }

    this.isProcessing = true;
    const job = this.queue.shift();

    if (job) {
      for (const handler of this.handlers) {
        try {
          await handler(job.data);
        } catch (error) {
          console.error(`[Queue] Error processing job ${job.name}:`, error);
        }
      }
    }

    this.isProcessing = false;
    if (this.queue.length > 0) {
      setImmediate(() => this.processNext());
    }
  }
}

// Global media processing queue instance
export const mediaQueue = new LocalJobQueue<MediaJobPayload>();
