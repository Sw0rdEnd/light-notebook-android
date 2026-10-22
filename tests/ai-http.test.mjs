import test from 'node:test';
import assert from 'node:assert/strict';
import {createHttpProvider,aiServiceStatus} from '../app/src/main/assets/www/ai-http.js';
import {buildEvaluationRequest,requestEvaluation} from '../app/src/main/assets/www/ai.js';
const image='data:image/jpeg;base64,/9j/2Q==',photos=[{id:'a',name:'private-filename.jpg',preview:new Blob(['a']),exif:{focal:35,GPSLatitude:31},reasons:[]},{id:'b',name:'B.jpg',preview:new Blob(['b']),exif:{focal:85},reasons:[]}];
test('browser provider uploads only selected encoded previews and relevant metadata, then validates matching response',async()=>{
 const request=buildEvaluationRequest(photos),sent=[];const result=await requestEvaluation(request,{provider:createHttpProvider({photos,accessCode:'private-access-code',encode:async blob=>{assert.ok(blob instanceof Blob);return image;},fetchImpl:async(url,options)=>{sent.push({url,...options});return Response.json({schema:'light-journal.ai-result.v1',requestId:request.requestId,status:'ok',summary:'测试结果',observations:[],nextSteps:[],preferred:'B'});}})});
 const body=JSON.parse(sent[0].body);assert.equal(sent[0].url,'/api/ai/evaluate');assert.equal(body.photos.length,2);assert.equal(body.photos[1].image,image);assert.equal(result.preferred,'B');
 assert.ok(!sent[0].body.includes('private-filename'));assert.ok(!sent[0].body.includes('GPSLatitude'));assert.ok(!sent[0].body.includes('localPreview'));assert.ok(!sent[0].body.includes('private-access-code'));assert.equal(sent[0].headers.Authorization,'Bearer private-access-code');
});
test('disabled/missing status never uploads images and cancellation during compression never starts the HTTP evaluation',async()=>{
 const calls=[];const status=await aiServiceStatus({fetchImpl:async(url)=>{calls.push(url);return new Response('not found',{status:404});}});assert.equal(status.enabled,false);assert.deepEqual(calls,['/api/ai/status']);
 const controller=new AbortController();let uploads=0;const provider=createHttpProvider({photos,accessCode:'code',signal:controller.signal,encode:async()=>{controller.abort();return image;},fetchImpl:async()=>{uploads++;throw new Error('must not happen');}});
 await assert.rejects(provider.evaluate(buildEvaluationRequest(photos)));assert.equal(uploads,0);
});
test('HTTP authentication/quota errors are displayed as failures and never validated as successful AI output',async()=>{
 const provider=createHttpProvider({photos,accessCode:'wrong',encode:async()=>image,fetchImpl:async()=>Response.json({code:'ACCESS_DENIED',message:'AI访问口令无效'},{status:401})});
 await assert.rejects(requestEvaluation(buildEvaluationRequest(photos),{provider}),/口令无效/);
});
