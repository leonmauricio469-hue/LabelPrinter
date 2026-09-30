// Lets `node --test` load the app's extensionless relative imports ("./ean13") the way
// Next's bundler does, without adding a TypeScript runner as a dependency.
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (err?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.startsWith(".")) throw err;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});
