import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchComboboxOption} from '../dist/adapters/combobox-options.js';
const options = labels => labels.map(label=>({label,value:label}));
test('location options retain both city and country, allowing an inserted province',()=>{
  assert.equal(matchComboboxOption(options(['Buenos Aires, Buenos Aires, Argentina','Buenos Aires, Mexico']), 'Buenos Aires, Argentina', 'location').label, 'Buenos Aires, Buenos Aires, Argentina');
  assert.equal(matchComboboxOption(options(['São Paulo, SP, Brazil']), 'Sao Paulo, Brazil', 'location').label, 'São Paulo, SP, Brazil');
});
test('locations never choose a different country, ambiguous cities or an inferred city',()=>{
  assert.equal(matchComboboxOption(options(['London, Ontario, Canada']), 'London, United Kingdom', 'location'), null);
  assert.equal(matchComboboxOption(options(['Springfield, Illinois, USA','Springfield, Missouri, USA']), 'Springfield, USA', 'location'), null);
  assert.equal(matchComboboxOption(options(['Buenos Aires, Argentina']), 'Argentina', 'location'), null);
  assert.equal(matchComboboxOption(options(['London, Ontario, Canada']), 'London, Quebec, Canada', 'location'), null);
});
test('non-location fields only accept exact offered options',()=>{
  assert.equal(matchComboboxOption(options(['Senior Manager']), 'Manager', null), null);
  assert.equal(matchComboboxOption(options(['Argentina']), 'Argentina', 'country').value, 'Argentina');
});

test('Portuguese and Spanish identity labels map to complete profile facts', async()=>{
  const {canonicalKeyFor}=await import('../dist/adapters/field-map.js');
  for(const label of ['Nome','Nome completo','Nombre completo','Nombre y apellido']) assert.equal(canonicalKeyFor(label),'full_name');
  assert.equal(canonicalKeyFor('Primeiro nome'),'first_name');
  assert.equal(canonicalKeyFor('Sobrenome'),'last_name');
  assert.equal(canonicalKeyFor('Telefone'),'phone');
  assert.equal(canonicalKeyFor('Currículo'),'resume');
  assert.equal(canonicalKeyFor('Carta de apresentação'),'cover_letter');
});
