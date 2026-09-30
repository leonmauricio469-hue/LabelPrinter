import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// CONTRACT test: next dev / next start listen on 0.0.0.0 unless -H is given
// (https://nextjs.org/docs/app/api-reference/cli/next). Print and settings routes have no
// authentication, so the app must only be reachable from the workstation itself.
const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

for (const script of ["dev", "start"]) {
  test(`npm run ${script} listens only on this workstation`, () => {
    assert.match(pkg.scripts[script], /(-H|--hostname) 127\.0\.0\.1\b/, pkg.scripts[script]);
  });
}
