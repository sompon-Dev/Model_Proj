import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// หน้าจัดการผู้ใช้ (สำหรับแอดมิน): ดูรายชื่อผู้ใช้ทั้งหมด, ระงับ/ปลดระงับบัญชี, และลบบัญชี
// ข้อมูลผู้ใช้อยู่ในตาราง users ของ Supabase (ไม่ใช่ database บน Render)
const SearchUser = ({ navigation }) => {
    const [users, setUsers] = useState([]);                 // รายชื่อผู้ใช้ทั้งหมด
    const [loading, setLoading] = useState(true);           // true ระหว่างโหลดรายชื่อ
    const [errorMessage, setErrorMessage] = useState('');   // ข้อความ error ที่จะแสดงบนจอ (ว่าง = ไม่มี error)
    // users_id ของผู้ใช้ที่กำลังถูก ban หรือลบอยู่ (null = ไม่มี)
    // ใช้ปิดปุ่มและโชว์วงกลมหมุนเฉพาะการ์ดของคนนั้น
    const [actionLoading, setActionLoading] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null); // id ของแอดมินที่ล็อกอินอยู่ (กันแอดมินแบน/ลบตัวเอง)

    // ตอนเปิดหน้า: โหลดรายชื่อผู้ใช้ 1 ครั้ง
    useEffect(() => {
        fetchUsers();
    }, []);

    // โหลดรายชื่อผู้ใช้
    //   1) ถาม Supabase ว่าใครล็อกอินอยู่ ถ้าไม่มีใครล็อกอินให้แสดง error
    //   2) จำ id ของแอดมินคนนี้ไว้ (กันแบน/ลบตัวเอง)
    //   3) อ่านตาราง users: เอาเฉพาะ users_id, username, email, ban แล้วเรียงตามชื่อ ก-ฮ / A-Z
    // ถ้าขั้นไหนพลาด (throw) จะกระโดดไปที่ catch: แสดงข้อความ error และล้างรายชื่อ
    const fetchUsers = async () => {
        try {
            setLoading(true);
            setErrorMessage('');

            const { data: authData, error: authError } =
                await supabase.auth.getUser();

            if (authError) throw authError;

            if (!authData.user) {
                throw new Error('Please login before accessing this page.');
            }

            setCurrentUserId(authData.user.id);

            const { data, error } = await supabase
                .from('users')
                .select('users_id, username, email, ban')
                .order('username', { ascending: true });

            if (error) throw error;

            setUsers(data || []);

            console.log('Total Users:', data?.length || 0);
            console.log('Users Data:', data);

        } catch (error) {
            console.log('Fetch users error:', error.message);
            setErrorMessage(error.message);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    // กดปุ่ม Ban / Unban: สลับสถานะระงับบัญชีของผู้ใช้คนนี้
    //   1) ถ้าเป็นบัญชีของแอดมินเอง ห้ามทำ
    //   2) เด้งถามยืนยัน (ข้อความเปลี่ยนตามสถานะปัจจุบัน)
    //   3) ถ้ายืนยัน ให้แก้คอลัมน์ ban ในตาราง users เป็นค่าตรงข้าม (true <-> false)
    //   4) สำเร็จแล้วแก้สถานะของคนนั้นในรายการบนจอทันที โดยไม่ต้องโหลดรายชื่อใหม่ทั้งหมด
    // ผลของการ ban: ครั้งหน้าที่ผู้ใช้คนนี้ล็อกอิน หน้า Login จะเห็นว่า ban = true แล้วไม่ให้เข้าแอป
    const handleToggleBan = (item) => {
        if (item.users_id === currentUserId) {
            Alert.alert(
                'Cannot perform action',
                'You cannot suspend your own account.'
            );
            return;
        }

        const isBanned = item.ban === true;

        Alert.alert(
            isBanned ? 'Unban User' : 'Ban User',
            isBanned
                ? `Do you want to activate ${item.username}'s account?`
                : `Do you want to suspend ${item.username}'s account?`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: isBanned ? 'Unban' : 'Ban',
                    style: isBanned ? 'default' : 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(item.users_id);

                            const { error } = await supabase
                                .from('users')
                                .update({
                                    ban: !isBanned,
                                })
                                .eq('users_id', item.users_id);

                            if (error) throw error;

                            setUsers(prevUsers =>
                                prevUsers.map(user =>
                                    user.users_id === item.users_id
                                        ? { ...user, ban: !isBanned }
                                        : user
                                )
                            );

                            Alert.alert(
                                'Success',
                                isBanned
                                    ? 'User account has been activated.'
                                    : 'User account has been suspended.'
                            );

                        } catch (error) {
                            console.log('Ban error:', error.message);
                            Alert.alert('Error', error.message);
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ]
        );
    };

    // กดปุ่ม Delete: ลบบัญชีผู้ใช้ถาวร (ย้อนกลับไม่ได้)
    //   1) ถ้าเป็นบัญชีของแอดมินเอง ห้ามลบ
    //   2) เด้งถามยืนยันก่อน
    //   3) เรียกฟังก์ชัน delete-user ที่อยู่บน Supabase (Edge Function)
    //      เหตุที่ไม่ลบจากแอปตรงๆ: การลบบัญชีใน Supabase Auth ต้องใช้กุญแจระดับผู้ดูแล (service role)
    //      ซึ่งห้ามใส่ไว้ในแอป จึงให้ฟังก์ชันฝั่ง server เป็นคนลบแทน
    //   4) ถ้าฟังก์ชันตอบว่าไม่สำเร็จ ให้ถือเป็น error
    //   5) สำเร็จแล้วเอาผู้ใช้คนนั้นออกจากรายการบนจอ
    const handleDeleteUser = (item) => {
        if (item.users_id === currentUserId) {
            Alert.alert(
                'Cannot delete account',
                'You cannot delete your own account.'
            );
            return;
        }

        Alert.alert(
            'Delete User',
            `Are you sure you want to delete ${item.username}?\n\nThis action cannot be undone.`,
            [
                {
                    text: 'Cancel',
                    style: 'cancel',
                },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setActionLoading(item.users_id);

                            const { data, error } =
                                await supabase.functions.invoke(
                                    'delete-user',
                                    {
                                        body: {
                                            userId: item.users_id,
                                        },
                                    }
                                );

                            if (error) throw error;

                            if (!data?.success) {
                                throw new Error(
                                    data?.error || 'Delete failed'
                                );
                            }

                            setUsers(prevUsers =>
                                prevUsers.filter(
                                    user =>
                                        user.users_id !== item.users_id
                                )
                            );

                            Alert.alert(
                                'Success',
                                'User account has been deleted successfully.'
                            );

                        } catch (error) {
                            console.log('Delete error:', error.message);

                            Alert.alert(
                                'Delete Failed',
                                error.message ||
                                'Unable to delete user account.'
                            );
                        } finally {
                            setActionLoading(null);
                        }
                    },
                },
            ]
        );
    };

    // วาดการ์ดของผู้ใช้ 1 คน
    //   isBanned     = คนนี้ถูกระงับอยู่ไหม (ใช้เปลี่ยนป้ายสถานะและปุ่ม Ban/Unban)
    //   isProcessing = กำลัง ban หรือลบคนนี้อยู่ไหม (ถ้าใช่ ปุ่มจะกดไม่ได้ชั่วคราว)
    const renderUser = ({ item }) => {
        const isBanned = item.ban === true;
        const isProcessing = actionLoading === item.users_id;

        return (
            <View style={styles.userCard}>

                <View style={styles.userInfoRow}>
                    <View style={styles.userIcon}>
                        <Feather
                            name="user"
                            size={24}
                            color="#556AB0"
                        />
                    </View>

                    <View style={styles.userInfo}>
                        <Text style={styles.username}>
                            {item.username || 'No username'}
                        </Text>

                        <Text style={styles.email}>
                            {item.email || 'No email'}
                        </Text>

                        <View
                            style={[
                                styles.statusBadge,
                                isBanned
                                    ? styles.bannedBadge
                                    : styles.activeBadge,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.statusText,
                                    isBanned
                                        ? styles.bannedText
                                        : styles.activeText,
                                ]}
                            >
                                {isBanned ? 'Banned' : 'Active'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionContainer}>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            isBanned
                                ? styles.unbanButton
                                : styles.banButton,
                        ]}
                        onPress={() => handleToggleBan(item)}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        {isProcessing ? (
                            <ActivityIndicator
                                size="small"
                                color="#FFFFFF"
                            />
                        ) : (
                            <>
                                <Feather
                                    name={
                                        isBanned
                                            ? 'check-circle'
                                            : 'slash'
                                    }
                                    size={17}
                                    color={
                                        isBanned
                                            ? '#FFFFFF'
                                            : '#B8791D'
                                    }
                                />

                                <Text
                                    style={[
                                        styles.actionText,
                                        isBanned
                                            ? styles.whiteText
                                            : styles.banText,
                                    ]}
                                >
                                    {isBanned ? 'Unban' : 'Ban'}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.actionButton,
                            styles.deleteButton,
                        ]}
                        onPress={() => handleDeleteUser(item)}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        <Feather
                            name="trash-2"
                            size={17}
                            color="#D94B4B"
                        />

                        <Text style={styles.deleteText}>
                            Delete
                        </Text>
                    </TouchableOpacity>

                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />

            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <Feather
                        name="arrow-left"
                        size={24}
                        color="#1E1E1E"
                    />
                </TouchableOpacity>

                <Text style={styles.headerTitle}>
                    Search User
                </Text>

                <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={fetchUsers}
                    disabled={loading || actionLoading !== null}
                >
                    <Feather
                        name="refresh-cw"
                        size={20}
                        color="#556AB0"
                    />
                </TouchableOpacity>
            </View>

            <View style={styles.countContainer}>
                <Text style={styles.countText}>
                    Total Users: {users.length}
                </Text>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator
                        size="large"
                        color="#556AB0"
                    />

                    <Text style={styles.loadingText}>
                        Loading users...
                    </Text>
                </View>
            ) : errorMessage ? (
                <View style={styles.center}>
                    <Feather
                        name="alert-circle"
                        size={45}
                        color="#E05252"
                    />

                    <Text style={styles.emptyText}>
                        {errorMessage}
                    </Text>

                    <TouchableOpacity
                        style={styles.retryButton}
                        onPress={fetchUsers}
                    >
                        <Text style={styles.retryText}>
                            Try Again
                        </Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => item.users_id}
                    renderItem={renderUser}
                    contentContainerStyle={[
                        styles.listContent,
                        users.length === 0 && styles.emptyList,
                    ]}
                    showsVerticalScrollIndicator={false}
                    onRefresh={fetchUsers}
                    refreshing={loading}
                    ListEmptyComponent={
                        <View style={styles.center}>
                            <Feather
                                name="users"
                                size={45}
                                color="#A0A0A0"
                            />

                            <Text style={styles.emptyText}>
                                No users found
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FD',
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },

    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },

    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
    },

    refreshButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },

    countContainer: {
        paddingHorizontal: 24,
        marginTop: 10,
        marginBottom: 12,
    },

    countText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#556AB0',
    },

    listContent: {
        paddingHorizontal: 24,
        paddingBottom: 30,
    },

    emptyList: {
        flexGrow: 1,
    },

    userCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E8ECF2',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },

    userInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    userIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#E8EDFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },

    userInfo: {
        flex: 1,
    },

    username: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 5,
    },

    email: {
        fontSize: 14,
        color: '#777777',
        marginBottom: 7,
    },

    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },

    activeBadge: {
        backgroundColor: '#E0F5E9',
    },

    bannedBadge: {
        backgroundColor: '#FCE5E5',
    },

    statusText: {
        fontSize: 11,
        fontWeight: '700',
    },

    activeText: {
        color: '#219653',
    },

    bannedText: {
        color: '#D94B4B',
    },

    actionContainer: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 15,
    },

    actionButton: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 10,
        gap: 7,
    },

    banButton: {
        backgroundColor: '#FFF0D9',
    },

    unbanButton: {
        backgroundColor: '#556AB0',
    },

    deleteButton: {
        backgroundColor: '#FCE5E5',
    },

    actionText: {
        fontSize: 14,
        fontWeight: '700',
    },

    banText: {
        color: '#B8791D',
    },

    whiteText: {
        color: '#FFFFFF',
    },

    deleteText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#D94B4B',
    },

    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#777777',
    },

    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: '#777777',
        textAlign: 'center',
    },

    retryButton: {
        marginTop: 18,
        backgroundColor: '#556AB0',
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
    },

    retryText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default SearchUser;
