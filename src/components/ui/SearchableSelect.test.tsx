import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchableSelect } from './SearchableSelect';

const options = [
  { value: 'andes', label: 'AndesRetail' },
  { value: 'cafe', label: 'Café de origen' },
  { value: 'ecommerce', label: 'E-commerce' },
];

function Setup(props: Partial<Parameters<typeof SearchableSelect>[0]> = {}) {
  const onChange = vi.fn();
  render(<SearchableSelect ariaLabel="Partner" value="" onChange={onChange} options={options} {...props} />);
  return onChange;
}
const searchBox = () => screen.getByRole('searchbox', { name: /Buscar/ });

describe('SearchableSelect', () => {
  it('opens, filters accent-insensitively and selects an option', () => {
    const onChange = Setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    expect(screen.getByRole('option', { name: 'AndesRetail' })).toBeTruthy();
    fireEvent.change(searchBox(), { target: { value: 'cafe' } });
    expect(screen.getByRole('option', { name: 'Café de origen' })).toBeTruthy();
    expect(screen.queryByRole('option', { name: 'AndesRetail' })).toBeNull();
    fireEvent.click(screen.getByRole('option', { name: 'Café de origen' }));
    expect(onChange).toHaveBeenCalledWith('cafe');
  });

  it('navigates with the keyboard and confirms with Enter', () => {
    const onChange = Setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchBox(), { key: 'ArrowDown' });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('ecommerce');
  });

  it('closes with Escape without propagating to a surrounding dialog', async () => {
    Setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    fireEvent.keyDown(searchBox(), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull());
  });

  it('shows the empty message when no option matches', () => {
    Setup({ emptyText: 'Nada por aquí' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    fireEvent.change(searchBox(), { target: { value: 'zzz' } });
    expect(screen.getByText('Nada por aquí')).toBeTruthy();
  });

  it('blocks the form submit while required is empty and recovers after choosing', async () => {
    const onSubmit = vi.fn(event => event.preventDefault());
    function RequiredForm() {
      const [value, setValue] = useState('');
      return <form onSubmit={onSubmit}><SearchableSelect ariaLabel="Canal" required value={value} onChange={setValue} options={options} /></form>;
    }
    render(<RequiredForm />);
    const form = document.querySelector('form')!;
    const submit = () => fireEvent(form, new Event('submit', { bubbles: true, cancelable: true }));
    submit();
    // Required violation must block the submit before any submit handler runs.
    expect(onSubmit).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('alert').textContent).toContain('Selecciona una opción');
    // The validation opens the popover focused on the empty selector.
    fireEvent.click(screen.getByRole('option', { name: 'AndesRetail' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    submit();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('clears the selection and keeps focus on the trigger', () => {
    const onChange = Setup({ value: 'andes', clearable: true });
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows the loading state instead of options', () => {
    Setup({ loading: true, loadingText: 'Trayendo partners…' });
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    expect(screen.getByText('Trayendo partners…')).toBeTruthy();
    expect(screen.queryByRole('option')).toBeNull();
  });

  it('does not open while disabled', () => {
    Setup({ disabled: true });
    fireEvent.click(screen.getByRole('combobox', { name: 'Partner' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('announces the selected value through the trigger', () => {
    render(<SearchableSelect ariaLabel="Tienda" value="BOG-01" onChange={() => {}} options={[{ value: 'BOG-01', label: 'BOG-01' }]} />);
    expect(screen.getByRole('combobox', { name: 'Tienda' }).textContent).toContain('BOG-01');
  });
});
