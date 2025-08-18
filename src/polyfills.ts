// Polyfill per SockJS
(window as any).global = window;
(window as any).process = {
  env: { DEBUG: undefined },
  version: '',
  nextTick: function (fn: any) { setTimeout(fn, 0); }
};
