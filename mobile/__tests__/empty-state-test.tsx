import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { EmptyState } from '../src/components/ui/EmptyState';

describe('EmptyState', () => {
  it('muestra el titulo y el mensaje', async () => {
    await render(<EmptyState title="Todavia no hay apuntes" message="Crea el primero para empezar." />);

    expect(screen.getByText('Todavia no hay apuntes')).toBeTruthy();
    expect(screen.getByText('Crea el primero para empezar.')).toBeTruthy();
  });

  it('omite el mensaje cuando no se envia', async () => {
    await render(<EmptyState title="Sin resultados" />);

    expect(screen.getByText('Sin resultados')).toBeTruthy();
    expect(screen.queryByText('Crea el primero para empezar.')).toBeNull();
  });

  it('renderiza la accion que recibe como hijo', async () => {
    await render(
      <EmptyState title="Sin apuntes">
        <Text>Crear apunte</Text>
      </EmptyState>,
    );

    expect(screen.getByText('Crear apunte')).toBeTruthy();
  });
});
