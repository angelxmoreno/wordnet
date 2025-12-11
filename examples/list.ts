import * as wordnet from '../lib/wordnet';

(async () => {
    await wordnet.init();

    const results: string[] = wordnet.list();

    console.dir(results, { depth: null, colors: true });
})();
