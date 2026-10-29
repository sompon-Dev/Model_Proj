import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const AdminProfile = ({ navigation, route }) => {
    const [profile, setProfile] = useState({
        username: route?.params?.username || '',
        email: '',
        userId: route?.params?.userId || '',
        role: 'admin',
    });
    const [loading, setLoading] = useState(!route?.params?.username);

    const loadAdminProfile = useCallback(async () => {
        try {
            setLoading(true);

            // 1. ดึงข้อมูล User จาก Supabase Auth
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.log('No auth user found:', authError?.message);
                setLoading(false);
                return;
            }

            // 2. ดึงข้อมูล Profile เพิ่มเติมจากตาราง public.users
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('*')
                .eq('users_id', user.id)
                .single();

            if (dbError && dbError.code !== 'PGRST116') {
                console.log('Error fetching admin profile from DB:', dbError.message);
            }

            const resolvedUsername =
                dbUser?.username ||
                user.user_metadata?.username ||
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split('@')[0] ||
                'Admin';

            setProfile({
                username: resolvedUsername,
                email: dbUser?.email || user.email || '',
                userId: user.id,
                role: dbUser?.role || 'admin',
            });
        } catch (err) {
            console.error('Unexpected error loading admin profile:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAdminProfile();
    }, [loadAdminProfile]);

    const handleLogout = () => {
        Alert.alert(
            'ออกจากระบบ',
            'คุณต้องการออกจากระบบหรือไม่?',
            [
                { text: 'ยกเลิก', style: 'cancel' },
                {
                    text: 'ออกจากระบบ',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await supabase.auth.signOut();
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        } catch (error) {
                            console.error('Logout error:', error);
                            navigation.reset({
                                index: 0,
                                routes: [{ name: 'Login' }],
                            });
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        activeOpacity={0.7}
                        onPress={() => navigation?.goBack()}
                    >
                        <Feather name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle}>Admin Profile</Text>

                    <View style={styles.headerRightPlaceholder} />
                </View>

                {loading && !profile.username ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#556AB0" />
                        <Text style={styles.loadingText}>กำลังโหลดข้อมูลผู้ดูแลระบบ...</Text>
                    </View>
                ) : (
                    <>
                        {/* Profile Header Card */}
                        <View style={styles.profileCard}>
                            <View style={styles.avatarWrapper}>
                                <View style={styles.avatarCircle}>
                                    <Feather name="user" size={44} color="#111827" />
                                </View>
                            </View>

                            {/* แสดงชื่อของ Admin */}
                            <Text style={styles.usernameText}>
                                {profile.username || 'Admin'}
                            </Text>

                            {profile.email ? (
                                <Text style={styles.userEmailText}>{profile.email}</Text>
                            ) : null}

                            <View style={styles.roleBadge}>
                                <Text style={styles.roleBadgeText}>Admin</Text>
                            </View>
                        </View>

                        {/* Logout Button */}
                        <TouchableOpacity
                            style={styles.logoutButton}
                            activeOpacity={0.8}
                            onPress={handleLogout}
                        >
                            <Feather name="log-out" size={20} color="#DC2626" style={styles.logoutIcon} />
                            <Text style={styles.logoutButtonText}>ออกจากระบบ</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8ECF2',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111827',
    },
    headerRightPlaceholder: {
        width: 44,
    },
    loadingContainer: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: '#6B7280',
    },
    profileCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8ECF2',
        borderRadius: 24,
        paddingVertical: 32,
        paddingHorizontal: 20,
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    avatarWrapper: {
        marginBottom: 16,
    },
    avatarCircle: {
        width: 90,
        height: 90,
        borderRadius: 45,
        backgroundColor: '#D1D1D1',
        borderWidth: 2,
        borderColor: '#C5C5C5',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 5,
        elevation: 3,
    },
    usernameText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
        textAlign: 'center',
    },
    userEmailText: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 12,
    },
    roleBadge: {
        backgroundColor: '#EEF2FF',
        borderWidth: 1,
        borderColor: '#C7D2FE',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 5,
    },
    roleBadgeText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#4338CA',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FEE2E2',
        borderRadius: 20,
        paddingVertical: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    logoutIcon: {
        marginRight: 8,
    },
    logoutButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#DC2626',
    },
});

export default AdminProfile;
