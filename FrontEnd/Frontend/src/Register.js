import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ⚠️ เปลี่ยนเป็น IP เครื่องคอมของคุณ (ห้ามใช้ localhost บนมือถือจริง/อีมูเลเตอร์)
const REGISTER_URL = 'http://192.168.1.7:8000/users';

const Register = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // ฟังก์ชันส่งข้อมูลไปยัง PostgreSQL ผ่าน FastAPI (ตาราง "User")
    const handleCreateAccount = async () => {
        if (!username.trim() || !email.trim() || !password || !confirmPassword) {
            Alert.alert('แจ้งเตือน', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('แจ้งเตือน', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(REGISTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim(),
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok && data.status === 'success') {
                Alert.alert('สำเร็จ', 'สมัครสมาชิกเรียบร้อยแล้ว!');
                // เปลี่ยนหน้าไปยังหน้า Otp หรือ Login พร้อมแนบ users_id ไปด้วย
                navigation?.navigate('Otp', { users_id: data.users_id });
            } else {
                // 🟢 data.detail บางทีเป็น string เดี่ยวๆ บางทีเป็น array/object (เช่น validation error
                // จาก Pydantic) ต้องแปลงเป็น string ก่อนเสมอ ไม่งั้น Alert.alert จะพัง (Red Screen)
                const errorMessage = typeof data.detail === 'string'
                    ? data.detail
                    : JSON.stringify(data.detail, null, 2);

                Alert.alert('สมัครไม่สำเร็จ', errorMessage || 'ไม่สามารถสมัครสมาชิกได้');
            }
        } catch (error) {
            // 🟢 ใช้ error.message เสมอ ห้ามส่งตัวแปร error ทั้งก้อนเข้า Alert.alert ตรงๆ
            Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถเชื่อมต่อกับ Server ได้');
            console.error('Register error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <Text style={styles.title}>สมัครสมาชิก</Text>

            <TextInput
                style={styles.input}
                placeholder="Username"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
            />

            <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />

            <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
            />

            <TouchableOpacity
                style={styles.button}
                onPress={handleCreateAccount}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>Create Account</Text>
                )}
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 24,
        textAlign: 'center',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 14,
        fontSize: 16,
    },
    button: {
        backgroundColor: '#2563eb',
        borderRadius: 8,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default Register;
