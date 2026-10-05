import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const Otp = ({ navigation }) => {
    const [otp, setOtp] = useState('');

    const handleVerify = () => {
        navigation?.navigate('Login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <View style={styles.content}>
                <Text style={styles.title}>
                    Enter your OTP code{'\n'}to sign up
                </Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder=""
                    />
                </View>

                <TouchableOpacity
                    style={styles.verifyButton}
                    activeOpacity={0.85}
                    onPress={handleVerify}
                >
                    <Text style={styles.verifyButtonText}>Verify</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resendButton}
                    activeOpacity={0.6}
                >
                    <Text style={styles.resendText}>resend OTP</Text>
                </TouchableOpacity>
            </View>
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
        paddingHorizontal: 32,
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1A1A1A',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 40,
    },
    inputContainer: {
        width: '100%',
        borderWidth: 1.5,
        borderColor: '#2B2B2B',
        borderRadius: 4,
        height: 60,
        justifyContent: 'center',
        paddingHorizontal: 16,
        marginBottom: 36,
    },
    input: {
        fontSize: 22,
        color: '#1A1A1A',
        letterSpacing: 4,
    },
    verifyButton: {
        backgroundColor: '#4E64A6',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 36,
        minWidth: 150,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
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
        color: '#444444',
    },
});

export default Otp;
