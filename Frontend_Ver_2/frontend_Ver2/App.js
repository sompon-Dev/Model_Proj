import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Login from './src/Login';
import Register from './src/Register';
import Otp from './src/Otp';
import Homeuser from './src/Homeuser';
import Homeadmin from './src/Homeadmin';
import AddSong from './src/AddSong';
import UpdateModel from './src/UpdateModel';
import AddCategory from './src/AddCategory';
import MostSearch from './src/MostSearch';
import Result from './src/Result';
import History from './src/History';
import Profile from './src/Profile';
import AdminProfile from './src/AdminProfile';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{ headerShown: false }}
        >
          <Stack.Screen
            name="Login"
            component={Login}
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
            name="Homeuser"
            component={Homeuser}
          />
          <Stack.Screen
            name="Homeadmin"
            component={Homeadmin}
          />
          <Stack.Screen
            name="AddSong"
            component={AddSong}
          />
          <Stack.Screen
            name="UpdateModel"
            component={UpdateModel}
          />
          <Stack.Screen
            name="AddCategory"
            component={AddCategory}
          />
          <Stack.Screen
            name="MostSearch"
            component={MostSearch}
          />
          <Stack.Screen
            name="Result"
            component={Result}
          />
          <Stack.Screen
            name="History"
            component={History}
          />
          <Stack.Screen
            name="Profile"
            component={Profile}
          />
          <Stack.Screen
            name="AdminProfile"
            component={AdminProfile}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

