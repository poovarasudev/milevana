// In-memory AsyncStorage stand-in for the node emulator suite (localFlags
// imports @react-native-async-storage/async-storage, which needs RN internals
// a plain node environment does not have). Same shape the jest mock provides.
const store = new Map();

const AsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, String(v)); },
  removeItem: async (k) => { store.delete(k); },
  getAllKeys: async () => [...store.keys()],
  multiGet: async (keys) => keys.map((k) => [k, store.has(k) ? store.get(k) : null]),
  multiSet: async (pairs) => { for (const [k, v] of pairs) store.set(k, String(v)); },
  multiRemove: async (keys) => { for (const k of keys) store.delete(k); },
  mergeItem: async (k, v) => {
    const cur = store.get(k);
    store.set(k, cur == null ? String(v) : cur + String(v));
  },
  clear: async () => store.clear(),
  flushGetRequests: () => undefined,
};

module.exports = AsyncStorage;
module.exports.default = AsyncStorage;
