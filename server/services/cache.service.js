import { LRUCache } from 'lru-cache';

const options = {
  max: 1,
  ttl: 300000, // 5 minutes in milliseconds
};

const cache = new LRUCache(options);

export function get(key) {
  return cache.get(key);
}

export function set(key, value) {
  return cache.set(key, value);
}

export function del(key) {
  return cache.delete(key);
}

export function flush() {
  return cache.clear();
}

export default { get, set, del, flush };
