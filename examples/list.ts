import * as wordnet from '../lib/wordnet';

(async () => {
  await wordnet.init();

  let results: string[] = await wordnet.list();

  console.dir(results, { depth: null, colors: true });
})();
