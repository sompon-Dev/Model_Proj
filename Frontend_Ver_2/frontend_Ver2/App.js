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
import EditAdmin from './src/EditAdmin';
import SearchUser from './src/SearchUser';

// Stack คือตัวจัดการ "การเปลี่ยนหน้า" ของแอป
// ทำงานเหมือนกองไพ่: เปิดหน้าใหม่ (navigate) = วางไพ่ใบใหม่ทับด้านบน
// กดย้อนกลับ (goBack) = หยิบไพ่ใบบนสุดออก แล้วกลับไปเห็นหน้าก่อนหน้า
const Stack = createNativeStackNavigator();

// App = โครงหลักของแอป ลงทะเบียนทุกหน้าไว้ที่นี่ที่เดียว
// - name คือชื่อที่หน้าอื่นใช้เรียก เช่น navigation.navigate('Homeuser')
// - component คือไฟล์หน้าจอที่จะเปิดเมื่อเรียกชื่อนั้น
// - initialRouteName="Login" คือเปิดแอปมาเจอหน้า Login ก่อนเสมอ
// - headerShown: false คือซ่อนแถบหัวข้อมาตรฐาน เพราะแต่ละหน้าทำปุ่มย้อนกลับเอง
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
          <Stack.Screen
            name="EditAdmin"
            component={EditAdmin}
          />
          <Stack.Screen
            name="SearchUser"
            component={SearchUser}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
