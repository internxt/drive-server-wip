import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize-typescript';
import v8 from 'node:v8';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

const poolStats = (pool) =>
  pool && {
    size: pool.size,
    available: pool.available,
    using: pool.using,
    waiting: pool.waiting,
  };

@Injectable()
export class RuntimeMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RuntimeMonitorService.name);
  private readonly eventLoopDelay = monitorEventLoopDelay({ resolution: 20 });
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  onModuleInit() {
    this.eventLoopDelay.enable();
    this.timers.push(setInterval(() => this.reportRuntime(), 60_000).unref());
  }

  onModuleDestroy() {
    this.timers.forEach(clearInterval);
    this.eventLoopDelay.disable();
  }

  private reportRuntime() {
    try {
      const memory = process.memoryUsage();
      const heap = v8.getHeapStatistics();
      const resources: Record<string, number> = {};
      for (const type of process.getActiveResourcesInfo()) {
        resources[type] = (resources[type] ?? 0) + 1;
      }
      // Not in Sequelize public types; with replication there is one pool per role
      const pool = (this.sequelize as any).connectionManager?.pool;

      this.logger.log({
        msg: 'NodeRuntimeSample',
        uptimeMin: Math.round(process.uptime() / 60),
        rssMb: toMb(memory.rss),
        heapUsedMb: toMb(memory.heapUsed),
        heapTotalMb: toMb(memory.heapTotal),
        externalMb: toMb(memory.external),
        arrayBuffersMb: toMb(memory.arrayBuffers),
        heapLimitMb: toMb(heap.heap_size_limit),
        detachedContexts: heap.number_of_detached_contexts,
        heapSpacesMb: Object.fromEntries(
          v8
            .getHeapSpaceStatistics()
            .map((s) => [s.space_name, toMb(s.space_used_size)]),
        ),
        resources,
        eventLoopP99Ms: this.eventLoopDelay.percentile(99) / 1e6,
        dbPool: pool?.read
          ? { read: poolStats(pool.read), write: poolStats(pool.write) }
          : poolStats(pool),
      });
      this.eventLoopDelay.reset();
    } catch (error) {
      this.logger.warn(`Failed to report runtime sample: ${error?.message}`);
    }
  }
}
