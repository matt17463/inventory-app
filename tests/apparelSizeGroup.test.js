import test from 'node:test';
import assert from 'node:assert/strict';
import {apparelSizeGroup} from '../src/lib/apparelSizeGroup.js';
test('unambiguous youth size codes',()=>{for(const x of ['YS','YM','YL','YXL','YXS'])assert.equal(apparelSizeGroup(x),'youth')});
test('unambiguous adult size codes',()=>{for(const x of ['S','M','L','XL','2XL','A2XL'])assert.equal(apparelSizeGroup(x),'adult')});
test('unknown size is not guessed',()=>{for(const x of ['One Size','OSFA','6','Toddler 4T',''])assert.equal(apparelSizeGroup(x),'')});
