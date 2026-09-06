/**
 * 创建顺序递增的数组，支持多种调用方式
 *
 * 根据传入参数的不同，`range` 有以下几种用法：
 *
 * 1. `range(a)`：创建 `[0, 1, ..., a - 1]`
 *    ```ts
 *    range(5); // [0, 1, 2, 3, 4]
 *    ```
 *
 * 2. `range(a, b)`：创建 `[a, a + 1, ..., b - 1]`（不含 `b`）
 *    ```ts
 *    range(3, 7); // [3, 4, 5, 6]
 *    ```
 *
 * 3. `range(a, b, c)`：遍历 `a` 到 `b - 1`，每个元素经映射函数 `c` 转换
 *    ```ts
 *    range(3, 7, (i) => i * 10); // [30, 40, 50, 60]
 *    ```
 *
 * 4. `range(a, c)`：遍历 `0` 到 `a - 1`，每个元素经映射函数 `c` 转换
 *    ```ts
 *    range(4, (i) => `item-${i}`); // ['item-0', 'item-1', 'item-2', 'item-3']
 *    ```
 *
 * 5. `range(a, value)`：创建长度为 `a`、元素全部为 `value`（字符串）的数组
 *    ```ts
 *    range(3, 'x'); // ['x', 'x', 'x']
 *    ```
 */
export function range(a: number, b?: number): number[];
export function range<T = number>(a: number, b: (K: number) => T): T[];
// oxlint-disable-next-line typescript/unified-signatures
export function range<T = number>(a: number, b: T): T[];
export function range<T = number>(
  a: number,
  b: number,
  c: (K: number) => T,
): T[] | number[];
// oxlint-disable-next-line func-style
export function range<T = number>(
  a: number,
  b?: number | T | ((K: number) => T),
  c?: (K: number) => T,
) {
  switch (typeof b) {
    case 'undefined':
      return [...Array.from({ length: a }).keys()];

    case 'number': {
      const list: (T | number)[] = [];
      for (let i = a; i < b; i++) list.push(c ? c(i) : i);
      return list;
    }

    case 'function':
      return Array.from<T, T>({ length: a }, (_, i) =>
        (b as (K: number) => T)(i),
      );

    case 'string':
      return Array.from<string, string>({ length: a }, () => b);
  }
}

/** 根据范围文本提取指定范围的元素的 index */
export const extractRange = (rangeText: string, length: number) => {
  const list = new Set<number>();
  for (const text of rangeText.replaceAll(/[^\d,-]/gu, '').split(',')) {
    if (/^\d+$/u.test(text)) list.add(Number(text) - 1);
    else if (/^\d*-\d*$/u.test(text)) {
      let [start, end] = text.split('-').map(Number);
      end ||= length;
      for (start--, end--; start <= end; start++) list.add(start);
    }
  }
  return list;
};

/** extractRange 的逆向，按照相同的语法表述一个结果数组 */
export const descRange = (list: Iterable<number>, length: number) => {
  let text = '';
  const nowRange: number[] = [];
  const pushRange = (newIndex?: number) => {
    if (nowRange.length === 0) return;

    if (text.length > 0) text += ', ';
    if (nowRange.length === 1) text += nowRange[0] + 1;
    else {
      const end =
        newIndex === undefined && nowRange[1] === length - 1
          ? ''
          : nowRange[1] + 1;
      text += `${nowRange[0] + 1}-${end}`;
    }

    nowRange.length = 0;
    if (newIndex !== undefined) nowRange[0] = newIndex;
  };

  for (const i of list) {
    switch (nowRange.length) {
      case 0:
        nowRange[0] = i;
        break;
      case 1:
        if (i === nowRange[0] + 1) nowRange[1] = i;
        else pushRange(i);
        break;
      case 2:
        if (i === nowRange[1] + 1) nowRange[1] = i;
        else pushRange(i);
        break;
    }
  }

  pushRange();
  return text;
};
