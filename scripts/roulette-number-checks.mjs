import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const jsx = require("react/jsx-runtime");
const source = fs.readFileSync(new URL("../components/RouletteNumber.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const equalDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));

// Exercise the real component with batched hook updates and a deterministic
// browser clock. Each timer callback commits before the next callback runs.
function numberHarness(value, startTime = 1000) {
  const slots = [], effects = new Map(), timers = new Map();
  let cursor = 0, changed = false, mounted = true, now = startTime, timerId = 0, tree;
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, (next) => {
        assert.ok(mounted, "a timer updated state after unmount");
        const resolved = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(resolved, slots[index].value)) {
          slots[index].value = resolved;
          changed = true;
        }
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect, deps) {
      const index = cursor++;
      if (!slots[index] || !equalDeps(slots[index].deps, deps)) {
        const cleanup = slots[index]?.cleanup;
        slots[index] = { deps, cleanup };
        effects.set(index, effect);
      }
    },
  };
  const browser = {
    setTimeout(callback, delay) {
      const id = ++timerId;
      timers.set(id, { callback, due: now + Math.max(0, delay) });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
  };
  const componentModule = { exports: {} };
  const imports = (name) => {
    if (name === "react") return hooks;
    if (name === "react/jsx-runtime") return jsx;
    throw new Error(`Unexpected RouletteNumber dependency ${name}`);
  };
  new Function("require", "module", "exports", "window", "performance", compiled)(imports, componentModule, componentModule.exports, browser, { now: () => now });
  const props = { value };

  function render() {
    assert.ok(mounted, "cannot render an unmounted component");
    for (let attempt = 0; attempt < 20; attempt++) {
      cursor = 0;
      changed = false;
      tree = componentModule.exports.RouletteNumber(props);
      if (changed) continue;
      const pending = [...effects.entries()];
      effects.clear();
      for (const [index, effect] of pending) {
        slots[index].cleanup?.();
        slots[index].cleanup = effect();
      }
      if (!changed) return tree;
    }
    throw new Error("RouletteNumber failed to settle");
  }
  function update(next) {
    props.value = next;
    return render();
  }
  function advance(milliseconds) {
    const target = now + milliseconds;
    for (let attempt = 0; attempt < 100; attempt++) {
      const entry = [...timers.entries()].filter(([, timer]) => timer.due <= target).sort((left, right) => left[1].due - right[1].due || left[0] - right[0])[0];
      if (!entry) {
        now = target;
        return tree;
      }
      const [id, timer] = entry;
      now = timer.due;
      timers.delete(id);
      timer.callback();
      if (changed && mounted) render();
    }
    throw new Error("RouletteNumber scheduled an unbounded timer loop");
  }
  function unmount() {
    for (const slot of slots) slot?.cleanup?.();
    mounted = false;
  }
  render();
  return { update, advance, unmount, timers, read: () => tree };
}

const children = (tree) => tree.props.children;
const spinning = (tree) => children(tree).filter((node) => node.props.className === "sg-roulette-slot");
function assertDigitStructure(tree, value) {
  assert.equal(tree.props["aria-label"], value);
  assert.equal(children(tree).length, value.length);
  const digitPositions = [];
  children(tree).forEach((node, index) => {
    assert.equal(node.props["aria-hidden"], "true");
    if (/\d/.test(value[index])) {
      digitPositions.push(index);
      assert.ok(["sg-roulette-digit", "sg-roulette-slot"].includes(node.props.className), "digits need an explicit slot both at rest and while moving");
      if (node.props.className === "sg-roulette-digit") assert.equal(node.props.children, value[index]);
      else {
        const reel = node.props.children;
        assert.equal(reel.props.className, "sg-roulette-reel");
        assert.equal(reel.props.children.at(-1).props.children, value[index]);
      }
    } else {
      assert.equal(node.props.children, value[index]);
      assert.equal(node.props.className, undefined);
    }
  });
  return digitPositions;
}

test("digit slots and punctuation retain their positions before, during and after a spin", () => {
  const number = numberHarness("£1,204.08");
  const before = assertDigitStructure(number.read(), "£1,204.08");
  assert.equal(spinning(number.read()).length, 0);
  number.update("£1,284.08");
  assert.equal(number.read().props["aria-label"], "£1,204.08");
  number.advance(0);
  assert.deepEqual(assertDigitStructure(number.read(), "£1,284.08"), before);
  assert.equal(spinning(number.read()).length, 1, "unchanged digits should stay still");
  number.advance(1000);
  assert.deepEqual(assertDigitStructure(number.read(), "£1,284.08"), before);
  assert.equal(spinning(number.read()).length, 0);
  assert.equal(number.timers.size, 0);
});

test("a fast reversion before the queued commit never flashes or spins the discarded value", () => {
  const number = numberHarness("£1000", 0);
  number.update("£1001");
  number.advance(30);
  number.update("£1000");
  number.advance(1000);
  assertDigitStructure(number.read(), "£1000");
  assert.equal(spinning(number.read()).length, 0);
  assert.equal(number.timers.size, 0);
});

test("rapid updates coalesce to the newest value and replace the previous settle timer", () => {
  const number = numberHarness("1234");
  number.update("1235");
  number.advance(0);
  assertDigitStructure(number.read(), "1235");
  number.update("1236");
  number.advance(20);
  number.update("1237");
  number.advance(50);
  number.update("1238");
  number.advance(33);
  assert.equal(number.read().props["aria-label"], "1235");
  number.advance(1);
  assertDigitStructure(number.read(), "1238");
  assert.equal(spinning(number.read()).length, 1);
  assert.equal(number.timers.size, 1, "only the newest settle timer should remain");
  number.advance(38); // The earlier animation would have settled now.
  assert.equal(spinning(number.read()).length, 1, "an old settle callback must not interrupt a newer animation");
  number.advance(1000);
  assertDigitStructure(number.read(), "1238");
  assert.equal(spinning(number.read()).length, 0);
  assert.equal(number.timers.size, 0);
});

test("reverting a pending update to an already spinning value preserves its original settle", () => {
  const number = numberHarness("1000");
  number.update("1001");
  number.advance(0);
  const currentSlotKey = spinning(number.read())[0].key;
  number.update("1002");
  number.advance(20);
  number.update("1001");
  number.advance(84);
  assertDigitStructure(number.read(), "1001");
  assert.equal(spinning(number.read())[0].key, currentSlotKey);
  number.advance(38);
  assert.equal(spinning(number.read()).length, 0);
  assert.equal(number.timers.size, 0);
});

test("unmount clears both a pending value commit and an active animation settle", () => {
  const pending = numberHarness("1234", 0);
  pending.update("5678");
  assert.equal(pending.timers.size, 1);
  pending.unmount();
  assert.equal(pending.timers.size, 0);
  pending.advance(1000);

  const active = numberHarness("1234");
  active.update("5678");
  active.advance(0);
  assert.equal(spinning(active.read()).length, 4);
  assert.equal(active.timers.size, 1);
  active.unmount();
  assert.equal(active.timers.size, 0);
  active.advance(1000);
});
