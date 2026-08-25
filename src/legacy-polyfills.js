/**
 * Runtime polyfills for legacy Android WebView (Chrome 66 on Ugoos AM6B Plus).
 * Must load before zone.js and the application bundles.
 */
(function applyLegacyPolyfills() {
  var root =
    typeof self !== 'undefined' ? self :
    typeof window !== 'undefined' ? window :
    Function('return this')();

  if (root && typeof root.globalThis === 'undefined') {
    root.globalThis = root;
  }

  if (!Array.prototype.flat) {
    Array.prototype.flat = function flat(depth) {
      var d = depth === undefined ? 1 : Math.floor(depth);
      function flatten(arr, currentDepth) {
        return currentDepth > 0
          ? arr.reduce(function (acc, val) {
              return acc.concat(Array.isArray(val) ? flatten(val, currentDepth - 1) : val);
            }, [])
          : arr.slice();
      }
      return flatten(this, d);
    };
  }

  if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function flatMap(callback, thisArg) {
      return this.map(callback, thisArg).flat(1);
    };
  }

  if (!Promise.allSettled) {
    Promise.allSettled = function allSettled(iterable) {
      return Promise.all(
        Array.from(iterable).map(function (entry) {
          return Promise.resolve(entry).then(
            function (value) { return { status: 'fulfilled', value: value }; },
            function (reason) { return { status: 'rejected', reason: reason }; }
          );
        })
      );
    };
  }

  if (typeof root.queueMicrotask !== 'function') {
    root.queueMicrotask = function queueMicrotask(callback) {
      Promise.resolve().then(callback);
    };
  }
})();
