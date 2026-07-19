/* =========================================================
   QA Foundry — Test Engine
   A small Jest-style framework (describe/it/expect) that runs
   entirely in the browser. Used for both "unit" and
   "integration" suites — integration suites are free to use
   real fetch() calls, timers, etc. inside their tests.
   ========================================================= */
(function () {
  function stringify(v) {
    try {
      if (typeof v === "string") return `"${v}"`;
      if (v instanceof Error) return `Error: ${v.message}`;
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  function deepEqual(a, b) {
    if (Object.is(a, b)) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== "object") return false;
    const ak = Object.keys(a), bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) => deepEqual(a[k], b[k]));
  }

  function makeExpect() {
    return function expect(actual) {
      const base = {
        toBe(expected) {
          if (!Object.is(actual, expected)) throw new Error(`Expected ${stringify(actual)} to be ${stringify(expected)}`);
        },
        toEqual(expected) {
          if (!deepEqual(actual, expected)) throw new Error(`Expected ${stringify(actual)} to equal ${stringify(expected)}`);
        },
        toBeTruthy() {
          if (!actual) throw new Error(`Expected ${stringify(actual)} to be truthy`);
        },
        toBeFalsy() {
          if (actual) throw new Error(`Expected ${stringify(actual)} to be falsy`);
        },
        toBeNull() {
          if (actual !== null) throw new Error(`Expected ${stringify(actual)} to be null`);
        },
        toBeUndefined() {
          if (actual !== undefined) throw new Error(`Expected ${stringify(actual)} to be undefined`);
        },
        toBeDefined() {
          if (actual === undefined) throw new Error(`Expected value to be defined`);
        },
        toBeGreaterThan(n) {
          if (!(actual > n)) throw new Error(`Expected ${stringify(actual)} to be greater than ${n}`);
        },
        toBeGreaterThanOrEqual(n) {
          if (!(actual >= n)) throw new Error(`Expected ${stringify(actual)} to be >= ${n}`);
        },
        toBeLessThan(n) {
          if (!(actual < n)) throw new Error(`Expected ${stringify(actual)} to be less than ${n}`);
        },
        toBeLessThanOrEqual(n) {
          if (!(actual <= n)) throw new Error(`Expected ${stringify(actual)} to be <= ${n}`);
        },
        toContain(item) {
          const ok = actual && typeof actual.includes === "function" && actual.includes(item);
          if (!ok) throw new Error(`Expected ${stringify(actual)} to contain ${stringify(item)}`);
        },
        toHaveLength(n) {
          if (!actual || actual.length !== n) throw new Error(`Expected length ${n}, got ${actual ? actual.length : "undefined"}`);
        },
        toMatch(re) {
          const regex = re instanceof RegExp ? re : new RegExp(re);
          if (!regex.test(actual)) throw new Error(`Expected ${stringify(actual)} to match ${regex}`);
        },
        toThrow(msgFragment) {
          if (typeof actual !== "function") throw new Error("toThrow() requires a function");
          let threw = false, errMsg = "";
          try { actual(); } catch (e) { threw = true; errMsg = e.message || String(e); }
          if (!threw) throw new Error(`Expected function to throw`);
          if (msgFragment && !errMsg.includes(msgFragment)) throw new Error(`Expected thrown message to include "${msgFragment}", got "${errMsg}"`);
        },
        toBeInstanceOf(cls) {
          if (!(actual instanceof cls)) throw new Error(`Expected ${stringify(actual)} to be instance of ${cls.name}`);
        },
      };
      base.not = new Proxy({}, {
        get(_, prop) {
          return (...args) => {
            let threw = false;
            try { base[prop](...args); } catch { threw = true; }
            if (!threw) throw new Error(`Expected NOT ${prop}(${args.map(stringify).join(", ")}) to fail, but it passed`);
          };
        },
      });
      return base;
    };
  }

  // ---------- Collection phase: run user code with describe/it stubs ----------
  function collect(code) {
    const root = { name: "(root)", tests: [], children: [], beforeEachFns: [], afterEachFns: [] };
    const stack = [root];
    const errors = [];

    function describe(name, fn) {
      const suite = { name, tests: [], children: [], beforeEachFns: [], afterEachFns: [] };
      stack[stack.length - 1].children.push(suite);
      stack.push(suite);
      try { fn(); } catch (e) { errors.push(`describe("${name}") threw during setup: ${e.message}`); }
      stack.pop();
    }
    function it(name, fn) { stack[stack.length - 1].tests.push({ name, fn, skip: false }); }
    function xit(name, fn) { stack[stack.length - 1].tests.push({ name, fn, skip: true }); }
    function beforeEach(fn) { stack[stack.length - 1].beforeEachFns.push(fn); }
    function afterEach(fn) { stack[stack.length - 1].afterEachFns.push(fn); }

    const expect = makeExpect();

    try {
      const runner = new Function("describe", "it", "xit", "beforeEach", "afterEach", "expect", code);
      runner(describe, it, xit, beforeEach, afterEach, expect);
    } catch (e) {
      errors.push(`Script error: ${e.message}`);
    }
    return { root, errors };
  }

  // ---------- Execution phase: walk the tree, run tests (supports async) ----------
  async function runTree(suite, parentHooks, results, path) {
    const hooks = {
      before: [...parentHooks.before, ...suite.beforeEachFns],
      after: [...suite.afterEachFns, ...parentHooks.after],
    };
    for (const test of suite.tests) {
      const fullName = [...path, test.name].join(" › ");
      if (test.skip) { results.push({ name: fullName, status: "skipped" }); continue; }
      const start = performance.now();
      try {
        for (const h of hooks.before) await h();
        await test.fn();
        for (const h of hooks.after) await h();
        results.push({ name: fullName, status: "pass", duration: performance.now() - start });
      } catch (e) {
        results.push({ name: fullName, status: "fail", duration: performance.now() - start, error: e.message || String(e) });
      }
    }
    for (const child of suite.children) {
      await runTree(child, hooks, results, [...path, child.name]);
    }
  }

  async function runSuite(code, { timeoutMs = 8000 } = {}) {
    const { root, errors } = collect(code);
    const results = [];
    if (errors.length) {
      return { results: [], errors, summary: { total: 0, passed: 0, failed: 0, skipped: 0 } };
    }
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Test run timed out (possible infinite loop or unresolved promise)")), timeoutMs));
    try {
      await Promise.race([runTree(root, { before: [], after: [] }, results, []), timeout]);
    } catch (e) {
      errors.push(e.message);
    }
    const summary = {
      total: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      skipped: results.filter((r) => r.status === "skipped").length,
    };
    return { results, errors, summary };
  }

  window.QAFTestEngine = { runSuite };
})();
