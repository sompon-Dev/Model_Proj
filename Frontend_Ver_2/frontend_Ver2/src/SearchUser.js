
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

const SearchUser = ({ navigation }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [actionLoading, setActionLoading] = useState(null);
    const [currentUserId, setCurrentUserId] = useState(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    // Fetch all users
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

    // Ban / Unban user
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

    // Delete user using Supabase Edge Function
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

                            // Call Edge Function
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

                            // Remove user from screen
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

    // Render user card
    const renderUser = ({ item }) => {
        const isBanned = item.ban === true;
        const isProcessing = actionLoading === item.users_id;

        return (
            <View style={styles.userCard}>

                {/* User Information */}
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

                {/* Action Buttons */}
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

            {/* Header */}
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

            {/* User Count */}
            <View style={styles.countContainer}>
                <Text style={styles.countText}>
                    Total Users: {users.length}
                </Text>
            </View>

            {/* User List */}
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
