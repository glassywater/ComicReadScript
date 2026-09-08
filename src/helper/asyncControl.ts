import { type Promisable } from 'type-fest';

export const sleep = (ms: number) =>
  // oxlint-disable-next-line promise/avoid-new no-promise-executor-return
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** 创建一个只会执行一次的函数，并缓存首次调用的返回值 */
export const once = <T extends (...args: any[]) => any>(
  fn: T,
): ((...args: Parameters<T>) => ReturnType<T>) => {
  let wrapper = (...args: Parameters<T>): ReturnType<T> => {
    const result = fn(...args);
    wrapper = () => result;
    return result;
  };

  return (...args: Parameters<T>) => wrapper(...args);
};

type SingleThreadedState<T extends any[]> = {
  running: boolean;
  argList: T[];
  /** 是否在一轮运行结束后清空等待调用队列 */
  abandon?: boolean;
  /** 是否在一轮运行结束后只补跑最后一次等待调用 */
  latestOnly?: boolean;
  /** 连续调用的间隔 */
  timeout?: number;
  /** 确保本次运行完后再运行一次 */
  continueRun: (...args: T) => void;
};
/** 确保函数在同一时间下只有一个在运行 */
export const singleThreaded = <T extends any[]>(
  callback: (
    state: SingleThreadedState<T>,
    ...args: T
  ) => Promisable<void | undefined>,
  initState?: Partial<SingleThreadedState<T>>,
) => {
  const state: SingleThreadedState<T> = {
    running: false,
    argList: [],
    continueRun: (...args: T) =>
      state.argList.length > 0 || state.argList.push(args),
    ...initState,
  };

  const work = async () => {
    if (state.argList.length === 0) return;
    const args = state.argList.shift()!;

    try {
      state.running = true;
      await callback(state, ...args);
    } catch (error) {
      await sleep(100);
      if (state.argList.length === 0) throw error;
    } finally {
      if (state.abandon) state.argList.length = 0;
      else if (state.latestOnly && state.argList.length > 1)
        state.argList.splice(0, state.argList.length - 1);
      if (state.argList.length > 0) setTimeout(work, state.timeout);
      else state.running = false;
    }
  };

  return (...args: T) => {
    state.argList.push(args);
    if (!state.running) return work();
  };
};

/**
 * 限制 Promise 并发
 * @param fnList 任务函数列表
 * @param callBack 成功执行一个 Promise 后调用，主要用于显示进度
 * @param limit 限制数
 * @returns 所有 Promise 的返回值
 */
export const plimit = async <T>(
  fnList: (() => Promisable<T>)[],
  callBack = undefined as
    // oxlint-disable-next-line max-params
    | ((doneNum: number, totalNum: number, resList: T[], i: number) => void)
    | undefined,
  limit = 10,
) => {
  let doneNum = 0;
  const totalNum = fnList.length;
  const resList: T[] = [];
  const execPool = new Set<Promise<void>>();
  const taskList = fnList.map((fn, i) => {
    let p: Promise<void>;
    return () => {
      p = (async () => {
        resList[i] = await fn();
        doneNum += 1;
        execPool.delete(p);
        callBack?.(doneNum, totalNum, resList, i);
      })();
      execPool.add(p);
    };
  });

  // oxlint-disable-next-line no-unmodified-loop-condition
  while (doneNum !== totalNum) {
    while (taskList.length > 0 && execPool.size < limit) taskList.shift()!();
    await Promise.race(execPool);
  }

  return resList;
};

/** Promise 并发队列 */
export class PQueue<T> {
  wait = new Set<T>();
  running = new Set<T>();
  done = new Set<T>();

  private readonly handleTask: (item: T) => Promise<unknown>;
  public concurrency: number;

  constructor(handleTask: (item: T) => Promise<unknown>, concurrency = 1) {
    this.handleTask = handleTask;
    this.concurrency = concurrency;
  }

  public has = (item: T): boolean =>
    this.running.has(item) || this.done.has(item) || this.wait.has(item);

  private async processQueue(): Promise<void> {
    if (this.running.size >= this.concurrency || this.wait.size === 0) return;

    const [item] = this.wait;
    if (item === undefined) return;
    this.wait.delete(item);

    if (!this.running.has(item)) {
      try {
        this.running.add(item);
        await this.handleTask(item);
        this.done.add(item);
      } catch (error) {
        console.error(error);
      } finally {
        this.running.delete(item);
      }
    }
    return this.processQueue();
  }

  public add(item: T): void {
    if (this.has(item)) return;
    this.wait.add(item);
    void this.processQueue();
  }

  public set(...items: T[]): void {
    this.wait.clear();
    this.wait = new Set(items.filter((item) => !this.has(item)));
    void this.processQueue();
  }

  public clear(): void {
    this.wait.clear();
    this.done.clear();
  }
}

/**
 * 重复执行传入的函数，直到其返回真值或超时
 *
 * @param fn - 条件判断函数
 * @param timeout - 超时时间（毫秒），默认为 Infinity
 * @param waitTime - 轮询间隔时间（毫秒），默认为 100
 */
export async function wait<T>(
  fn: () => Promisable<T | undefined>,
): Promise<TrueValue<T>>;
export async function wait<T>(
  fn: () => Promisable<T>,
  timeout?: number,
  waitTime?: number,
): Promise<T>;
// oxlint-disable-next-line func-style
export async function wait<T>(
  fn: () => Promisable<T>,
  timeout = Infinity,
  waitTime = 100,
) {
  let res: T | undefined = await fn();
  let _timeout = timeout;
  while (_timeout > 0 && !res) {
    await sleep(waitTime);
    _timeout -= waitTime;
    res = await fn();
  }
  return res;
}
