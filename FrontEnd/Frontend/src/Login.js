import React from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const Login = ({ navigation }) => {
    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.content}>
                <Text style={styles.title}>Login</Text>

                <View style={styles.formContainer}>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Username or E-mail"
                            placeholderTextColor="rgba(255, 255, 255, 0.55)"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
                            placeholderTextColor="rgba(255, 255, 255, 0.55)"
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.loginButton}
                        activeOpacity={0.85}
                        onPress={() => navigation?.navigate('Homeuser')}
                    >
                        <Text style={styles.loginButtonText}>Login!</Text>
                    </TouchableOpacity>

                    <View style={styles.footerContainer}>
                        <Text style={styles.footerText}>
                            Don’t have an account?{' '}
                            <Text
                                style={styles.signUpText}
                                onPress={() => navigation?.navigate('Register')}
                            >
                                Sign up
                            </Text>
                        </Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#802628',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    title: {
        fontSize: 52,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 50,
    },
    formContainer: {
        width: '100%',
    },
    inputContainer: {
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.65)',
        borderRadius: 8,
        height: 52,
        justifyContent: 'center',
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    input: {
        fontSize: 16,
        color: '#FFFFFF',
    },
    loginButton: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
        marginBottom: 18,
    },
    loginButtonText: {
        fontSize: 20,
        fontWeight: '500',
        color: '#2B2B2B',
    },
    footerContainer: {
        alignItems: 'center',
        marginTop: 4,
    },
    footerText: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 14,
    },
    signUpText: {
        color: '#FFFFFF',
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
});

export default Login;

