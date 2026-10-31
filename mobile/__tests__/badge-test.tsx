import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { Badge } from '../src/components/ui/Badge';

describe('Badge', () => {
  it('muestra el contenido recibido', async () => {
    await render(<Badge>Aprobado</Badge>);
    expect(screen.getByText('Aprobado')).toBeTruthy();
  });

  it('cambia el tamano de la fuente segun la prop size', async () => {
    const casos = [
      { size: 'sm' as const, fuente: 11 },
      { size: 'md' as const, fuente: 12 },
      { size: 'lg' as const, fuente: 13 },
    ];

    for (const { size, fuente } of casos) {
      const { unmount } = await render(<Badge size={size}>Etiqueta</Badge>);
      const estilo = StyleSheet.flatten(screen.getByText('Etiqueta').props.style);
      expect(estilo.fontSize).toBe(fuente);
      await unmount();
    }
  });

  it('aplica las variantes de color sin perder el texto', async () => {
    for (const variant of ['success', 'warning', 'danger', 'info', 'outline'] as const) {
      const { unmount } = await render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toBeTruthy();
      await unmount();
    }
  });
});
