import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

// ใช้กับการล็อกอินด้วย Google/Facebook บนเว็บ: เมื่อหน้าล็อกอินส่งผู้ใช้กลับมา
// คำสั่งนี้จะปิดหน้าต่างล็อกอินที่เปิดค้างไว้ และส่งผลกลับให้แอป (บนมือถือไม่มีผลอะไร)
WebBrowser.maybeCompleteAuthSession();

// รูปโลโก้บนปุ่มล็อกอินด้วย Google และ Facebook
const GOOGLE_LOGO_URI =
    'https://media.wired.com/photos/5926ffe47034dc5f91bed4e8/3:2/w_1920,c_limit/google-logo.jpg';

const FACEBOOK_LOGO_URI =
    'https://1000logos.net/wp-content/uploads/2017/02/Facebook-Logosu.png';

// หน้าเข้าสู่ระบบ (หน้าแรกของแอป) ล็อกอินได้ 3 วิธี:
//   1) Username หรือ Email + รหัสผ่าน
//   2) บัญชี Google
//   3) บัญชี Facebook
// ไม่ว่าวิธีไหน สุดท้ายจะมาจบที่ navigateByUserRole ซึ่งตรวจว่าถูกระงับบัญชีหรือไม่
// แล้วพาไปหน้าแรกตาม role (admin -> Homeadmin, user -> Homeuser)
const Login = ({ navigation }) => {
    const [email, setEmail] = useState('');        // ช่องแรก: พิมพ์ได้ทั้ง username และ email
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false); // true ระหว่างกำลังล็อกอิน (กันกดซ้ำ)

    // อ่านข้อมูลผู้ใช้จากตาราง users แล้วตรวจสถานะการระงับบัญชี (ban)
    // คืนค่าได้ 2 แบบ:
    //   - ข้อมูลผู้ใช้ { role, username }  -> เข้าแอปได้
    //   - false                            -> ถูกระงับบัญชี ห้ามเข้า
    // ขั้นตอน:
    //   1) หาแถวของผู้ใช้คนนี้ในตาราง users
    //      .maybeSingle() = ได้ 1 แถว หรือไม่มีเลยก็ได้ (ไม่ถือว่าผิดพลาด)
    //   2) ถ้าไม่มีแถว แปลว่าเป็นผู้ใช้ที่ล็อกอินด้วย Google/Facebook ครั้งแรก
    //      (คนกลุ่มนี้ไม่ได้ผ่านหน้า Register/Otp จึงยังไม่มีแถวในตาราง)
    //      -> สร้างแถวใหม่ให้ ใช้ชื่อจากบัญชี Google/Facebook หรือส่วนหน้า @ ของอีเมล
    //      -> ให้เป็นผู้ใช้ทั่วไป (role = 'user')
    //   3) ถ้า ban = true: ออกจากระบบทันที แล้วแจ้งว่าบัญชีถูกระงับ
    //   4) นอกนั้นคืนข้อมูลผู้ใช้ออกไป
    const checkUserBan = async (userId) => {
        const { data: userData, error } = await supabase
            .from('users')
            .select('role, username, ban')
            .eq('users_id', userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!userData) {
            const { data: { user } } = await supabase.auth.getUser();
            const username =
                user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'user';

            const { error: insertError } = await supabase
                .from('users')
                .insert({ users_id: userId, username, email: user?.email });

            if (insertError) {
                console.log('สร้างแถวใน users ไม่สำเร็จ:', insertError.message);
            }

            return { role: 'user', username };
        }

        if (userData.ban === true) {
            await supabase.auth.signOut();

            Alert.alert(
                'Account Suspended',
                'บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
            );

            return false;
        }

        return userData;
    };

    // ขั้นสุดท้ายของการล็อกอินทุกวิธี: ตรวจบัญชีแล้วพาไปหน้าแรกตาม role
    //   - ถูกระงับบัญชี (checkUserBan คืน false) -> อยู่หน้า Login ต่อ
    //   - role = 'admin' -> ไปหน้า Homeadmin
    //   - role อื่น      -> ไปหน้า Homeuser
    // ใช้ navigation.reset แทน navigate: ล้างประวัติหน้าทิ้ง กดย้อนกลับแล้วจะไม่กลับมาหน้า Login
    // ส่ง userId และ username ไปให้หน้าถัดไปใช้ด้วย
    // ถ้าตรวจบัญชีพลาด (เช่น อ่านตาราง users ไม่ได้) ให้ออกจากระบบเพื่อความปลอดภัย แล้วแจ้ง error
    const navigateByUserRole = async (userId) => {
        try {
            const userData = await checkUserBan(userId);

            if (!userData) {
                return;
            }

            navigation?.reset({
                index: 0,
                routes: [{
                    name: userData.role === 'admin' ? 'Homeadmin' : 'Homeuser',
                    params: { userId, username: userData.username },
                }],
            });

        } catch (err) {
            console.log('User verification error:', err);

            await supabase.auth.signOut();

            Alert.alert(
                'Login Failed',
                err.message || 'ไม่สามารถตรวจสอบบัญชีได้'
            );
        }
    };

    // กดปุ่ม Login (วิธีที่ 1: Username/Email + รหัสผ่าน)
    //   1) ต้องกรอกทั้ง 2 ช่อง
    //   2) ดูว่าช่องแรกเป็นอีเมลหรือ username (ตรวจรูปแบบ xxx@xxx.xxx)
    //        - อีเมล    -> ใช้เลย (แปลงเป็นตัวพิมพ์เล็ก)
    //        - username -> เรียกฟังก์ชัน find_login_email บน Supabase เพื่อแปลง username เป็นอีเมล
    //                      เพราะ Supabase ล็อกอินด้วยอีเมลได้อย่างเดียว
    //   3) ล็อกอินด้วยอีเมล + รหัสผ่าน (signInWithPassword)
    //      ไม่ผ่านถ้ารหัสผิด หรือยังไม่ได้ยืนยันอีเมลด้วย OTP
    //   4) ล็อกอินผ่านแล้ว ส่งต่อให้ navigateByUserRole ตรวจ ban และพาไปหน้าแรก
    const handleLogin = async () => {
        const input = email.trim();

        if (!input || !password) {
            Alert.alert(
                'แจ้งเตือน',
                'กรุณากรอก Username หรือ Email และ Password'
            );
            return;
        }

        setLoading(true);

        try {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
            let loginEmail;

            if (isEmail) {
                loginEmail = input.toLowerCase();
            } else {
                const { data: foundEmail, error: lookupError } =
                    await supabase.rpc('find_login_email', {
                        input_username: input,
                    });

                if (lookupError || !foundEmail) {
                    Alert.alert(
                        'เข้าสู่ระบบไม่สำเร็จ',
                        'ไม่พบ Username นี้ หรือเกิดข้อผิดพลาด'
                    );
                    return;
                }

                loginEmail = foundEmail;
            }

            const { data, error } =
                await supabase.auth.signInWithPassword({
                    email: loginEmail,
                    password,
                });

            if (error) {
                console.log('Login error:', error.message);

                Alert.alert(
                    'เข้าสู่ระบบไม่สำเร็จ',
                    'Username/Email หรือ Password ไม่ถูกต้อง หรือบัญชียังไม่ได้ยืนยันอีเมล'
                );
                return;
            }

            if (data.session?.user) {
                await navigateByUserRole(data.session.user.id);
            }

        } catch (error) {
            console.log('Unexpected login error:', error);

            Alert.alert(
                'เกิดข้อผิดพลาด',
                'กรุณาลองใหม่อีกครั้ง'
            );
        } finally {
            setLoading(false);
        }
    };

    // กดปุ่ม Google (วิธีที่ 2: ล็อกอินผ่านบัญชี Google)
    // หลักการ (OAuth): แอปไม่เห็นรหัสผ่าน Google ของผู้ใช้เลย
    // ผู้ใช้ไปล็อกอินในหน้าของ Google เอง แล้ว Google ส่ง "บัตรผ่าน" กลับมาให้แอป
    // ขั้นตอน:
    //   1) สร้างที่อยู่สำหรับให้ Google ส่งผู้ใช้กลับเข้าแอป (redirectTo)
    //      เช่น lyriseek://auth/callback
    //   2) ขอลิงก์หน้าล็อกอิน Google จาก Supabase
    //      skipBrowserRedirect: true = ขอแค่ลิงก์ เดี๋ยวแอปเปิดหน้าเว็บเอง
    //      prompt: 'select_account'  = ให้ Google ถามทุกครั้งว่าจะใช้บัญชีไหน
    //   3) เปิดหน้าเว็บล็อกอิน แล้วรอจนผู้ใช้ล็อกอินเสร็จและถูกส่งกลับมา
    //   4) อ่านค่าที่ติดมากับลิงก์ขากลับ (ส่วนหลัง # หรือ ?) แล้วเปลี่ยนเป็น session ของ Supabase
    //      ได้กลับมาได้ 2 แบบ ขึ้นกับการตั้งค่า:
    //        - code                          -> ส่ง code ไปแลกเป็น session (exchangeCodeForSession)
    //        - access_token + refresh_token  -> ตั้ง session จาก token ตรงๆ (setSession)
    //   5) ถามว่าผู้ใช้คือใคร แล้วส่งต่อให้ navigateByUserRole
    // ถ้าผู้ใช้กดปิดหน้าล็อกอินเอง (result.type ไม่ใช่ 'success') จะไม่ทำอะไรต่อ
    const handleGoogleLogin = async () => {
        setLoading(true);

        try {
            const redirectTo = AuthSession.makeRedirectUri({
                scheme: 'lyriseek',
                path: 'auth/callback',
            });

            console.log('Redirect URI used:', redirectTo);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                    queryParams: { prompt: 'select_account' },
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );

                if (result.type === 'success') {
                    const { url } = result;
                    let queryString = '';

                    if (url.includes('#')) {
                        queryString = url.split('#')[1];
                    } else if (url.includes('?')) {
                        queryString = url.split('?')[1];
                    }

                    const params = Object.fromEntries(new URLSearchParams(queryString));

                    if (params.code) {
                        const { error: exchangeError } =
                            await supabase.auth.exchangeCodeForSession(
                                params.code
                            );

                        if (exchangeError) throw exchangeError;

                    } else if (
                        params.access_token &&
                        params.refresh_token
                    ) {
                        const { error: sessionError } =
                            await supabase.auth.setSession({
                                access_token: params.access_token,
                                refresh_token: params.refresh_token,
                            });

                        if (sessionError) throw sessionError;
                    }

                    const {
                        data: { user },
                        error: userError,
                    } = await supabase.auth.getUser();

                    if (userError) throw userError;

                    if (user) {
                        await navigateByUserRole(user.id);
                    }
                }
            }

        } catch (err) {
            console.log('Google Login Error:', err);

            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่สามารถเข้าสู่ระบบด้วย Google ได้'
            );
        } finally {
            setLoading(false);
        }
    };

    // กดปุ่ม Facebook (วิธีที่ 3: ล็อกอินผ่านบัญชี Facebook)
    // ทำงานเหมือน handleGoogleLogin ทุกขั้นตอน ต่างกันแค่ provider เป็น 'facebook'
    // และไม่มีตัวเลือกให้เลือกบัญชีทุกครั้ง
    const handleFacebookLogin = async () => {
        setLoading(true);

        try {
            const redirectTo = AuthSession.makeRedirectUri({
                scheme: 'lyriseek',
                path: 'auth/callback',
            });

            console.log('Redirect URI used:', redirectTo);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'facebook',
                options: {
                    redirectTo,
                    skipBrowserRedirect: true,
                },
            });

            if (error) throw error;

            if (data?.url) {
                const result = await WebBrowser.openAuthSessionAsync(
                    data.url,
                    redirectTo
                );

                if (result.type === 'success') {
                    const { url } = result;
                    let queryString = '';

                    if (url.includes('#')) {
                        queryString = url.split('#')[1];
                    } else if (url.includes('?')) {
                        queryString = url.split('?')[1];
                    }

                    const params = Object.fromEntries(new URLSearchParams(queryString));

                    if (params.code) {
                        const { error: exchangeError } =
                            await supabase.auth.exchangeCodeForSession(
                                params.code
                            );

                        if (exchangeError) throw exchangeError;

                    } else if (
                        params.access_token &&
                        params.refresh_token
                    ) {
                        const { error: sessionError } =
                            await supabase.auth.setSession({
                                access_token: params.access_token,
                                refresh_token: params.refresh_token,
                            });

                        if (sessionError) throw sessionError;
                    }

                    const {
                        data: { user },
                        error: userError,
                    } = await supabase.auth.getUser();

                    if (userError) throw userError;

                    if (user) {
                        await navigateByUserRole(user.id);
                    }
                }
            }

        } catch (err) {
            console.log('Facebook Login Error:', err);

            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่สามารถเข้าสู่ระบบด้วย Facebook ได้'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={
                        Platform.OS === 'ios' ? 'padding' : undefined
                    }
                    style={styles.content}
                >
                    <Text style={styles.title}>Login</Text>

                    <View style={styles.formContainer}>

                        <View style={styles.inputContainer}>
                            <Feather
                                name="user"
                                size={20}
                                color="#1A1A1A"
                                style={styles.inputIcon}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Username or E-mail"
                                placeholderTextColor="rgba(255,255,255,0.55)"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={email}
                                onChangeText={setEmail}
                                editable={!loading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Feather
                                name="lock"
                                size={20}
                                color="#1A1A1A"
                                style={styles.inputIcon}
                            />

                            <TextInput
                                style={styles.input}
                                placeholder="Password"
                                placeholderTextColor="rgba(255,255,255,0.55)"
                                secureTextEntry
                                autoCapitalize="none"
                                value={password}
                                onChangeText={setPassword}
                                editable={!loading}
                            />
                        </View>

                        <TouchableOpacity
                            style={[
                                styles.loginButton,
                                loading && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            <Text style={styles.loginButtonText}>
                                {loading ? 'Logging in...' : 'Login!'}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.signupContainer}>
                            <Text style={styles.signupText}>
                                Don't have an account?{' '}
                                <Text
                                    style={styles.signupLink}
                                    onPress={() =>
                                        navigation?.navigate('Register')
                                    }
                                >
                                    Sign up
                                </Text>
                            </Text>
                        </View>

                        <Text style={styles.orText}>Or</Text>

                        <TouchableOpacity
                            style={[
                                styles.socialButton,
                                loading && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            onPress={handleGoogleLogin}
                            disabled={loading}
                        >
                            <Image
                                source={{ uri: GOOGLE_LOGO_URI }}
                                style={styles.socialIcon}
                                resizeMode="contain"
                            />

                            <Text style={styles.socialButtonText}>
                                Continue with Google
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.socialButton,
                                styles.facebookButton,
                                loading && styles.disabledButton,
                            ]}
                            activeOpacity={0.85}
                            onPress={handleFacebookLogin}
                            disabled={loading}
                        >
                            <Image
                                source={{ uri: FACEBOOK_LOGO_URI }}
                                style={styles.socialIcon}
                                resizeMode="contain"
                            />

                            <Text style={styles.socialButtonText}>
                                Continue with Facebook
                            </Text>
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#8E2C2C',
    },

    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 36,
    },

    title: {
        fontSize: 52,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 44,
    },

    formContainer: {
        width: '100%',
    },

    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.65)',
        borderRadius: 8,
        height: 52,
        paddingHorizontal: 14,
        marginBottom: 16,
    },

    inputIcon: {
        marginRight: 10,
    },

    input: {
        flex: 1,
        fontSize: 16,
        color: '#FFFFFF',
    },

    loginButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 12,
    },

    disabledButton: {
        opacity: 0.6,
    },

    loginButtonText: {
        fontSize: 19,
        fontWeight: '500',
        color: '#2B2B2B',
    },

    signupContainer: {
        alignItems: 'center',
        marginTop: 2,
    },

    signupText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
    },

    signupLink: {
        color: 'rgba(255,255,255,0.95)',
        fontWeight: '400',
    },

    orText: {
        fontSize: 22,
        color: '#1A1A1A',
        textAlign: 'center',
        marginVertical: 18,
    },

    socialButton: {
        backgroundColor: '#F4F5F7',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        width: 220,
    },

    facebookButton: {
        marginTop: 10,
    },

    socialIcon: {
        width: 28,
        height: 28,
        marginRight: 8,
    },

    socialButtonText: {
        fontSize: 13,
        color: '#3C4043',
        fontWeight: '500',
    },
});

export default Login;
