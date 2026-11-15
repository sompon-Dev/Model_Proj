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

// หน้ายืนยันรหัส OTP (ขั้นที่ 2 ของการสมัครสมาชิก)
// หลังกดสมัครในหน้า Register, Supabase จะส่งรหัส OTP ไปที่อีเมล
// ผู้ใช้เอารหัสนั้นมากรอกที่หน้านี้ เพื่อพิสูจน์ว่าเป็นเจ้าของอีเมลจริง
// หมายเหตุ: รหัส OTP ถูกสร้าง เก็บ และตรวจโดย Supabase ทั้งหมด แอปไม่ได้เก็บรหัสเอง
const Otp = ({ navigation, route }) => {
    const [otp, setOtp] = useState('');             // รหัสที่ผู้ใช้พิมพ์
    const [loading, setLoading] = useState(false);  // true ระหว่างรอ Supabase ตอบ (กันกดซ้ำ)

    // อีเมลและ username ที่หน้า Register ส่งต่อมาให้
    const email = route?.params?.email;
    const username = route?.params?.username;

    // กดปุ่ม Verify: ตรวจรหัส OTP แล้วบันทึกข้อมูลผู้ใช้ลงตาราง users
    const handleVerify = async () => {
        // ตรวจเบื้องต้นก่อนส่งไป Supabase: ต้องมีอีเมล, ต้องกรอกรหัส, ต้องมี username
        // ถ้าขาดอย่างใดอย่างหนึ่งให้แจ้งเตือนแล้วหยุด
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
            // ขั้นที่ 1: ส่งอีเมล + รหัสไปให้ Supabase ตรวจ
            // type: 'signup' = เป็นรหัสสำหรับยืนยันการสมัคร
            // ถ้ารหัสถูก Supabase จะทำเครื่องหมายว่าอีเมลนี้ยืนยันแล้ว และคืนข้อมูลบัญชีมาให้
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

            // ขั้นที่ 2: เอาข้อมูลบัญชีที่ Supabase ส่งกลับมา (มี id และ email)
            const user = data.user;

            if (!user) {
                Alert.alert(
                    'เกิดข้อผิดพลาด',
                    'ยืนยัน OTP แล้ว แต่ไม่พบข้อมูลบัญชีผู้ใช้'
                );
                return;
            }

            // ขั้นที่ 3: บันทึกผู้ใช้ลงตาราง users (users_id, username, email)
            // upsert = ถ้ายังไม่มีแถวของ users_id นี้ให้เพิ่มใหม่ ถ้ามีแล้วให้อัปเดตทับ
            // ช่วยกันปัญหาแถวซ้ำ ถ้าผู้ใช้กดยืนยันซ้ำหลายครั้ง
            // role กับ ban ไม่ได้ส่งไป จึงใช้ค่าเริ่มต้นของตาราง (role = 'user', ban = false)
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

            // ขั้นที่ 4: สมัครสำเร็จ
            // ตอน verifyOtp ผ่าน Supabase จะล็อกอินให้อัตโนมัติ
            // เราสั่ง signOut ก่อน เพื่อให้ผู้ใช้ไปล็อกอินเองที่หน้า Login
            // (หน้า Login เป็นที่ตรวจ role และสถานะ ban ก่อนพาเข้าแอป)
            Alert.alert(
                'สำเร็จ',
                'ยืนยัน Email และสมัครสมาชิกเรียบร้อยแล้ว',
                [
                    {
                        text: 'ตกลง',
                        onPress: async () => {
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

    // กด "resend OTP": ขอให้ Supabase ส่งรหัสใหม่ไปที่อีเมลเดิม
    // ใช้ตอนรหัสเดิมหมดอายุหรือไม่ได้รับอีเมล
    // ส่งสำเร็จแล้วล้างช่องรหัสให้ว่าง เพื่อให้กรอกรหัสใหม่
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
