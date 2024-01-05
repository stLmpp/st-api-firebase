import { Class } from 'type-fest';

export function getClazz<T>(): Class<T> {
  return class {} as Class<T>;
}
