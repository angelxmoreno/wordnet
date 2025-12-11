import * as wordnet from '../lib/wordnet';

(async () => {
  await wordnet.init();

  let results: string[] = wordnet.list();

  console.dir(results, { depth: null, colors: true });
})();
