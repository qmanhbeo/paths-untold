import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the main menu heading', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /paths untold/i });
  expect(heading).toBeTruthy();
});
