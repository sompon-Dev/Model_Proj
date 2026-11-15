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

// หน้าโปรไฟล์ของแอดมิน: แสดงชื่อ อีเมล ป้าย Admin และปุ่มออกจากระบบ
const AdminProfile = ({ navigation, route }) => {
    // ข้อมูลโปรไฟล์ที่แสดงบนจอ
    // ถ้าหน้าก่อนหน้าส่ง username/userId มาให้ (route.params) จะใช้แสดงไปก่อนได้ทันที
    // แล้วค่อยถูกแทนด้วยข้อมูลจริงจาก Supabase เมื่อโหลดเสร็จ
    const [profile, setProfile] = useState({
        username: route?.params?.username || '',
        email: '',
        userId: route?.params?.userId || '',
        role: 'admin',
    });
    // โชว์ตัวโหลดเฉพาะตอนที่ยังไม่มีชื่อให้แสดงเลย (ถ้ามีชื่อส่งมาแล้วก็ไม่ต้องโชว์)
    const [loading, setLoading] = useState(!route?.params?.username);

    // โหลดข้อมูลแอดมินที่ล็อกอินอยู่ มี 3 ขั้น:
    //   1) ถาม Supabase Auth ว่าตอนนี้ใครล็อกอินอยู่ (getUser) ถ้าไม่มีใครล็อกอินก็หยุด
    //   2) ไปอ่านแถวของคนนั้นในตาราง users (ค้นด้วย users_id = id ของบัญชี)
    //      .single() = คาดว่าได้แถวเดียว
    //      error รหัส PGRST116 แปลว่า "ไม่เจอแถว" ซึ่งไม่ถือว่าผิดพลาด เลยไม่ต้อง log
    //   3) เลือกชื่อที่จะแสดง โดยไล่หาตามลำดับ ถ้าอันแรกไม่มีค่อยใช้อันถัดไป:
    //        username ในตาราง users
    //        -> username ที่กรอกตอนสมัคร (user_metadata)
    //        -> ชื่อจาก Google/Facebook (full_name หรือ name)
    //        -> ส่วนหน้า @ ของอีเมล
    //        -> คำว่า 'Admin'
    // useCallback ทำให้ฟังก์ชันนี้ถูกสร้างครั้งเดียว ไม่ถูกสร้างใหม่ทุกครั้งที่หน้าจอวาดใหม่
    const loadAdminProfile = useCallback(async () => {
        try {
            setLoading(true);

            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.log('No auth user found:', authError?.message);
                setLoading(false);
                return;
            }

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

    // เรียกโหลดโปรไฟล์ 1 ครั้งตอนเปิดหน้านี้
    useEffect(() => {
        loadAdminProfile();
    }, [loadAdminProfile]);

    // กดปุ่มออกจากระบบ:
    //   1) เด้งกล่องถามยืนยันก่อน (กดยกเลิกได้)
    //   2) ถ้ายืนยัน ให้ Supabase ลบ session ที่จำไว้ในเครื่อง (signOut)
    //   3) ล้างประวัติการเปลี่ยนหน้าทั้งหมด แล้วไปหน้า Login (navigation.reset)
    //      ทำให้กดย้อนกลับไปหน้าแอดมินไม่ได้อีก
    // ถ้า signOut พลาด ก็ยังพาไปหน้า Login อยู่ดี ผู้ใช้จะได้ไม่ค้างอยู่หน้านี้
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
                        <View style={styles.profileCard}>
                            <View style={styles.avatarWrapper}>
                                <View style={styles.avatarCircle}>
                                    <Feather name="user" size={44} color="#111827" />
                                </View>
                            </View>

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
