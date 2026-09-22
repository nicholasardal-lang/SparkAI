import assert from 'node:assert/strict';
import {selectModel,modelCredits} from '../lib/spark/models.ts';
import {creditQuote} from '../lib/spark/core.ts';
const prompt='Build a castle obby';
const history=[{role:'user',content:prompt}];
const quote=creditQuote({},history,{});
assert.equal(quote.selection.model,'gpt-5.6-terra');
assert.equal(quote.selection.reasoning,'medium');
assert.equal(quote.maxOutput,24576); // Preserve enough room for complete files.
assert.equal(quote.timeoutMs,240000);
const previousMaximum=modelCredits('gpt-6-astra',Math.ceil(quote.inputEstimate*1.15)+128,quote.maxOutput);
assert.ok(quote.maxCredits<previousMaximum*.25);
for(const followup of ['continue','Now add checkpoints','fix it']) {
  assert.equal(selectModel(followup,history).model,'gpt-5.6-terra');
  assert.equal(selectModel(followup,[],undefined,quote.selection).model,'gpt-5.6-terra');
}
assert.equal(selectModel('Now add a secure DataStore inventory system',history).model,'gpt-6-astra');
assert.equal(selectModel(prompt,[],'gpt-6-astra').model,'gpt-6-astra');
assert.equal(selectModel('What is a variable?',history).model,'gpt-5-mini');
console.log('Economical builds retain scope, follow-up routing and advanced overrides; maximum quote drops over 75%.');
