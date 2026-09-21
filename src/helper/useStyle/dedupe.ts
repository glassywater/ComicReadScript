import { getOwner, onCleanup } from 'solid-js';

export type CssArg = string | number | boolean | null | undefined | object;
type CssRecordArg = CssArg | WeakRef<Element>;

/** 记录已执行过的 css 调用参数，以便跳过重复调用 */
const cssRecords: CssRecordArg[][] = [];

/** 记录本次调用的参数，若与已有记录完全相同，则返回 false 表示重复了 */
export const recordCssArgs = (args: CssRecordArg[]) => {
  // 清理 Element 已被回收的失效记录
  for (let i = cssRecords.length - 1; i >= 0; i--) {
    if (
      cssRecords[i].some(
        (arg) => arg instanceof WeakRef && arg.deref() === undefined,
      )
    )
      cssRecords.splice(i, 1);
  }

  const isRepeated = cssRecords.some(
    (record) =>
      record.length === args.length &&
      record.every((saved, i) => {
        if (saved instanceof WeakRef) {
          const el = saved.deref();
          return el !== undefined && el === args[i];
        }
        return saved === args[i];
      }),
  );
  if (isRepeated) return false;

  const record = args.map((arg) =>
    arg instanceof Element ? new WeakRef(arg) : arg,
  );
  cssRecords.push(record);

  // 有响应式 owner 时，样式会随作用域卸载被移除，记录也同步删除
  if (getOwner())
    onCleanup(() => {
      const index = cssRecords.indexOf(record);
      if (index !== -1) cssRecords.splice(index, 1);
    });

  return true;
};
