import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons, Feather } from '@expo/vector-icons';

const AdminPage = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="dark" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                
                {/* Header: User Profile Icon */}
                <View style={styles.header}>
                    <TouchableOpacity 
                        style={styles.profileButton}
                        onPress={() => navigation?.navigate('Profile')}
                    >
                        <Feather name="user" size={24} color="#000000" />
                    </TouchableOpacity>
                </View>

                {/* Title */}
                <Text style={styles.title}>LyriSeek</Text>

                {/* Search Bar */}
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={20} color="#333333" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder=""
                        placeholderTextColor="#999999"
                    />
                </View>

                {/* Action Buttons Row */}
                <View style={styles.actionRow}>
                    {/* Add Song -> นำทางไปหน้า Addsong */}
                    <TouchableOpacity 
                        style={styles.actionItem}
                        onPress={() => navigation?.navigate('Addsong')}
                    >
                        <Text style={styles.actionTitle}>Add Song</Text>
                        <Ionicons name="add-circle-outline" size={36} color="#000000" />
                    </TouchableOpacity>

                    {/* Update Model */}
                    <TouchableOpacity 
                        style={styles.actionItem}
                        onPress={() => navigation?.navigate('UpdateModel')}
                    >
                        <Text style={styles.actionTitle}>Update Model</Text>
                        <Ionicons name="add-circle-outline" size={36} color="#000000" />
                    </TouchableOpacity>

                    {/* Add Category */}
                    <TouchableOpacity 
                        style={styles.actionItem}
                        onPress={() => navigation?.navigate('AddCategory')}
                    >
                        <Text style={styles.actionTitle}>Add Category</Text>
                        <Ionicons name="add-circle-outline" size={36} color="#000000" />
                    </TouchableOpacity>
                </View>

                {/* Most Search Section */}
                <TouchableOpacity 
                    style={styles.mostSearchContainer}
                    onPress={() => navigation?.navigate('MostSearch')}
                >
                    <Text style={styles.mostSearchTitle}>Most search</Text>
                    <Ionicons name="add-circle-outline" size={36} color="#000000" />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFC47E',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingBottom: 40,
        alignItems: 'center',
    },
    header: {
        width: '100%',
        alignItems: 'flex-end',
        marginTop: 10,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 56,
        fontWeight: 'bold',
        color: '#FFFFFF',
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 25,
        height: 48,
        width: '90%',
        paddingHorizontal: 16,
        marginBottom: 40,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#000000',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 40,
    },
    actionItem: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    actionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000000',
        textAlign: 'center',
        marginBottom: 10,
    },
    mostSearchContainer: {
        alignItems: 'center',
        marginTop: 10,
    },
    mostSearchTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#000000',
        textAlign: 'center',
        marginBottom: 10,
    },
});

export default AdminPage;