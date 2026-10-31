import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../src/components/ui/Button';

/**
 * Pruebas de componente del boton reutilizable.
 * No hace falta envolver en ThemeProvider: useTheme() tiene tokens por defecto.
 */
describe('Button', () => {
  it('muestra el texto que recibe por props', async () => {
    await render(<Button title="Guardar apunte" onPress={() => {}} />);
    expect(screen.getByText('Guardar apunte')).toBeTruthy();
  });

  it('ejecuta onPress al presionar', async () => {
    const alPresionar = jest.fn();
    await render(<Button title="Guardar" onPress={alPresionar} />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(alPresionar).toHaveBeenCalledTimes(1);
  });

  it('no ejecuta onPress cuando esta deshabilitado', async () => {
    const alPresionar = jest.fn();
    await render(<Button title="Guardar" onPress={alPresionar} disabled />);

    await fireEvent.press(screen.getByText('Guardar'));

    expect(alPresionar).not.toHaveBeenCalled();
  });

  it('oculta el titulo mientras carga para no invitar a un segundo toque', async () => {
    await render(<Button title="Guardar" onPress={() => {}} loading />);

    expect(screen.queryByText('Guardar')).toBeNull();
  });

  it('respeta el alto de cada tamano', async () => {
    const tamanos = [
      { size: 'sm' as const, alto: 36 },
      { size: 'md' as const, alto: 44 },
      { size: 'lg' as const, alto: 52 },
    ];

    for (const { size, alto } of tamanos) {
      const { unmount } = await render(<Button title={`Boton ${size}`} onPress={() => {}} size={size} />);

      // El alto lo define el Pressable, que lo resuelve como estilo plano:
      // se sube por los ancestros hasta encontrar el que fija la altura.
      let nodo = screen.getByText(`Boton ${size}`).parent;
      let altoAplicado;
      while (nodo && altoAplicado === undefined) {
        const estilo = typeof nodo.props.style === 'function' ? nodo.props.style({ pressed: false }) : nodo.props.style;
        altoAplicado = StyleSheet.flatten(estilo)?.height;
        nodo = nodo.parent;
      }

      expect(altoAplicado).toBe(alto);
      await unmount();
    }
  });
});
