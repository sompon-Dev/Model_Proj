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
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const Otp = ({ navigation, route }) => {
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);

    const email = route?.params?.email;
    const username = route?.params?.username;

    // ตรวจสอบ OTP และบันทึกข้อมูลผู้ใช้
    const handleVerify = async () => {
        if (!email) {
            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่พบ Email กรุณาสมัครสมาชิกใหม่อีกครั้ง'
            );
            return;
        }

        if (!otp.trim()) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกรหัส OTP');
            return;
        }

        if (!username?.trim()) {
            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่พบ Username กรุณาตรวจสอบหน้า Register'
            );
            return;
        }

        setLoading(true);

        try {
            // 1. ตรวจสอบ OTP
            const { data, error } = await supabase.auth.verifyOtp({
                email: email.trim().toLowerCase(),
                token: otp.trim(),
                type: 'signup',
            });

            if (error) {
                Alert.alert(
                    'ยืนยันไม่สำเร็จ',
                    'OTP ไม่ถูกต้องหรือหมดอายุ กรุณาตรวจสอบอีกครั้ง'
                );
                return;
            }

            // 2. รับข้อมูลบัญชีจาก Supabase Auth
            const user = data.user;

            if (!user) {
                Alert.alert(
                    'เกิดข้อผิดพลาด',
                    'ยืนยัน OTP แล้ว แต่ไม่พบข้อมูลบัญชีผู้ใช้'
                );
                return;
            }

            // 3. บันทึกข้อมูลลง public.users
            const { error: profileError } = await supabase
                .from('users')
                .upsert(
                    {
                        users_id: user.id,
                        username: username.trim(),
                        email: user.email,
                    },
                    {
                        onConflict: 'users_id',
                    }
                );

            if (profileError) {
                console.log('Profile save error:', profileError);

                Alert.alert(
                    'ยืนยันอีเมลสำเร็จ',
                    'แต่บันทึกข้อมูลผู้ใช้ไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ RLS และตาราง users'
                );
                return;
            }

            // 4. บันทึกข้อมูลสำเร็จแล้วจึงไปหน้า Login
            Alert.alert(
                'สำเร็จ',
                'ยืนยัน Email และสมัครสมาชิกเรียบร้อยแล้ว',
                [
                    {
                        text: 'ตกลง',
                        onPress: async () => {
                            // ออกจาก Session หลังสมัคร
                            // เพื่อให้ผู้ใช้ Login จากหน้า Login อีกครั้ง
                            await supabase.auth.signOut();
                            navigation?.navigate('Login');
                        },
                    },
                ]
            );
        } catch (error) {
            console.log('Verify error:', error);

            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่สามารถยืนยัน OTP ได้ กรุณาลองใหม่'
            );
        } finally {
            setLoading(false);
        }
    };

    // ส่ง OTP ใหม่
    const handleResend = async () => {
        if (!email) {
            Alert.alert('เกิดข้อผิดพลาด', 'ไม่พบ Email');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email.trim().toLowerCase(),
            });

            if (error) {
                Alert.alert(
                    'ส่ง OTP ไม่สำเร็จ',
                    error.message
                );
                return;
            }

            setOtp('');

            Alert.alert(
                'สำเร็จ',
                'ส่ง OTP ใหม่ไปยัง Email ของคุณแล้ว'
            );
        } catch (error) {
            Alert.alert(
                'เกิดข้อผิดพลาด',
                'ไม่สามารถส่ง OTP ใหม่ได้'
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={
                        Platform.OS === 'ios'
                            ? 'padding'
                            : undefined
                    }
                    style={styles.content}
                >
                    <Text style={styles.title}>
                        Enter your OTP code{'\n'}to sign up
                    </Text>

                    {email ? (
                        <Text style={styles.emailText}>
                            OTP sent to {email}
                        </Text>
                    ) : null}

                    <View style={styles.inputContainer}>
                        <Feather
                            name="lock"
                            size={24}
                            color="#1A1A1A"
                            style={styles.inputIcon}
                        />

                        <TextInput
                            style={styles.input}
                            keyboardType="number-pad"
                            placeholder="OTP code"
                            placeholderTextColor="#333333"
                            value={otp}
                            onChangeText={setOtp}
                            maxLength={10}
                            autoCapitalize="none"
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.verifyButton,
                            loading && styles.disabledButton,
                        ]}
                        activeOpacity={0.85}
                        onPress={handleVerify}
                        disabled={loading}
                    >
                        <Text style={styles.verifyButtonText}>
                            {loading ? 'Please wait...' : 'Verify'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.resendButton}
                        activeOpacity={0.6}
                        onPress={handleResend}
                        disabled={loading}
                    >
                        <Text style={styles.resendText}>
                            resend OTP
                        </Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },

    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 36,
    },

    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 40,
    },

    emailText: {
        fontSize: 14,
        color: '#555555',
        textAlign: 'center',
        marginBottom: 24,
    },

    inputContainer: {
        width: '100%',
        height: 58,
        borderWidth: 1.5,
        borderColor: '#222222',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 38,
    },

    inputIcon: {
        marginRight: 12,
    },

    input: {
        flex: 1,
        fontSize: 18,
        color: '#1A1A1A',
    },

    verifyButton: {
        backgroundColor: '#4F66A8',
        borderRadius: 12,
        height: 48,
        minWidth: 148,
        paddingHorizontal: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },

    disabledButton: {
        opacity: 0.6,
    },

    verifyButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },

    resendButton: {
        padding: 6,
    },

    resendText: {
        fontSize: 13,
        color: '#555555',
    },
});

export default Otp;