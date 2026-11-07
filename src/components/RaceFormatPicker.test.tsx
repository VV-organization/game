// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import type { RaceFormatId } from '../shared/race-formats';
import { RaceFormatPicker } from './RaceFormatPicker';

afterEach(cleanup);

it('lets the player select each format and explains the actual win condition', async () => {
  function Setup() {
    const [value, setValue] = useState<RaceFormatId>('classic');
    return <RaceFormatPicker value={value} onChange={setValue} />;
  }
  const user = userEvent.setup();
  render(<Setup />);
  const select = screen.getByRole('combobox', { name: 'Формат заезда' }) as HTMLSelectElement;
  expect(select.value).toBe('classic');
  expect(screen.getAllByRole('option')).toHaveLength(5);
  for (const [id, rule] of [
    ['sprint', /Всего один круг/],
    ['time-attack', /лучший полный круг/],
    ['elimination', /последний выбывает/],
    ['endurance', /Круги не ограничены/],
    ['classic', /Три круга/],
  ] as const) {
    await user.selectOptions(select, id);
    expect(select.value).toBe(id);
    expect(screen.getByText(rule)).toBeTruthy();
  }
});
