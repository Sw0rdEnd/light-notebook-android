import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReviewBrief} from '../app/src/main/assets/www/ai-prompt.js';
import {createAiTask} from '../app/src/main/assets/www/ai-task.js';

test('local prompt optimization keeps the question, focuses on requested topics and shares native fixtures',async()=>{
 const fixtures=JSON.parse(await fs.readFile(new URL('./fixtures/ai-prompts.json',import.meta.url)));
 for(const fixture of fixtures){const brief=createReviewBrief(fixture.note,fixture.mode);assert.equal(brief.schema,'light-journal.ai-brief.v1');assert.equal(brief.question,fixture.question);assert.deepEqual(brief.focus,fixture.focus);assert.equal(brief.steps.length,fixture.steps);assert.match(brief.goal,fixture.mode==='compare'?/A\/B/:/这张照片/);}
 assert.equal(createReviewBrief('字'.repeat(1500)).question.length,1000);
});

test('AI task deadline works without modern AbortSignal helpers and disposes completed timers',async()=>{
 const any=Object.getOwnPropertyDescriptor(AbortSignal,'any'),timeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
 Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});
 try{
  const expired=createAiTask({timeoutMs:10});await new Promise(resolve=>expired.signal.addEventListener('abort',resolve,{once:true}));assert.equal(expired.timedOut,true);expired.dispose();
  const done=createAiTask({timeoutMs:10});done.dispose();await new Promise(resolve=>setTimeout(resolve,25));assert.equal(done.signal.aborted,false);
  const cancelled=createAiTask({timeoutMs:100});cancelled.abort();assert.equal(cancelled.signal.aborted,true);assert.equal(cancelled.timedOut,false);
 }finally{Object.defineProperty(AbortSignal,'any',any);Object.defineProperty(AbortSignal,'timeout',timeout);}
});
