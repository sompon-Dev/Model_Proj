
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

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_LOGO_URI =
    'https://media.wired.com/photos/5926ffe47034dc5f91bed4e8/3:2/w_1920,c_limit/google-logo.jpg';

const FACEBOOK_LOGO_URI =
    'https://1000logos.net/wp-content/uploads/2017/02/Facebook-Logosu.png';

const Login = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // ตรวจสอบสถานะ Ban และ Role ของ User
    const checkUserBan = async (userId) => {
        const { data: userData, error } = await supabase
            .from('users')
            .select('role, username, ban')
            .eq('users_id', userId)
            .maybeSingle();

        if (error) {
            throw error;
        }

        // ไม่มี trigger สร้างแถวใน users ให้อัตโนมัติ คนที่เข้าด้วย Google/Facebook จึงอาจไม่มีแถว
        // ถ้า throw ตรงนี้จะเข้าแอปไม่ได้เลย ให้เข้าแบบผู้ใช้ทั่วไป (ไม่มีแถว = ไม่เคยถูกแบน)
        if (!userData) {
            return { role: 'user' };
        }

        // ถ้าถูกแบน ให้ Logout ทันที
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

    // ตรวจสอบ Ban ก่อนนำทางไปหน้า Home
    const navigateByUserRole = async (userId) => {
        try {
            const userData = await checkUserBan(userId);

            if (!userData) {
                return;
            }

            if (userData.role === 'admin') {
                navigation?.navigate('Homeadmin', {
                    userId,
                    username: userData.username,
                });
            } else {
                navigation?.navigate('Homeuser', {
                    userId,
                    username: userData.username,
                });
            }

        } catch (err) {
            console.log('User verification error:', err);

            await supabase.auth.signOut();

            Alert.alert(
                'Login Failed',
                err.message || 'ไม่สามารถตรวจสอบบัญชีได้'
            );
        }
    };

    // Email / Username Login
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

    // Google Login
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

                    const params = AuthSession.parseQueryString(queryString);

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

    // Facebook Login
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

                    const params = AuthSession.parseQueryString(queryString);

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

                        {/* Username or Email */}
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

                        {/* Password */}
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

                        {/* Login Button */}
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

                        {/* Sign up */}
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

                        {/* Divider */}
                        <Text style={styles.orText}>Or</Text>

                        {/* Google button */}
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

                        {/* Facebook button */}
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
