import { Stack } from 'expo-router';
import { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const [name, setName] = useState('');
  const { login } = useAuth();

  const handleLogin = async () => {
    if (name.trim()) {
      try {
        await login(name);
      } catch (e) {
        Toast.show({
          type: 'error',
          text1: 'Error de inicio de sesión',
          text2: 'Inténtalo de nuevo'
        });
      }
    } else {
      Toast.show({
        type: 'error',
        text1: 'Nombre requerido',
        text2: 'Por favor ingresa tu nombre'
      });
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 bg-background justify-center items-center p-8">
        <Text className="text-4xl font-bold text-primary mb-8">Panadería App</Text>
        <Text className="text-lg text-text mb-4">Ingresa tu nombre para continuar</Text>
        
        <View className="w-full max-w-sm">
          <TextInput
            placeholder="Tu nombre"
            placeholderTextColor="#94A3B8"
            className="bg-surface text-text text-lg p-4 rounded-xl border border-border mb-6"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <TouchableOpacity
            className="bg-primary p-4 rounded-xl items-center"
            onPress={handleLogin}
          >
            <Text className="text-white text-lg font-bold">Ingresar</Text>
          </TouchableOpacity>
        </View>

        <Text className="text-muted mt-8 text-sm text-center px-8">
          Esta aplicación es para uso interno. Por favor usa tu nombre real para llevar el registro de actividades.
        </Text>
      </View>
    </>
  );
}
