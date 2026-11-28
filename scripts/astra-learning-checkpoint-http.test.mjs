import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const body=readFileSync('.github/workflows/astra-learning-memory-checkpoint.yml','utf8');
test('learning checkpoint fails closed and never retries permanent HTTP 404',()=>{
 assert.match(body,/status=\$\(curl -sS/);
 assert.match(body,/case "\$status" in/);
 assert.match(body,/000\|408\|429\|500\|502\|503\|504/);
 assert.match(body,/non-transient, no retry/);
 assert.match(body,/ASTRA_LEARNING_CHECKPOINT_SCHEMA_OR_REFRESH_FAILED/);
 assert.match(body,/test -s \/tmp\/runtime-learning-checkpoint\.json/);
 assert.doesNotMatch(body,/curl -fsS/);
});
