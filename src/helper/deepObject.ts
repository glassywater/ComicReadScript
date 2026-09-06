export { dequal as isEqual } from 'dequal';

/**
 * 求 a 和 b 的差集，相当于从 a 中删去和 b 相同的属性
 *
 * 不会修改参数对象，返回的是新对象
 */
export const difference = <T extends object>(a: T, b: T): Partial<T> => {
  const res = {};
  const keys = Object.keys(a);
  for (const key of keys) {
    if (typeof a[key] === 'object' && typeof b[key] === 'object') {
      const _res = difference(a[key], b[key]);
      if (Object.keys(_res).length > 0) res[key] = _res;
    } else if (a[key] !== b?.[key]) res[key] = a[key];
  }

  return res;
};

const _assign = <T extends object>(a: T, b: Partial<T>): T => {
  // oxlint-disable-next-line prefer-structured-clone
  const res = JSON.parse(JSON.stringify(a)) as T;
  const keys = Object.keys(b);
  for (const key of keys) {
    if (res[key] === undefined) res[key] = b[key];
    else if (typeof b[key] === 'object') {
      const _res = _assign(res[key], b[key]);
      if (Object.keys(_res).length > 0) res[key] = _res;
    } else if (res[key] !== b[key]) res[key] = b[key];
  }

  return res;
};

/**
 * Object.assign 的深拷贝版，不会导致子对象属性的缺失
 *
 * 不会修改参数对象，返回的是新对象
 */
export const assign = <T extends object>(
  target: T,
  ...sources: (Partial<T> | undefined)[]
): T => {
  let res = target;
  for (const source of sources)
    if (typeof source === 'object') res = _assign(res, source);
  return res;
};

/** 根据路径获取对象下的指定值 */
export const byPath = <T = object>(
  obj: object,
  path: string | string[],
  handleVal?: (parentObj: object, key: string) => unknown,
) => {
  const keys = typeof path === 'string' ? path.split('.') : path;
  let target: object = obj;
  for (let i = 0; i < keys.length; i++) {
    let key = keys[i];

    // 兼容含有「.」的 key
    while (!Reflect.has(target, key) && i < keys.length) {
      i += 1;
      if (keys[i] === undefined) break;
      key += `.${keys[i]}`;
    }

    if (handleVal && i > keys.length - 2 && Reflect.has(target, key)) {
      const res = handleVal(target, key);
      while (i < keys.length - 1) {
        target = target[key];
        i += 1;
        key = keys[i];
      }

      if (res !== undefined) target[key] = res;
      break;
    }

    target = target[key];
  }

  if (target === obj) return null;
  return target as T;
};
