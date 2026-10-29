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

const Register = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreate = async () => {
        const cleanUsername = username.trim();
        const cleanEmail = email.trim().toLowerCase();

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

            // ส่งข้อมูลไปหน้า OTP
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
                            {/* Username */}
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

                            {/* Email */}
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

                            {/* Confirm Password */}
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

                            {/* Create Button */}
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