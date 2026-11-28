// Which page he opens after a search, and which pages he clicks past when he browses.
import assert from 'node:assert/strict';
import { searchTerms, hitScore, bestHits, dullPage } from '../research.js';

const hit = (title, snippet = '') => ({ title, snippet });
const first = (q, hits) => bestHits(q, hits)[0].title;

// ---- the question is cut down to the thing
assert.deepEqual(searchTerms('how to build a small wooden corner shelf'), { core: 'wooden corner shelf', head: 'shelf' });
assert.deepEqual(searchTerms('to build a small clumsy shelf for the corner'), { core: 'shelf', head: 'shelf' });
assert.deepEqual(searchTerms('how to design and print a small gear'), { core: 'gear', head: 'gear' });
assert.deepEqual(searchTerms('riding a bike'), { core: 'riding bike', head: 'bike' });
assert.deepEqual(searchTerms('kite'), { core: 'kite', head: 'kite' });
assert.equal(searchTerms('how to play chess').head, 'chess');
assert.equal(searchTerms('flying model planes').head, 'planes');
assert.equal(searchTerms('how to draw').core, 'how to draw', 'nothing left: the whole question stays');
assert.equal(searchTerms('why is the sky blue').head, '', 'a why-question has no single thing at the end');
assert.equal(searchTerms('what is a marimba').head, 'marimba');
assert.equal(searchTerms('').head, '');

// ---- the searches that went wrong live now open the thing itself
assert.equal(first('how to build a small wooden corner shelf', [
  hit('Russian wooden architecture', 'wooden churches built of logs in the corner joints'),
  hit('Corner Gas', 'a Canadian sitcom'),
  hit('Shelf (storage)', 'a flat horizontal plane used to hold items'),
  hit('Continental shelf', 'a portion of a continent that is submerged'),
]), 'Shelf (storage)');
assert.equal(first('to build a small clumsy shelf for the corner', [
  hit('Glossary of baseball terms', 'a clumsy fielder in the corner'),
  hit('Shelf (storage)', 'a flat horizontal plane'),
  hit('Shelf life', 'the length of time a commodity may be stored'),
]), 'Shelf (storage)');
assert.equal(first('how to design and print a small gear', [
  hit('Web-to-print', 'print design ordered over the web'),
  hit('Gear', 'a rotating machine part with teeth'),
  hit('Top Gear', 'a British television series'),
  hit('List of gear nomenclature', 'terms'),
]), 'Gear');
assert.equal(first('simple clay pottery for beginners', [hit('Ocarina', 'a clay wind instrument'), hit('Roseville Pottery', 'a company'), hit('Pottery', 'making vessels from clay')]), 'Pottery', 'the old case still works');
assert.equal(first('riding a bike', [hit('Riding Bean', 'a 1989 anime'), hit('Bicycle', 'a bike is a pedal-driven vehicle'), hit('Bike (magazine)', 'a magazine'), hit('Bike', 'bike may mean a bicycle or motorcycle')]), 'Bike');
assert.ok(hitScore('kite', hit('Kite')) > hitScore('kite', hit('Kite Runner')), 'the page that IS the thing beats a name with the word in it');
assert.ok(hitScore('kite', hit('Kite')) > hitScore('kite', hit('List of kite festivals')));
assert.equal(first('why is the sky blue', [hit('Blue', 'a colour'), hit('Diffuse sky radiation', 'why the sky is blue'), hit('Sky Blue (song)', 'a song')]) !== 'Sky Blue (song)', true);
assert.equal(bestHits('zzz', [hit('A'), hit('B')])[0].title, 'A', 'no match: Wikipedia’s own order stays');

// ---- browsing: he clicks past strangers, villages and sports seasons
assert.ok(dullPage({ title: 'Monowara Islam', text: 'Monowara Islam (born 1 January 1950) is a Bangladeshi politician.' }));
assert.ok(dullPage({ title: 'Jim Wallhead', text: 'James Wallhead is an English mixed martial artist, born in Loughborough in 1984.' }));
assert.ok(dullPage({ title: 'Krzywe', text: 'Krzywe is a village in the administrative district of Gmina Suwałki.' }));
assert.ok(dullPage({ title: '1987 Tour of Flanders', text: 'The race was held in April.' }));
assert.ok(dullPage({ title: 'Some club', text: 'The 2004–05 season was the club’s 12th season in the top league.' }));
assert.ok(!dullPage({ title: 'Winter', text: 'Winter is the coldest season of the year in polar and temperate climates.' }));
assert.ok(!dullPage({ title: 'Phonograph', text: 'A phonograph, later called a record player, is a device for the mechanical recording of sound.' }));
assert.ok(!dullPage({ title: 'Kite', text: 'A kite is a tethered heavier-than-air craft with wing surfaces that react against the air.' }));
assert.ok(!dullPage({ title: 'Marimba', text: 'The marimba is a musical instrument in the percussion family.' }));
assert.ok(!dullPage({}));
console.log('research: ok');
