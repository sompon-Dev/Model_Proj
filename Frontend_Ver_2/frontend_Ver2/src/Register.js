import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    ScrollView,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// หน้าสมัครสมาชิก (ขั้นที่ 1 ของการสมัคร ขั้นที่ 2 คือหน้า Otp)
const Register = ({ navigation }) => {
    // ค่าที่ผู้ใช้พิมพ์ในแต่ละช่อง
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false); // true ระหว่างส่งข้อมูล (กันกดปุ่มซ้ำ)

    // กดปุ่ม Create: ตรวจข้อมูล -> เช็กชื่อซ้ำ -> สร้างบัญชี -> ไปหน้ากรอก OTP
    const handleCreate = async () => {
        // ตัดช่องว่างหน้า-หลังออก และทำอีเมลเป็นตัวพิมพ์เล็กทั้งหมด
        // เพื่อให้ "A@Mail.com " กับ "a@mail.com" ถือเป็นอีเมลเดียวกัน
        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

        // ===== ตรวจข้อมูลในเครื่องก่อน (ยังไม่ต้องติดต่อ server) =====
        // ถ้าข้อไหนไม่ผ่านจะเด้งแจ้งเตือนแล้วหยุดทันที
        //   - ต้องกรอก username และยาวไม่เกิน 25 ตัว (เท่ากับขนาดคอลัมน์ username ในตาราง users)
        //   - ต้องกรอกอีเมล และรูปแบบต้องเป็น xxx@xxx.xxx (ตรวจด้วย emailRegex)
        //   - รหัสผ่านอย่างน้อย 6 ตัว (ขั้นต่ำที่ Supabase กำหนด)
        //   - รหัสผ่านกับช่องยืนยันรหัสต้องตรงกัน

        if (!cleanUsername) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอก Username');
            return;
        }

        if (cleanUsername.length > 25) {
            Alert.alert(
                'แจ้งเตือน',
                'Username ต้องมีความยาวไม่เกิน 25 ตัวอักษร'
            );
            return;
        }

        if (!cleanEmail) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอก Email');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(cleanEmail)) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอก Email ให้ถูกต้อง');
            return;
        }

        if (password.length < 6) {
            Alert.alert(
                'แจ้งเตือน',
                'Password ต้องมีอย่างน้อย 6 ตัวอักษร'
            );
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(
                'แจ้งเตือน',
                'Password และ Confirm Password ไม่ตรงกัน'
            );
            return;
        }

        setLoading(true);

        try {
            // ===== เช็กว่า username ถูกใช้ไปแล้วหรือยัง =====
            // เรียกฟังก์ชัน find_login_email ที่เขียนไว้ใน Supabase (rpc = เรียกฟังก์ชันฝั่ง database)
            // ฟังก์ชันนี้รับ username แล้วคืนอีเมลของเจ้าของชื่อนั้น (หน้า Login ก็ใช้ตัวเดียวกัน)
            //   - ได้อีเมลกลับมา = มีคนใช้ชื่อนี้แล้ว -> แจ้งให้เปลี่ยนชื่อ
            //   - ได้ค่าว่าง     = ชื่อนี้ยังว่าง สมัครต่อได้
            const { data: takenEmail, error: lookupError } =
                await supabase.rpc('find_login_email', {
                    input_username: cleanUsername,
                });

            if (lookupError) {
                Alert.alert(
                    'เกิดข้อผิดพลาด',
                    'ตรวจสอบ Username ไม่สำเร็จ กรุณาลองใหม่'
                );
                return;
            }

            if (takenEmail) {
                Alert.alert(
                    'สมัครสมาชิกไม่สำเร็จ',
                    'Username นี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น'
                );
                return;
            }

            // ===== สร้างบัญชีใน Supabase Auth =====
            // Supabase เก็บอีเมลและรหัสผ่าน (เข้ารหัสแล้ว) ไว้เอง แล้วส่งรหัส OTP ไปที่อีเมล
            // username ฝากไว้ใน options.data (user_metadata) ก่อน
            // ยังไม่ได้บันทึกลงตาราง users ตรงนี้ จะบันทึกหลังยืนยัน OTP สำเร็จในหน้า Otp
            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                    data: {
                        username: cleanUsername,
                    },
                },
            });

            if (error) {
                Alert.alert('สมัครสมาชิกไม่สำเร็จ', error.message);
                return;
            }

            if (!data.user) {
                Alert.alert(
                    'เกิดข้อผิดพลาด',
                    'ไม่สามารถสร้างบัญชีได้ กรุณาลองใหม่'
                );
                return;
            }

            // กรณีอีเมลนี้เคยสมัครแล้ว Supabase จะไม่ตอบเป็น error (กันคนเดาว่าอีเมลไหนมีบัญชี)
            // แต่จะส่ง user กลับมาโดยมี identities เป็นรายการว่าง และไม่ส่ง OTP ไปให้
            // เราจึงเช็กตรงนี้เพื่อบอกผู้ใช้ว่าอีเมลนี้ถูกใช้แล้ว
            if (data.user.identities?.length === 0) {
                Alert.alert(
                    'สมัครสมาชิกไม่สำเร็จ',
                    'Email นี้ถูกใช้สมัครแล้ว กรุณาเข้าสู่ระบบ หรือใช้ Email อื่น'
                );
                return;
            }

            // ทุกอย่างผ่าน: ไปหน้ากรอก OTP พร้อมส่งอีเมลและ username ไปด้วย
            // (หน้า Otp ต้องใช้อีเมลตอนตรวจรหัส และใช้ username ตอนบันทึกลงตาราง users)
            navigation.navigate('Otp', {
                email: cleanEmail,
                username: cleanUsername,
            });
        } catch (error) {
            Alert.alert(
                'เกิดข้อผิดพลาด',
                error.message || 'กรุณาลองใหม่อีกครั้ง'
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
                    style={styles.keyboardAvoid}
                >
                    <ScrollView
                        contentContainerStyle={styles.content}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Text style={styles.title}>
                            Create Account
                        </Text>

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
                                    placeholder="Username"
                                    placeholderTextColor="rgba(255,255,255,0.55)"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    value={username}
                                    onChangeText={setUsername}
                                    maxLength={25}
                                    editable={!loading}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Feather
                                    name="mail"
                                    size={20}
                                    color="#1A1A1A"
                                    style={styles.inputIcon}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder="E-mail"
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

                            <View style={styles.inputContainer}>
                                <Feather
                                    name="lock"
                                    size={20}
                                    color="#1A1A1A"
                                    style={styles.inputIcon}
                                />

                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm Password"
                                    placeholderTextColor="rgba(255,255,255,0.55)"
                                    secureTextEntry
                                    autoCapitalize="none"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    editable={!loading}
                                />
                            </View>

                            <TouchableOpacity
                                style={[
                                    styles.createButton,
                                    loading && styles.disabledButton,
                                ]}
                                activeOpacity={0.85}
                                onPress={handleCreate}
                                disabled={loading}
                            >
                                <Text style={styles.createButtonText}>
                                    {loading ? 'Creating...' : 'Create'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.loginLinkContainer}
                                onPress={() => navigation.navigate('Login')}
                                disabled={loading}
                            >
                                <Text style={styles.loginLinkText}>
                                    Already have an account? Login
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#4F66A8',
    },

    keyboardAvoid: {
        flex: 1,
    },

    content: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 36,
        paddingVertical: 20,
    },

    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 32,
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

    createButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        height: 48,
        minWidth: 140,
        paddingHorizontal: 36,
        alignSelf: 'center',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 8,
    },

    disabledButton: {
        opacity: 0.6,
    },

    createButtonText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4F66A8',
    },

    loginLinkContainer: {
        alignItems: 'center',
        marginTop: 22,
    },

    loginLinkText: {
        fontSize: 13,
        color: '#FFFFFF',
    },
});

export default Register;
