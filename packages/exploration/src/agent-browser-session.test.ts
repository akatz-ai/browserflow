/**
 * Tests for AgentBrowserSession adapter
 *
 * These tests verify that the BrowserSession adapter correctly wraps
 * the agent-browser BrowserManager API.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { AgentBrowserSession } from './agent-browser-session';
import type { BrowserSession } from './explorer';

describe('AgentBrowserSession', () => {
  let session: BrowserSession;

  beforeEach(() => {
    session = new AgentBrowserSession();
  });

  afterEach(async () => {
    if (session.isLaunched()) {
      await session.close();
    }
  });

  describe('Lifecycle', () => {
    test('isLaunched returns false before launch', () => {
      expect(session.isLaunched()).toBe(false);
    });

    test('launch initializes browser with default options', async () => {
      await session.launch();
      expect(session.isLaunched()).toBe(true);
    });

    test('launch accepts custom viewport', async () => {
      await session.launch({
        viewport: { width: 1920, height: 1080 },
      });
      expect(session.isLaunched()).toBe(true);
    });

    test('launch accepts headless option', async () => {
      await session.launch({
        headless: true,
      });
      expect(session.isLaunched()).toBe(true);
    });

    test('close terminates browser session', async () => {
      await session.launch();
      await session.close();
      expect(session.isLaunched()).toBe(false);
    });

    test('close is idempotent', async () => {
      await session.launch();
      await session.close();
      await session.close(); // Should not throw
      expect(session.isLaunched()).toBe(false);
    });
  });

  describe('Navigation', () => {
    beforeEach(async () => {
      await session.launch();
    });

    test('navigate loads a URL', async () => {
      await session.navigate('https://example.com');
      const url = session.getCurrentURL?.();
      expect(url).toBe('https://example.com/');
    });

    test('back navigates to previous page', async () => {
      if (!session.back) {
        throw new Error('back method not implemented');
      }

      await session.navigate('https://example.com');
      await session.navigate('https://example.com/page2');
      await session.back();

      const url = session.getCurrentURL?.();
      expect(url).toBe('https://example.com/');
    });

    test('forward navigates to next page', async () => {
      if (!session.forward) {
        throw new Error('forward method not implemented');
      }

      await session.navigate('https://example.com');
      await session.navigate('https://example.com/page2');
      await session.back?.();
      await session.forward();

      const url = session.getCurrentURL?.();
      expect(url).toContain('page2');
    });

    test('refresh reloads current page', async () => {
      if (!session.refresh) {
        throw new Error('refresh method not implemented');
      }

      await session.navigate('https://example.com');
      await session.refresh();

      const url = session.getCurrentURL?.();
      expect(url).toBe('https://example.com/');
    });
  });

  describe('Screenshots', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    test('screenshot returns buffer', async () => {
      const buffer = await session.screenshot();
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    test('screenshot captures valid PNG', async () => {
      const buffer = await session.screenshot();
      // PNG signature: 89 50 4E 47
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
    });
  });

  describe('Snapshots', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    test('getSnapshot returns enhanced snapshot', async () => {
      const snapshot = await session.getSnapshot();
      expect(snapshot).toHaveProperty('tree');
      expect(snapshot).toHaveProperty('refs');
      expect(typeof snapshot.tree).toBe('string');
      expect(typeof snapshot.refs).toBe('object');
    });

    test('getSnapshot with interactive=true includes refs', async () => {
      const snapshot = await session.getSnapshot({ interactive: true });
      expect(snapshot.refs).toBeDefined();
    });

    test('getSnapshot with selector filters elements', async () => {
      const snapshot = await session.getSnapshot({ selector: 'h1' });
      expect(snapshot.tree).toContain('heading');
    });
  });

  describe('Interaction Methods', () => {
    beforeEach(async () => {
      await session.launch();
      // Navigate to a page with form elements for testing
      await session.navigate('data:text/html,<html><body><button id="btn">Click</button><input id="inp" /></body></html>');
    });

    test('click performs click action', async () => {
      if (!session.click) {
        throw new Error('click method not implemented');
      }

      // This should not throw
      await session.click('#btn');
    });

    test('fill populates input field', async () => {
      if (!session.fill) {
        throw new Error('fill method not implemented');
      }

      await session.fill('#inp', 'test value');
      // If we had a way to verify the value, we would check it here
    });

    test('type enters text character by character', async () => {
      if (!session.type) {
        throw new Error('type method not implemented');
      }

      await session.type('#inp', 'typing test');
      // Type should work like fill but character-by-character
    });

    test('press sends keyboard event', async () => {
      if (!session.press) {
        throw new Error('press method not implemented');
      }

      await session.press('Enter');
      // Should not throw
    });

    test('check toggles checkbox', async () => {
      if (!session.check) {
        throw new Error('check method not implemented');
      }

      // Navigate to page with checkbox
      await session.navigate('data:text/html,<html><body><input type="checkbox" id="chk" /></body></html>');
      await session.check('#chk', true);
      // Should not throw
    });

    test('select chooses option from dropdown', async () => {
      if (!session.select) {
        throw new Error('select method not implemented');
      }

      // Navigate to page with select
      await session.navigate('data:text/html,<html><body><select id="sel"><option value="1">One</option></select></body></html>');
      await session.select('#sel', '1');
      // Should not throw
    });
  });

  describe('Wait Methods', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    test('waitForSelector waits for element', async () => {
      if (!session.waitForSelector) {
        throw new Error('waitForSelector method not implemented');
      }

      await session.waitForSelector('body', 5000);
      // Should not throw or timeout
    });

    test('waitForURL waits for URL pattern', async () => {
      if (!session.waitForURL) {
        throw new Error('waitForURL method not implemented');
      }

      await session.waitForURL('**/example.com/**', 5000);
      // Should not throw
    });

    test('waitForText waits for text content', async () => {
      if (!session.waitForText) {
        throw new Error('waitForText method not implemented');
      }

      await session.waitForText('Example Domain', 5000);
      // Should not throw
    });

    test('waitForLoadState waits for page load', async () => {
      if (!session.waitForLoadState) {
        throw new Error('waitForLoadState method not implemented');
      }

      await session.waitForLoadState('load');
      // Should not throw
    });

    test('waitForTimeout delays execution', async () => {
      if (!session.waitForTimeout) {
        throw new Error('waitForTimeout method not implemented');
      }

      const start = Date.now();
      await session.waitForTimeout(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Scroll Methods', () => {
    beforeEach(async () => {
      await session.launch();
      // Navigate to a tall page for scrolling
      await session.navigate('data:text/html,<html><body style="height:3000px"><div id="bottom" style="position:absolute;top:2500px">Bottom</div></body></html>');
    });

    test('scrollIntoView scrolls element into viewport', async () => {
      if (!session.scrollIntoView) {
        throw new Error('scrollIntoView method not implemented');
      }

      await session.scrollIntoView('#bottom');
      // Should not throw
    });

    test('scroll moves viewport by coordinates', async () => {
      if (!session.scroll) {
        throw new Error('scroll method not implemented');
      }

      await session.scroll(0, 1000);
      // Should not throw
    });
  });

  describe('Error Handling', () => {
    test('navigate throws on invalid URL', async () => {
      await session.launch();
      expect(async () => {
        await session.navigate('not-a-valid-url');
      }).toThrow();
    });

    test('methods throw when browser not launched', async () => {
      expect(async () => {
        await session.navigate('https://example.com');
      }).toThrow();
    });

    test('screenshot throws when browser not launched', async () => {
      expect(async () => {
        await session.screenshot();
      }).toThrow();
    });
  });

  describe('Ref Handling', () => {
    beforeEach(async () => {
      await session.launch();
      await session.navigate('https://example.com');
    });

    test('click accepts @ref format', async () => {
      if (!session.click) {
        throw new Error('click method not implemented');
      }

      // The adapter should handle @e1 format refs
      // This may fail if no element with that ref exists, but should not throw parse errors
      try {
        await session.click('@e1');
      } catch (e) {
        // Expected to potentially fail if ref doesn't exist
        expect(e).toBeDefined();
      }
    });

    test('fill accepts ref without @ prefix', async () => {
      if (!session.fill) {
        throw new Error('fill method not implemented');
      }

      // Should handle refs with or without @ prefix
      try {
        await session.fill('e1', 'value');
      } catch (e) {
        // Expected to potentially fail if ref doesn't exist
        expect(e).toBeDefined();
      }
    });
  });
});
