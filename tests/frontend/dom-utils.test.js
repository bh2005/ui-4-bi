/**
 * Tests für js/utils/dom-utils.js
 *   - escHtml: HTML-Sonderzeichen maskieren
 */
import { describe, it, expect } from 'vitest';
import { escHtml } from '../../src/js/utils/dom-utils.js';

describe('escHtml', () => {
  it('maskiert &', () => {
    expect(escHtml('a & b')).toBe('a &amp; b');
  });

  it('maskiert <', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('maskiert "', () => {
    expect(escHtml('"quoted"')).toBe('&quot;quoted&quot;');
  });

  it('maskiert alle Sonderzeichen gleichzeitig', () => {
    expect(escHtml('<a href="x">AT&T</a>')).toBe(
      '&lt;a href=&quot;x&quot;&gt;AT&amp;T&lt;/a&gt;'
    );
  });

  it('lässt normalen Text unverändert', () => {
    expect(escHtml('hello world')).toBe('hello world');
  });

  it('konvertiert nicht-String-Werte via String()', () => {
    expect(escHtml(42)).toBe('42');
    expect(escHtml(null)).toBe('null');
  });
});
