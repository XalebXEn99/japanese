import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccountButton } from '../src/components/Account';

vi.mock('../src/lib/auth', () => ({ authClient: null }));

describe('header account button', () => {
  it.each([
    { name: 'alice Stone', initial: 'A' },
    { name: '  Bob Stone  ', initial: 'B' },
    { name: '\u5f69\u82b1', initial: '\u5f69' },
    { name: 'e\u0301mile', initial: '\u00c9' },
    { name: '', initial: 'A' },
    { name: undefined, initial: 'A' },
  ])('shows only $initial for $name', ({ name, initial }) => {
    const markup = renderToStaticMarkup(createElement(AccountButton, {
      user: { id: 'test-user', email: 'learner@example.test', name }, ready: true, onClick: () => undefined,
    }));
    expect(markup).toContain(`>${initial}</button>`);
    expect(markup).toContain('account-avatar');
    expect(markup).toContain(`aria-label="Account: ${name?.trim() || 'Account'}"`);
  });

  it('keeps Sign in for guests and the connecting state while restoring a session', () => {
    const props = { user: null, onClick: () => undefined };
    const guest = renderToStaticMarkup(createElement(AccountButton, { ...props, ready: true }));
    expect(guest).toContain('>Sign in</button>');
    expect(guest).not.toContain('account-avatar');
    const loading = renderToStaticMarkup(createElement(AccountButton, { ...props, ready: false }));
    expect(loading).toContain('>Connecting\u2026</button>');
  });
});
