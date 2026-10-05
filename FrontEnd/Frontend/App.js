import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Login from './src/Login';
import Register from './src/Register';
import Otp from './src/Otp';
import Homeuser from './src/Homeuser';
import Result from './src/Result';
import AdminPage from './src/AdminPage';
import Addsong from './src/Addsong';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Homeuser"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen
            name="Homeuser"
            component={Homeuser}
          />
          <Stack.Screen
            name="Register"
            component={Register}
          />
          <Stack.Screen
            name="Otp"
            component={Otp}
          />
          <Stack.Screen
            name="Result"
            component={Result}
          />
          <Stack.Screen
            name="Login"
            component={Login}
          />
          <Stack.Screen
            name="AdminPage"
            component={AdminPage}
          />
          <Stack.Screen
            name="Addsong"
            component={Addsong}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

