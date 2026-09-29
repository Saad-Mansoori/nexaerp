import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from '../src/app/(public)/page';
import RootLayout from '../src/app/layout';

describe('landing page', () => {
  it('renders the hero heading and the feature section', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /one workspace for people operations/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /foundation/i })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
  });

  it('only links to targets that exist on the page', () => {
    const { container } = render(<HomePage />);

    const links = container.querySelectorAll('a[href^="#"]');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const target = link.getAttribute('href');
      expect(target).not.toBeNull();
      expect(container.querySelector(String(target))).not.toBeNull();
    }
  });

  it('exposes a skip link that points at the main landmark', () => {
    render(
      <RootLayout>
        <main>page content</main>
      </RootLayout>,
    );

    const skipLink = screen.getByRole('link', { name: /skip to main content/i });
    expect(skipLink).toHaveAttribute('href', '#main');
    expect(within(document.body).getByText('page content')).toBeInTheDocument();
  });
});
