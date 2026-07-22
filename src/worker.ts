import { bootstrapInfrastructure, registerProcessHandlers } from './bootstrap.js';
import { createLogger, logger } from './shared/logger.js';

const log = createLogger('WorkerProcess');

async function main(): Promise<void> {
  const { container } = await bootstrapInfrastructure();

  await container.useCases.monitoring.reconcileJobs.execute();
  await container.bull.housekeeping.scheduleAll();

  log.info({ role: 'worker' }, 'Worker process started');

  registerProcessHandlers(async () => {
    await container.bull.worker.close();
    await container.bull.queue.close();
    await container.bull.housekeeping.close();
    log.info('Worker process shutting down');
  });
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Worker process failed to start');
  process.exit(1);
});
