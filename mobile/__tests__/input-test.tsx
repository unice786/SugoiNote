import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Input } from '../src/components/ui/Input';

describe('Input', () => {
  it('muestra la etiqueta del campo', async () => {
    await render(<Input label="Correo electronico" />);
    expect(screen.getByText('Correo electronico')).toBeTruthy();
  });

  it('muestra el mensaje de error cuando se envia la prop error', async () => {
    await render(<Input label="Correo" error="El correo no es valido" />);
    expect(screen.getByText('El correo no es valido')).toBeTruthy();
  });

  it('no muestra mensaje de error cuando el campo es valido', async () => {
    await render(<Input label="Correo" />);
    expect(screen.queryByText('El correo no es valido')).toBeNull();
  });

  it('propaga el texto que escribe el usuario', async () => {
    const alCambiar = jest.fn();
    await render(<Input placeholder="Escribe tu correo" onChangeText={alCambiar} />);

    await fireEvent.changeText(screen.getByPlaceholderText('Escribe tu correo'), 'ana@sugoinote.test');

    expect(alCambiar).toHaveBeenCalledWith('ana@sugoinote.test');
  });

  it('alterna la visibilidad de la contrasena', async () => {
    await render(<Input placeholder="Clave" passwordToggle secureTextEntry />);

    const campo = () => screen.getByPlaceholderText('Clave');
    expect(campo().props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByText('Ver'));
    expect(campo().props.secureTextEntry).toBe(false);

    await fireEvent.press(screen.getByText('Ocultar'));
    expect(campo().props.secureTextEntry).toBe(true);
  });
});
